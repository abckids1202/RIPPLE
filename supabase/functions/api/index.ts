import { error, json, options } from '../_shared/cors.ts'
import { editorFromRequest, serviceClient } from '../_shared/supabase.ts'

type DbRow = Record<string, any>

function toEvent(row: DbRow) {
  return {
    id: row.node_key ?? row.id,
    title: row.title,
    detail: row.detail,
    year: row.year_label,
    icon: row.icon ?? '✦',
    tone: row.tone ?? 'ink',
  }
}

async function loadPuzzle(client: any, puzzle: DbRow, includeAnswers = false) {
  const [eventsResult, edgesResult, choicesResult, hintsResult] = await Promise.all([
    client.from('event_nodes').select('*').eq('puzzle_id', puzzle.id).order('sort_order'),
    client.from('causal_edges').select('*').eq('puzzle_id', puzzle.id).order('step_index'),
    client.from('choice_options').select(includeAnswers ? '*' : 'id, edge_id, event_id, title, detail, year_label, icon, tone, sort_order').in('edge_id', (await client.from('causal_edges').select('id').eq('puzzle_id', puzzle.id)).data?.map((edge: DbRow) => edge.id) ?? []).order('sort_order'),
    client.from('hints').select('*').in('edge_id', (await client.from('causal_edges').select('id').eq('puzzle_id', puzzle.id)).data?.map((edge: DbRow) => edge.id) ?? []),
  ])
  if (eventsResult.error || edgesResult.error || choicesResult.error || hintsResult.error) throw new Error('Unable to load puzzle relations')

  const events = eventsResult.data ?? []
  const edges = edgesResult.data ?? []
  const choices = choicesResult.data ?? []
  const hints = hintsResult.data ?? []
  const edgeIds = edges.map((edge: DbRow) => edge.id)
  const { data: edgeSources } = edgeIds.length ? await client.from('edge_sources').select('edge_id, source_id').in('edge_id', edgeIds) : { data: [] }
  const sourceIds = (edgeSources ?? []).map((row: DbRow) => row.source_id)
  const { data: sources } = sourceIds.length ? await client.from('sources').select('*').in('id', sourceIds) : { data: [] }
  const eventById = new Map(events.map((event: DbRow) => [event.id, event]))
  const eventByKey = new Map(events.map((event: DbRow) => [event.node_key, event]))
  const sourceById = new Map((sources ?? []).map((source: DbRow) => [source.id, source]))

  const start = events.find((event: DbRow) => event.kind === 'start') ?? events[0]
  const ending = events.find((event: DbRow) => event.kind === 'ending') ?? events.at(-1)
  const frontendSources = (sources ?? []).map((source: DbRow) => ({ title: source.title, publisher: source.publisher, url: source.url }))
  const steps = edges.map((edge: DbRow) => {
    const from = eventById.get(edge.from_event_id) ?? eventByKey.get(edge.from_event_id)
    const to = eventById.get(edge.to_event_id) ?? eventByKey.get(edge.to_event_id)
    const sourceId = (edgeSources ?? []).find((row: DbRow) => row.edge_id === edge.id)?.source_id
    const source = sourceById.get(sourceId) ?? sources?.[0]
    const stepChoices = choices.filter((choice: DbRow) => choice.edge_id === edge.id).map((choice: DbRow) => ({
      id: choice.event_id ? (eventById.get(choice.event_id)?.node_key ?? choice.event_id) : choice.id,
      title: choice.title,
      detail: choice.detail,
      year: choice.year_label,
      icon: choice.icon ?? '✦',
      tone: choice.tone ?? 'ink',
      ...(includeAnswers ? { correct: Boolean(choice.is_correct), whyWrong: choice.rejection_copy ?? undefined } : {}),
    }))
    return {
      id: edge.id,
      question: edge.question ?? 'Which event happened next?',
      bridge: edge.explanation,
      relationship: `${edge.relationship_type[0].toUpperCase()}${edge.relationship_type.slice(1)}`,
      from: from?.node_key ?? from?.id,
      to: to?.node_key ?? to?.id,
      choices: stepChoices,
      hint: hints.find((hint: DbRow) => hint.edge_id === edge.id)?.hint_text ?? 'Look for the pressure building between these two events.',
      source: source ? { title: source.title, publisher: source.publisher, url: source.url } : { title: 'Evidence desk review', publisher: 'RIPPLE', url: 'https://ripple.example' },
    }
  })
  return {
    id: puzzle.id,
    slug: puzzle.slug,
    number: puzzle.puzzle_number,
    category: puzzle.category,
    difficulty: puzzle.difficulty,
    duration: puzzle.duration,
    hook: puzzle.hook,
    question: puzzle.question,
    start: toEvent(start),
    ending: toEvent(ending),
    steps,
    takeaway: puzzle.takeaway,
    sources: frontendSources,
    accent: puzzle.accent,
  }
}

async function publishedPuzzles(client: any) {
  const { data, error: queryError } = await client.from('puzzles').select('*').eq('status', 'published').order('puzzle_number')
  if (queryError) throw queryError
  return Promise.all((data ?? []).map((puzzle: DbRow) => loadPuzzle(client, puzzle)))
}

async function dailyPuzzle(client: any) {
  const date = new Date().toISOString().slice(0, 10)
  const { data: slot } = await client.from('publication_slots').select('puzzle_id, status').eq('publish_date', date).in('status', ['published', 'fallback']).maybeSingle()
  let puzzle: DbRow | null = null
  if (slot?.puzzle_id) {
    const result = await client.from('puzzles').select('*').eq('id', slot.puzzle_id).eq('status', 'published').maybeSingle()
    puzzle = result.data
  }
  if (!puzzle) {
    const result = await client.from('puzzles').select('*').eq('status', 'published').eq('is_fallback', true).order('puzzle_number').limit(1).maybeSingle()
    puzzle = result.data
  }
  if (!puzzle) {
    const result = await client.from('puzzles').select('*').eq('status', 'published').order('puzzle_number').limit(1).maybeSingle()
    puzzle = result.data
  }
  return puzzle ? loadPuzzle(client, puzzle) : null
}

async function editorOnly(request: Request) {
  const editor = await editorFromRequest(request)
  if (!editor) throw new Response('Editor access required', { status: 403 })
  return editor
}

async function handleEditor(request: Request, segments: string[]) {
  const editor = await editorOnly(request)
  const client = serviceClient()
  if (request.method === 'GET' && segments[1] === 'candidates') {
    const { data, error: queryError } = await client.from('research_candidates').select('*, editorial_reviews(*)').order('created_at', { ascending: false })
    if (queryError) throw queryError
    return json(data ?? [])
  }
  if (request.method === 'POST' && segments[1] === 'candidates' && segments[3] === 'review') {
    const candidateId = segments[2]
    const body = await request.json()
    const row = { candidate_id: candidateId, reviewer_id: editor.user.id, status: body.status ?? 'draft', checklist: body.checklist ?? {}, note: body.note ?? null, reviewed_at: new Date().toISOString() }
    const { data, error: queryError } = await client.from('editorial_reviews').insert(row).select().single()
    if (queryError) throw queryError
    await client.from('research_candidates').update({ status: body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : 'needs_review' }).eq('id', candidateId)
    return json(data, 201)
  }
  if (request.method === 'POST' && segments[1] === 'puzzles' && segments[3] === 'approve') {
    const puzzleId = segments[2]
    const { data: puzzle } = await client.from('puzzles').select('*').eq('id', puzzleId).maybeSingle()
    if (!puzzle) return error('Puzzle not found', 404)
    const validation = await validateForPublication(client, puzzleId)
    if (!validation.valid) return json({ error: 'Approval blocked', failures: validation.failures }, 422)
    const { data, error: queryError } = await client.from('puzzles').update({ status: 'approved', approved_by: editor.user.id, approved_at: new Date().toISOString() }).eq('id', puzzleId).select().single()
    if (queryError) throw queryError
    await client.from('revisions').insert({ entity_type: 'puzzle', entity_id: puzzleId, editor_id: editor.user.id, action: 'approved', snapshot: data })
    return json(data)
  }
  if (request.method === 'POST' && segments[1] === 'publications') {
    const body = await request.json()
    const validation = await validateForPublication(client, body.puzzleId)
    if (!validation.valid) return json({ error: 'Publication blocked', failures: validation.failures }, 422)
    const { data: puzzle } = await client.from('puzzles').select('status').eq('id', body.puzzleId).maybeSingle()
    if (!puzzle || !['approved', 'published'].includes(puzzle.status)) return error('Only an approved puzzle can be scheduled', 422)
    const { data, error: queryError } = await client.from('publication_slots').upsert({ puzzle_id: body.puzzleId, publish_date: body.publishDate, status: 'scheduled', created_by: editor.user.id }, { onConflict: 'publish_date' }).select().single()
    if (queryError) throw queryError
    return json(data, 201)
  }
  return error('Unknown editor route', 404)
}

async function validateForPublication(client: any, puzzleId: string) {
  const failures: string[] = []
  const { data: puzzle } = await client.from('puzzles').select('*').eq('id', puzzleId).maybeSingle()
  if (!puzzle) return { valid: false, failures: ['Puzzle not found'] }
  const { data: edges } = await client.from('causal_edges').select('*').eq('puzzle_id', puzzleId)
  const { data: nodes } = await client.from('event_nodes').select('media_asset_id').eq('puzzle_id', puzzleId)
  const edgeRows = edges ?? []
  if (edgeRows.length < 3 || edgeRows.length > 6) failures.push('Chain must contain 3–6 edges')
  const { data: edgeSources } = edgeRows.length ? await client.from('edge_sources').select('edge_id').in('edge_id', edgeRows.map((edge: DbRow) => edge.id)) : { data: [] }
  for (const edge of edgeRows) {
    if (!(edgeSources ?? []).some((row: DbRow) => row.edge_id === edge.id)) failures.push(`Edge ${edge.step_index + 1} has no source`)
    if (!edge.relationship_type) failures.push(`Edge ${edge.step_index + 1} has no relationship type`)
    if (!edge.confidence) failures.push(`Edge ${edge.step_index + 1} has no confidence`) 
    if (!edge.explanation?.trim()) failures.push(`Edge ${edge.step_index + 1} has no explanation`)
    const { data: choices } = await client.from('choice_options').select('is_correct, rejection_copy').eq('edge_id', edge.id)
    const decoys = (choices ?? []).filter((choice: DbRow) => !choice.is_correct)
    if (decoys.length < 2 || decoys.some((choice: DbRow) => !choice.rejection_copy?.trim())) failures.push(`Edge ${edge.step_index + 1} needs two decoys with rejection copy`)
    if (!edge.reviewer_id || !edge.reviewed_at) failures.push(`Edge ${edge.step_index + 1} is not reviewer-approved`)
  }
  const mediaIds = (nodes ?? []).map((node: DbRow) => node.media_asset_id).filter(Boolean)
  if (mediaIds.length !== (nodes ?? []).length) failures.push('Every event needs a media asset')
  if (mediaIds.length) {
    const { data: media } = await client.from('media_assets').select('id, source_url, license, credit, alt_text').in('id', mediaIds)
    for (const asset of media ?? []) {
      if (!asset.source_url || !asset.license || !asset.credit || !asset.alt_text?.trim()) failures.push(`Media ${asset.id} is missing attribution or alt text`)
    }
  }
  return { valid: failures.length === 0, failures }
}

async function handlePublic(request: Request, segments: string[]) {
  const client = serviceClient()
  if (request.method === 'GET' && segments[1] === 'daily') return json(await dailyPuzzle(client))
  if (request.method === 'GET' && segments[1] === 'puzzles' && segments.length === 2) return json(await publishedPuzzles(client))
  if (request.method === 'GET' && segments[1] === 'puzzles' && segments[2]) {
    const { data: puzzle } = await client.from('puzzles').select('*').eq('slug', segments[2]).eq('status', 'published').maybeSingle()
    return puzzle ? json(await loadPuzzle(client, puzzle)) : error('Puzzle not found', 404)
  }
  if (request.method === 'POST' && segments[1] === 'attempts') {
    const body = await request.json()
    const { data: puzzle } = await client.from('puzzles').select('id').eq('id', body.puzzleId).eq('status', 'published').maybeSingle()
    if (!puzzle) return error('Published puzzle not found', 404)
    const sessionKey = body.sessionKey ?? crypto.randomUUID()
    const { data, error: queryError } = await client.from('attempts').insert({ puzzle_id: puzzle.id, session_key: sessionKey }).select('id, puzzle_id, current_step, mistakes, hints_used, started_at, status, session_key').single()
    if (queryError) throw queryError
    return json({ id: data.id, puzzleId: data.puzzle_id, stepIndex: data.current_step, mistakes: data.mistakes, hints: data.hints_used, firstTry: true, startedAt: data.started_at, completed: data.status === 'completed', sessionKey: data.session_key }, 201)
  }
  if (request.method === 'POST' && segments[1] === 'attempts' && segments[3] === 'answers') {
    const attemptId = segments[2]
    const body = await request.json()
    const { data: attempt } = await client.from('attempts').select('*').eq('id', attemptId).maybeSingle()
    if (!attempt || attempt.status !== 'active') return error('Attempt is unavailable', 404)
    const { data: edge } = await client.from('causal_edges').select('*').eq('id', body.stepId).eq('puzzle_id', attempt.puzzle_id).maybeSingle()
    const { data: choice } = await client.from('choice_options').select('is_correct, rejection_copy').eq('id', body.choiceId).eq('edge_id', body.stepId).maybeSingle()
    if (!edge || !choice) return error('Answer is not valid for this step', 422)
    const correct = Boolean(choice.is_correct)
    await client.from('attempt_answers').insert({ attempt_id: attemptId, edge_id: edge.id, choice_id: body.choiceId, is_correct: correct })
    const nextStep = correct ? attempt.current_step + 1 : attempt.current_step
    const { count: edgeCount } = await client.from('causal_edges').select('id', { count: 'exact', head: true }).eq('puzzle_id', attempt.puzzle_id)
    const completed = correct && nextStep >= (edgeCount ?? 0)
    const update = { current_step: nextStep, mistakes: attempt.mistakes + (correct ? 0 : 1), status: completed ? 'completed' : 'active', completed_at: completed ? new Date().toISOString() : null }
    await client.from('attempts').update(update).eq('id', attemptId)
    return json({ correct, explanation: correct ? edge.explanation : choice.rejection_copy, bridge: correct ? edge.explanation : null, nextStep, completed })
  }
  if (request.method === 'POST' && segments[1] === 'attempts' && segments[3] === 'hints') {
    const attemptId = segments[2]
    const { data: attempt } = await client.from('attempts').select('puzzle_id, current_step, hints_used, status').eq('id', attemptId).maybeSingle()
    if (!attempt || attempt.status !== 'active') return error('Attempt is unavailable', 404)
    const { data: edge } = await client.from('causal_edges').select('id').eq('puzzle_id', attempt.puzzle_id).eq('step_index', attempt.current_step).maybeSingle()
    const { data: hint } = edge ? await client.from('hints').select('hint_text, penalty').eq('edge_id', edge.id).maybeSingle() : { data: null }
    if (!hint) return error('No hint is available', 404)
    await client.from('attempts').update({ hints_used: attempt.hints_used + 1 }).eq('id', attemptId)
    return json({ hint: hint.hint_text, penalty: hint.penalty })
  }
  if (request.method === 'GET' && segments[1] === 'attempts' && segments[3] === 'result') {
    const { data: attempt } = await client.from('attempts').select('*').eq('id', segments[2]).maybeSingle()
    if (!attempt || attempt.status !== 'completed') return error('Result is not ready', 409)
    const { data: puzzle } = await client.from('puzzles').select('*').eq('id', attempt.puzzle_id).maybeSingle()
    return puzzle ? json({ attempt, puzzle: await loadPuzzle(client, puzzle, true) }) : error('Puzzle not found', 404)
  }
  return error('Unknown route', 404)
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  try {
    const path = new URL(request.url).pathname.replace(/^.*\/functions\/v1\/api\/?/, '')
    const segments = path.split('/').filter(Boolean)
    if (segments[0] === 'editor') return await handleEditor(request, segments)
    return await handlePublic(request, segments)
  } catch (caught) {
    if (caught instanceof Response) return caught
    console.error(caught)
    return error(caught instanceof Error ? caught.message : 'Unexpected API error', 500)
  }
})
