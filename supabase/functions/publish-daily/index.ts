import { error, json, options } from '../_shared/cors.ts'
import { hasCronSecret, serviceClient } from '../_shared/supabase.ts'

type Row = Record<string, any>

async function validatePuzzle(client: any, puzzleId: string) {
  const failures: string[] = []
  const { data: puzzle } = await client.from('puzzles').select('*').eq('id', puzzleId).maybeSingle()
  if (!puzzle) return { valid: false, failures: ['Puzzle not found'] }
  if (!['approved', 'published'].includes(puzzle.status)) failures.push('Puzzle has not passed editorial approval')
  if (puzzle.automated) {
    const { data: verification } = await client.from('automated_verifications').select('*').eq('puzzle_id', puzzleId).eq('status', 'passed').maybeSingle()
    if (!verification || verification.policy_version !== 'two-independent-authoritative-sources-v1') failures.push('Automated case has no current passing verification')
  }
  const { data: edges } = await client.from('causal_edges').select('*').eq('puzzle_id', puzzleId)
  const { data: nodes } = await client.from('event_nodes').select('media_asset_id').eq('puzzle_id', puzzleId)
  if (!edges?.length) failures.push('Puzzle has no causal edges')
  if (puzzle.automated && edges?.length !== 4) failures.push('Automated puzzle must contain exactly four causal edges')
  if (puzzle.automated && nodes?.length !== 5) failures.push('Automated puzzle must contain exactly five events')
  const { data: edgeSources } = edges?.length ? await client.from('edge_sources').select('edge_id, source_id').in('edge_id', edges.map((edge: Row) => edge.id)) : { data: [] }
  const sourceIds = [...new Set((edgeSources ?? []).map((source: Row) => source.source_id))]
  const { data: sources } = sourceIds.length ? await client.from('sources').select('id, domain, discovery_only').in('id', sourceIds) : { data: [] }
  for (const edge of edges ?? []) {
    if (puzzle.automated) {
      const linked = (edgeSources ?? []).filter((source: Row) => source.edge_id === edge.id)
      const linkedSources = linked.map((item: Row) => (sources ?? []).find((source: Row) => source.id === item.source_id)).filter(Boolean)
      const qualifying = linkedSources.filter((source: Row) => source.domain && !source.discovery_only && source.domain !== 'wikipedia.org' && !source.domain.endsWith('.wikipedia.org'))
      if (new Set(qualifying.map((source: Row) => source.domain)).size < 2) failures.push('Automated edge lacks two independent qualifying sources')
      if (linkedSources.some((source: Row) => source.discovery_only)) failures.push('Automated edge cites discovery-only evidence')
      if (edge.confidence === 'debated' || edge.confidence === 'rejected') failures.push('Automated edge is disputed or rejected')
    }
    if (!(edgeSources ?? []).some((source: Row) => source.edge_id === edge.id)) failures.push(`Edge ${edge.step_index + 1} is missing a source`)
    if (!edge.relationship_type || !edge.confidence || !edge.explanation?.trim()) failures.push(`Edge ${edge.step_index + 1} is missing causal review fields`)
    if (!edge.reviewer_id || !edge.reviewed_at) failures.push(`Edge ${edge.step_index + 1} has no reviewer approval`)
    const { data: choices } = await client.from('choice_options').select('is_correct, rejection_copy').eq('edge_id', edge.id)
    const decoys = (choices ?? []).filter((choice: Row) => !choice.is_correct)
    if ((choices ?? []).length !== 3 || (choices ?? []).filter((choice: Row) => choice.is_correct).length !== 1) failures.push('Each edge must have exactly three choices and one correct answer')
    if (decoys.length < 2 || decoys.some((choice: Row) => !choice.rejection_copy?.trim())) failures.push(`Edge ${edge.step_index + 1} needs two explained decoys`)
  }
  const mediaIds = (nodes ?? []).map((node: Row) => node.media_asset_id).filter(Boolean)
  if (!mediaIds.length || mediaIds.length !== (nodes ?? []).length) failures.push('Every event must have media metadata')
  if (mediaIds.length) {
    const { data: media } = await client.from('media_assets').select('id, source_url, license, credit, alt_text').in('id', mediaIds)
    for (const asset of media ?? []) if (!asset.source_url || !asset.license || !asset.credit || !asset.alt_text?.trim()) failures.push(`Media ${asset.id} is missing attribution or alt text`)
  }
  const finalFailures = puzzle.automated ? failures.filter((failure) => !failure.includes('has no reviewer approval')) : failures
  return { valid: finalFailures.length === 0, failures: finalFailures }
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
    let automatedArchiveIds: string[] = []
    if (!selected) {
      const { data: candidates, error: candidateError } = await client.from('puzzles').select('*').eq('status', 'approved').eq('automated', true).not('automated_verification_id', 'is', null).order('created_at').limit(30)
      if (candidateError) throw candidateError
      const passing: Row[] = []
      for (const puzzle of candidates ?? []) if ((await validatePuzzle(client, puzzle.id)).valid) passing.push(puzzle)
      if (passing.length) { selected = passing[0]; automatedArchiveIds = passing.slice(1, 5).map((puzzle: Row) => puzzle.id) }
    }
    if (selected && status === 'published' && automatedArchiveIds.length === 0) {
      const { data: archiveCandidates, error: archiveError } = await client.from('puzzles').select('*').eq('status', 'approved').eq('automated', true).not('automated_verification_id', 'is', null).order('created_at').limit(30)
      if (archiveError) throw archiveError
      const passingArchive: Row[] = []
      for (const puzzle of archiveCandidates ?? []) if (puzzle.id !== selected.id && (await validatePuzzle(client, puzzle.id)).valid) passingArchive.push(puzzle)
      automatedArchiveIds = passingArchive.slice(0, 4).map((puzzle: Row) => puzzle.id)
    }
    if (!selected) {
      const { data: fallbacks } = await client.from('puzzles').select('*').eq('status', 'approved').eq('is_fallback', true).order('puzzle_number')
      const fallback = await findValidPuzzle(client, fallbacks ?? [])
      selected = fallback.puzzle
      status = 'fallback'
      reason = [...approved.validation.failures, ...fallback.validation.failures].join('; ')
    }
    if (!selected) return json({ ok: false, published: false, date: targetDate, failures: [reason ?? 'No fallback puzzle available'] }, 422)
    const publishedAt = new Date().toISOString()
    await client.from('puzzles').update({ status: 'published', published_at: publishedAt }).eq('id', selected.id)
    for (const puzzleId of automatedArchiveIds) {
      await client.from('puzzles').update({ status: 'published', published_at: publishedAt }).eq('id', puzzleId)
      await client.from('automated_verifications').update({ published_at: publishedAt }).eq('puzzle_id', puzzleId).eq('status', 'passed')
      await client.from('revisions').insert({ entity_type: 'puzzle', entity_id: puzzleId, action: 'automatically_published_to_archive', snapshot: { publish_date: targetDate, automated: true } })
    }
    if (selected.automated) await client.from('automated_verifications').update({ published_at: publishedAt }).eq('puzzle_id', selected.id).eq('status', 'passed')
    await client.from('revisions').insert({ entity_type: 'puzzle', entity_id: selected.id, action: selected.automated ? 'automatically_published_daily' : 'published_daily', snapshot: { publish_date: targetDate, automated: Boolean(selected.automated), archive_case_ids: automatedArchiveIds } })
    const { data: slot, error: slotError } = await client.from('publication_slots').upsert({ puzzle_id: selected.id, publish_date: targetDate, status, fallback_reason: reason, published_at: publishedAt }, { onConflict: 'publish_date' }).select().single()
    if (slotError) throw slotError
    return json({ ok: true, published: true, date: targetDate, puzzleId: selected.id, automated: Boolean(selected.automated), archivePuzzleIds: automatedArchiveIds, publishedCount: 1 + automatedArchiveIds.length, status, slot, fallbackReason: reason })
  } catch (caught) {
    console.error(caught)
    return error(caught instanceof Error ? caught.message : 'Publication job failed', 500)
  }
})
