import { error, json, options } from '../_shared/cors.ts'
import { hasCronSecret, serviceClient } from '../_shared/supabase.ts'

type Topic = Record<string, any>

function canonicalize(url: string) {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) if (key.startsWith('utm_') || key === 'ref') parsed.searchParams.delete(key)
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

async function braveSearch(topic: Topic) {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY')
  if (!apiKey) return []
  const params = new URLSearchParams({ q: topic.query, count: '5', safesearch: 'moderate' })
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } })
  if (!response.ok) throw new Error(`Brave Search returned ${response.status}`)
  const body = await response.json()
  return (body.web?.results ?? []).map((result: any) => ({ title: result.title, url: result.url, description: result.description, publisher: new URL(result.url).hostname }))
}

function curatedSeeds(topic: Topic) {
  return (Array.isArray(topic.seed_urls) ? topic.seed_urls : []).map((url: string) => ({ title: `${topic.name} source lead`, url, description: `Curated source lead for ${topic.query}`, publisher: new URL(url).hostname }))
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (!hasCronSecret(request)) return error('Cron authentication required', 401)
  let runId: string | null = null
  try {
    const client = serviceClient()
    const now = new Date()
    const bucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), Math.floor(now.getUTCMinutes() / 15) * 15)).toISOString()
    const run = await client.from('research_job_runs').insert({ idempotency_key: 'discovery:' + bucket, stage: 'discovery', status: 'running', prompt_version: 'brave-leads-v1' }).select('id').single()
    if (run.error?.code === '23505') return json({ ok: true, idempotent: true, published: 0 })
    if (run.error) throw run.error
    runId = run.data.id
    const { data: topics, error: topicError } = await client.from('research_topics').select('*').eq('active', true)
    if (topicError) throw topicError
    let candidatesCreated = 0
    let topicsProcessed = 0
    const failures: string[] = []
    for (const topic of topics ?? []) {
      try {
        let results: any[] = []
        try { results = await braveSearch(topic) } catch (caught) { failures.push(`${topic.name}: ${caught instanceof Error ? caught.message : 'search failed'}`) }
        if (!results.length) results = curatedSeeds(topic)
        for (const result of results) {
          if (!result.url) continue
          const canonicalUrl = canonicalize(result.url)
          const { error: insertError } = await client.from('research_candidates').upsert({
            topic_id: topic.id,
            title: result.title ?? topic.name,
            hook: result.description ?? `Investigate how ${topic.query} rippled outward.`,
            category: topic.category,
            seed_question: `How did ${result.title ?? topic.name} lead to something unexpected?`,
            canonical_url: canonicalUrl,
            source_title: result.title ?? topic.name,
            source_publisher: result.publisher ?? 'Web source',
            snippet: result.description ?? null,
            raw_result: result,
          }, { onConflict: 'canonical_url', ignoreDuplicates: true })
          if (insertError) failures.push(`${topic.name}: ${insertError.message}`)
          else candidatesCreated += 1
        }
        await client.from('research_topics').update({ last_run_at: new Date().toISOString() }).eq('id', topic.id)
        topicsProcessed += 1
      } catch (caught) {
        failures.push(`${topic.name}: ${caught instanceof Error ? caught.message : 'topic failed'}`)
      }
    }
    await client.from('research_job_runs').update({ status: failures.length ? 'failed' : 'succeeded', source_count: candidatesCreated, details: { topicsProcessed, failures }, finished_at: new Date().toISOString() }).eq('id', runId)
    return json({ ok: failures.length === 0, topicsProcessed, candidatesCreated, failures, published: 0, note: 'Discovery creates leads only; research-worker must fetch and verify evidence before publication.' })
  } catch (caught) {
    console.error(caught)
    if (runId) await serviceClient().from('research_job_runs').update({ status: 'failed', error_message: caught instanceof Error ? caught.message : 'Research job failed', finished_at: new Date().toISOString() }).eq('id', runId)
    return error(caught instanceof Error ? caught.message : 'Research job failed', 500)
  }
})
