import { error, json, options } from '../_shared/cors.ts'
import { hasCronSecret, serviceClient } from '../_shared/supabase.ts'

type Row = Record<string, any>

async function validatePuzzle(client: any, puzzleId: string) {
  const failures: string[] = []
  const { data: puzzle } = await client.from('puzzles').select('*').eq('id', puzzleId).maybeSingle()
  if (!puzzle) return { valid: false, failures: ['Puzzle not found'] }
  if (!['approved', 'published'].includes(puzzle.status)) failures.push('Puzzle has not passed editorial approval')
  const { data: edges } = await client.from('causal_edges').select('*').eq('puzzle_id', puzzleId)
  const { data: nodes } = await client.from('event_nodes').select('media_asset_id').eq('puzzle_id', puzzleId)
  if (!edges?.length) failures.push('Puzzle has no causal edges')
  const { data: edgeSources } = edges?.length ? await client.from('edge_sources').select('edge_id').in('edge_id', edges.map((edge: Row) => edge.id)) : { data: [] }
  for (const edge of edges ?? []) {
    if (!(edgeSources ?? []).some((source: Row) => source.edge_id === edge.id)) failures.push(`Edge ${edge.step_index + 1} is missing a source`)
    if (!edge.relationship_type || !edge.confidence || !edge.explanation?.trim()) failures.push(`Edge ${edge.step_index + 1} is missing causal review fields`)
    if (!edge.reviewer_id || !edge.reviewed_at) failures.push(`Edge ${edge.step_index + 1} has no reviewer approval`)
    const { data: choices } = await client.from('choice_options').select('is_correct, rejection_copy').eq('edge_id', edge.id)
    const decoys = (choices ?? []).filter((choice: Row) => !choice.is_correct)
    if (decoys.length < 2 || decoys.some((choice: Row) => !choice.rejection_copy?.trim())) failures.push(`Edge ${edge.step_index + 1} needs two explained decoys`)
  }
  const mediaIds = (nodes ?? []).map((node: Row) => node.media_asset_id).filter(Boolean)
  if (!mediaIds.length || mediaIds.length !== (nodes ?? []).length) failures.push('Every event must have media metadata')
  if (mediaIds.length) {
    const { data: media } = await client.from('media_assets').select('id, source_url, license, credit, alt_text').in('id', mediaIds)
    for (const asset of media ?? []) if (!asset.source_url || !asset.license || !asset.credit || !asset.alt_text?.trim()) failures.push(`Media ${asset.id} is missing attribution or alt text`)
  }
  return { valid: failures.length === 0, failures }
}

async function findValidPuzzle(client: any, puzzles: Row[]) {
  for (const puzzle of puzzles) {
    const validation = await validatePuzzle(client, puzzle.id)
    if (validation.valid) return { puzzle, validation }
  }
  return { puzzle: null, validation: { valid: false, failures: ['No valid approved puzzle is available'] } }
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (!hasCronSecret(request)) return error('Cron authentication required', 401)
  try {
    const client = serviceClient()
    const targetDate = new Date().toISOString().slice(0, 10)
    const { data: existingSlot } = await client.from('publication_slots').select('*').eq('publish_date', targetDate).maybeSingle()
    if (existingSlot?.status === 'published' || existingSlot?.status === 'fallback') return json({ ok: true, idempotent: true, slot: existingSlot })

    const { data: scheduled } = await client.from('publication_slots').select('*, puzzles(*)').eq('publish_date', targetDate).eq('status', 'scheduled').maybeSingle()
    const scheduledPuzzle = scheduled?.puzzles as Row | undefined
    const approved = scheduledPuzzle ? await findValidPuzzle(client, [scheduledPuzzle]) : { puzzle: null, validation: { valid: false, failures: ['No scheduled puzzle'] } }
    let selected = approved.puzzle
    let status: 'published' | 'fallback' = 'published'
    let reason: string | null = null
    if (!selected) {
      const { data: fallbacks } = await client.from('puzzles').select('*').eq('status', 'approved').eq('is_fallback', true).order('puzzle_number')
      const fallback = await findValidPuzzle(client, fallbacks ?? [])
      selected = fallback.puzzle
      status = 'fallback'
      reason = [...approved.validation.failures, ...fallback.validation.failures].join('; ')
    }
    if (!selected) return json({ ok: false, published: false, date: targetDate, failures: [reason ?? 'No fallback puzzle available'] }, 422)
    await client.from('puzzles').update({ status: 'published' }).eq('id', selected.id)
    const { data: slot, error: slotError } = await client.from('publication_slots').upsert({ puzzle_id: selected.id, publish_date: targetDate, status, fallback_reason: reason, published_at: new Date().toISOString() }, { onConflict: 'publish_date' }).select().single()
    if (slotError) throw slotError
    return json({ ok: true, published: true, date: targetDate, puzzleId: selected.id, status, slot, fallbackReason: reason })
  } catch (caught) {
    console.error(caught)
    return error(caught instanceof Error ? caught.message : 'Publication job failed', 500)
  }
})
