import { error, json, options } from '../_shared/cors.ts'
import { hasCronSecret, serviceClient } from '../_shared/supabase.ts'

type Row = Record<string, any>
const MODEL = Deno.env.get('RIPPLE_RESEARCH_MODEL') ?? 'gpt-5-mini'
const PROMPT_VERSION = 'ripple-case-v1'
const POLICY_VERSION = 'two-independent-authoritative-sources-v1'
const RESERVATION = Number(Deno.env.get('RIPPLE_AI_MAX_CASE_RESERVATION_USD') ?? '0.10')

function canonicalize(value: string) { const url = new URL(value); url.hash = ''; for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|fbclid$)/i.test(key)) url.searchParams.delete(key); return url.toString().replace(/\/$/, '') }
function allowed(host: string, domains: string[]) { return domains.some((domain) => host === domain || host.endsWith('.' + domain)) }
function sourceClass(host: string) { if (/\.gov$/.test(host)) return 'government'; if (/\.edu$/.test(host)) return 'university'; if (/museum|si\.edu/.test(host)) return 'museum'; if (/archive|loc\.gov/.test(host)) return 'archive'; return 'other' }

async function readBoundedText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Source response has no body')
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < maxBytes) {
    const part = await reader.read()
    if (part.done) break
    const remaining = maxBytes - size
    const chunk = part.value.length > remaining ? part.value.slice(0, remaining) : part.value
    chunks.push(chunk); size += chunk.length
    if (chunk.length < part.value.length) { await reader.cancel(); break }
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(bytes)
}

async function fetchSource(value: string, domains: string[]) {
  let url = new URL(value)
  if (url.protocol !== 'https:' || !allowed(url.hostname.toLowerCase(), domains)) throw new Error('Source outside HTTPS allowlist')
  let response: Response | undefined
  for (let n = 0; n <= 3; n++) { response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { Accept: 'text/html,text/plain' } }); if (![301,302,303,307,308].includes(response.status)) break; const location = response.headers.get('location'); if (!location || n === 3) throw new Error('Unsafe redirect'); url = new URL(location, url); if (url.protocol !== 'https:' || !allowed(url.hostname.toLowerCase(), domains)) throw new Error('Redirect outside allowlist') }
  if (!response?.ok || !/(text\/html|text\/plain|application\/xhtml)/i.test(response.headers.get('content-type') ?? '')) throw new Error('Source not fetchable as text')
  const html = await readBoundedText(response, 800000)
  const excerpt = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&quot;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 8500)
  if (excerpt.length < 700) throw new Error('Insufficient readable source text')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(excerpt)); const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join(''); const host = new URL(url).hostname.toLowerCase()
  return { canonical_url: canonicalize(url.toString()), title: host, publisher: host, domain: host, source_class: sourceClass(host), discovery_only: false, excerpt, content_hash: hash }
}

async function search(candidate: Row, domains: string[]) {
  const key = Deno.env.get('BRAVE_SEARCH_API_KEY'); if (!key) throw new Error('BRAVE_SEARCH_API_KEY missing')
  const batches = await Promise.all(domains.slice(0, 6).map(async (domain) => {
    const params = new URLSearchParams({ q: (candidate.title + ' ' + (candidate.hook ?? '') + ' site:' + domain).slice(0, 400), count: '5', safesearch: 'moderate' })
    try { const response = await fetch('https://api.search.brave.com/res/v1/web/search?' + params, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json', 'X-Subscription-Token': key } }); return response.ok ? await response.json() : null } catch { return null }
  }))
  const found = new Map<string, Row>()
  for (const body of batches) for (const result of body?.web?.results ?? []) try { const url = canonicalize(result.url); const host = new URL(url).hostname.toLowerCase(); if (allowed(host, domains) && !host.endsWith('wikipedia.org')) found.set(url, { url, title: result.title ?? host }) } catch { /* ignore malformed leads */ }
  return [...found.values()].slice(0, 7)
}

const caseSchema = { type:'object',additionalProperties:false,properties:{slug:{type:'string'},category:{type:'string'},difficulty:{type:'string',enum:['Easy','Standard','Hard']},duration:{type:'string'},hook:{type:'string'},question:{type:'string'},takeaway:{type:'string'},events:{type:'array',minItems:5,maxItems:5,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},detail:{type:'string'},year:{type:'string'},icon:{type:'string'}},required:['title','detail','year','icon']}},edges:{type:'array',minItems:4,maxItems:4,items:{type:'object',additionalProperties:false,properties:{question:{type:'string'},relationship:{type:'string',enum:['caused','enabled','contributed','accelerated','inspired','popularized','responded']},confidence:{type:'string',enum:['high','medium']},explanation:{type:'string'},source_indexes:{type:'array',minItems:2,items:{type:'integer'}},decoys:{type:'array',minItems:2,maxItems:2,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},detail:{type:'string'},year:{type:'string'},rejection:{type:'string'}},required:['title','detail','year','rejection']}},hint:{type:'string'}},required:['question','relationship','confidence','explanation','source_indexes','decoys','hint']} }},required:['slug','category','difficulty','duration','hook','question','takeaway','events','edges'] }
const auditSchema = { type:'object',additionalProperties:false,properties:{accepted:{type:'boolean'},findings:{type:'array',items:{type:'string'}},edges:{type:'array',minItems:4,maxItems:4,items:{type:'object',additionalProperties:false,properties:{supported:{type:'boolean'},disputed:{type:'boolean'},source_indexes:{type:'array',minItems:2,items:{type:'integer'}}},required:['supported','disputed','source_indexes']}}},required:['accepted','findings','edges'] }
async function askAi(input: string, schema: Row) { const key = Deno.env.get('OPENAI_API_KEY'); if (!key) throw new Error('OPENAI_API_KEY missing'); const response = await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(40000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,store:false,input,max_output_tokens:2000,text:{format:{type:'json_schema',name:'ripple_case',strict:true,schema}}})}); const body=await response.json(); if(!response.ok)throw new Error('AI request failed ('+response.status+')');const text=body.output?.flatMap((item:Row)=>item.content??[]).find((part:Row)=>part.type==='output_text')?.text;if(!text)throw new Error('AI returned no structured output');return {value:JSON.parse(text),usage:body.usage??{}} }

Deno.serve(async (request) => {
  const preflight=options(request); if(preflight)return preflight; if(!hasCronSecret(request))return error('Cron authentication required',401)
  const db=serviceClient(); let month:string|null=null; let held=false; let actual=0; let candidate:Row|null=null; let runId:string|null=null; let terminalRejection=false
  try {
    const budget=Number(Deno.env.get('RIPPLE_AI_MONTHLY_BUDGET_USD')??'0'),inRate=Number(Deno.env.get('RIPPLE_AI_INPUT_USD_PER_MILLION')??'0'),outRate=Number(Deno.env.get('RIPPLE_AI_OUTPUT_USD_PER_MILLION')??'0')
    if(!(budget>0&&RESERVATION>0&&inRate>0&&outRate>0&&Deno.env.get('OPENAI_API_KEY')))return json({ok:true,paused:true,reason:'Configure AI key, monthly budget, token rates and reservation; no AI work started.'})
    const date=new Date();month=date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0')+'-01';const reserved=await db.rpc('reserve_research_ai_budget',{p_month:month,p_budget:budget,p_reservation:RESERVATION});if(reserved.error)throw reserved.error;if(!reserved.data)return json({ok:true,paused:true,reason:'Monthly AI budget cap reached.'});held=true
    const claim=await db.rpc('claim_next_research_candidate',{p_lease_seconds:240});if(claim.error)throw claim.error;const claimed=claim.data?.[0];if(!claimed){await db.rpc('settle_research_ai_budget',{p_month:month,p_reservation:RESERVATION,p_actual:0});held=false;return json({ok:true,processed:false,reason:'No candidates queued.'})}
    const loaded=await db.from('research_candidates').select('*, research_topics(source_domains)').eq('id',claimed.candidate_id).single();if(loaded.error)throw loaded.error;candidate=loaded.data;if(!candidate)throw new Error('Claimed candidate could not be loaded')
    const attempt=claimed.attempt
    const domains=(candidate.research_topics?.source_domains??[]).filter((d:unknown)=>typeof d==='string'&&!/wikipedia\.org$/i.test(String(d))).map((d:string)=>d.toLowerCase());if(!domains.length)throw new Error('No curated source domains')
    const run=await db.from('research_job_runs').insert({idempotency_key:candidate.id+':attempt:'+attempt,candidate_id:candidate.id,stage:'verify',status:'running',model:MODEL,prompt_version:PROMPT_VERSION}).select('id').single();if(run.error)throw run.error;runId=run.data.id
    const leads=await search(candidate,domains);const fetched=await Promise.all(leads.slice(0,6).map(async(lead)=>{try{return await fetchSource(lead.url,domains)}catch{return null}}));const evidence:Row[]=fetched.filter((item)=>item!==null) as Row[];for(const item of evidence)await db.from('research_evidence').upsert({candidate_id:candidate.id,...item},{onConflict:'candidate_id,canonical_url',ignoreDuplicates:true});if(new Set(evidence.map((e)=>e.domain)).size<2)throw new Error('Fewer than two independent allowlisted sources fetched')
    const corpus=evidence.map((e,i)=>'['+i+'] '+e.publisher+' '+e.source_class+' '+e.canonical_url+' | '+e.excerpt).join(' | ')
    const maximumEstimatedCost=(2*(corpus.length+10000)*inRate+4000*outRate)/1000000;if(maximumEstimatedCost>RESERVATION)throw new Error('Configured per-case reservation is below the conservative maximum estimate; no model request was made')
    const draft=await askAi('Draft an educational causal-chain puzzle using only evidence. Exactly 5 events, 4 edges, exactly 2 plausible decoys per edge. Cite at least 2 distinct source indexes per edge. Avoid disputed causation. Lead: '+candidate.title+' | EVIDENCE: '+corpus,caseSchema);actual+=Number(draft.usage.input_tokens??0)*inRate/1e6+Number(draft.usage.output_tokens??0)*outRate/1e6
    const item=draft.value;if(item.events.length!==5||item.edges.length!==4||item.edges.some((e:Row)=>e.decoys.length!==2||e.source_indexes.length<2||e.source_indexes.some((i:number)=>!evidence[i])||new Set(e.source_indexes.map((i:number)=>evidence[i].domain)).size<2))throw new Error('Draft structure or evidence independence invalid')
    await db.from('research_candidates').update({pipeline_stage:'verifying'}).eq('id',candidate.id)
    const audit=await askAi('Independently fact-check each causal edge against source excerpts; reject unsupported, contradicted, exaggerated, disputed or merely correlated links. Cite two different domains for each. CASE: '+JSON.stringify(item)+' | EVIDENCE: '+corpus,auditSchema);actual+=Number(audit.usage.input_tokens??0)*inRate/1e6+Number(audit.usage.output_tokens??0)*outRate/1e6
    const check=audit.value;const passed=check.accepted===true&&check.edges.length===4&&check.edges.every((e:Row,i:number)=>e.supported&&!e.disputed&&new Set(e.source_indexes.map((n:number)=>evidence[n]?.domain).filter(Boolean)).size>=2&&e.source_indexes.every((n:number)=>item.edges[i].source_indexes.includes(n)))
    if(!passed){await db.from('automated_verifications').insert({candidate_id:candidate.id,status:'failed',policy_version:POLICY_VERSION,model:MODEL,prompt_version:PROMPT_VERSION,findings:check,source_report:evidence.map(({canonical_url,domain,source_class})=>({url:canonical_url,domain,source_class}))});terminalRejection=true;throw new Error('Independent automated audit rejected case')}
    const slug=String(item.slug).toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)+'-'+candidate.id.slice(0,8)+'-a'+attempt;const puzzle=await db.from('puzzles').insert({slug,category:candidate.category,difficulty:item.difficulty,duration:item.duration,hook:item.hook,question:item.question,takeaway:item.takeaway,status:'approved',automated:true,accent:'#df6f5d'}).select().single();if(puzzle.error)throw puzzle.error
    const sourceIds:string[]=[];for(const source of evidence){const saved=await db.from('sources').upsert({title:source.title,publisher:source.publisher,url:source.canonical_url,excerpt:source.excerpt.slice(0,500),domain:source.domain,source_class:source.source_class,discovery_only:false,content_hash:source.content_hash},{onConflict:'url'}).select('id').single();if(saved.error)throw saved.error;sourceIds.push(saved.data.id)}
    const eventIds:string[]=[];for(let i=0;i<5;i++){const e=item.events[i];const media=await db.from('media_assets').insert({kind:'web',source_url:evidence[0].canonical_url,license:'Text-only evidence card; no third-party image',credit:evidence[0].publisher,alt_text:'Evidence note: '+e.title}).select('id').single();if(media.error)throw media.error;const node=await db.from('event_nodes').insert({puzzle_id:puzzle.data.id,node_key:'event-'+i,kind:i===0?'start':i===4?'ending':'step',title:e.title,detail:e.detail,year_label:e.year,icon:e.icon,media_asset_id:media.data.id,sort_order:i}).select('id').single();if(node.error)throw node.error;eventIds.push(node.data.id)}
    for(let i=0;i<4;i++){const e=item.edges[i];const edge=await db.from('causal_edges').insert({puzzle_id:puzzle.data.id,from_event_id:eventIds[i],to_event_id:eventIds[i+1],step_index:i,question:e.question,relationship_type:e.relationship,confidence:e.confidence,explanation:e.explanation}).select('id').single();if(edge.error)throw edge.error;for(const n of [...new Set<number>(e.source_indexes)]){const link=await db.from('edge_sources').insert({edge_id:edge.data.id,source_id:sourceIds[n]});if(link.error)throw link.error}const next=item.events[i+1];const choices=[{title:next.title,detail:next.detail,year_label:next.year,icon:next.icon,event_id:eventIds[i+1],is_correct:true,sort_order:0},...e.decoys.map((d:Row,j:number)=>({title:d.title,detail:d.detail,year_label:d.year,is_correct:false,rejection_copy:d.rejection,sort_order:j+1}))];const opts=await db.from('choice_options').insert(choices.map((c:Row)=>({edge_id:edge.data.id,...c})));if(opts.error)throw opts.error;const hint=await db.from('hints').insert({edge_id:edge.data.id,hint_text:e.hint});if(hint.error)throw hint.error}
    const verification=await db.from('automated_verifications').insert({candidate_id:candidate.id,puzzle_id:puzzle.data.id,status:'passed',policy_version:POLICY_VERSION,model:MODEL,prompt_version:PROMPT_VERSION,findings:check,source_report:evidence.map(({canonical_url,domain,source_class})=>({url:canonical_url,domain,source_class}))}).select('id').single();if(verification.error)throw verification.error
    await db.from('puzzles').update({automated_verification_id:verification.data.id}).eq('id',puzzle.data.id);await db.from('research_candidates').update({status:'approved',pipeline_stage:'verified',draft_puzzle_id:puzzle.data.id,pipeline_lease_until:null,pipeline_error:null}).eq('id',candidate.id);await db.from('revisions').insert({entity_type:'puzzle',entity_id:puzzle.data.id,action:'automated_draft_verified',snapshot:{candidate_id:candidate.id,verification_id:verification.data.id,policy_version:POLICY_VERSION,model:MODEL}});await db.from('research_job_runs').update({status:'succeeded',source_count:evidence.length,estimated_cost_usd:actual,finished_at:new Date().toISOString()}).eq('id',runId)
    return json({ok:true,processed:true,candidateId:candidate.id,puzzleId:puzzle.data.id,automated:true,evidenceCount:evidence.length})
  }catch(caught){const message=caught instanceof Error?caught.message:'Research worker failed';console.error(caught);if(candidate)await db.from('research_candidates').update({status:terminalRejection?'rejected':'researching',pipeline_stage:terminalRejection?'rejected':'evidence_failed',pipeline_lease_until:terminalRejection?null:new Date(Date.now()+Math.min(86400000,900000*Math.pow(2,Math.min(candidate.pipeline_attempts,6)))).toISOString(),pipeline_error:message.slice(0,1500)}).eq('id',candidate.id);if(runId)await db.from('research_job_runs').update({status:'failed',error_message:message.slice(0,1500),finished_at:new Date().toISOString()}).eq('id',runId);return error(message,500)}
  finally{if(held&&month)await db.rpc('settle_research_ai_budget',{p_month:month,p_reservation:RESERVATION,p_actual:actual})}
})
