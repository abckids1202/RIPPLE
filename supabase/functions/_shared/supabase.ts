import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
export const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
export const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

export function serviceClient() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server environment is incomplete')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function editorFromRequest(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !anonKey) return null
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: userData } = await authClient.auth.getUser(token)
  if (!userData.user) return null
  const { data: profile } = await serviceClient().from('editor_profiles').select('user_id, display_name, role').eq('user_id', userData.user.id).maybeSingle()
  return profile ? { user: userData.user, profile } : null
}

export function hasCronSecret(request: Request) {
  const expected = Deno.env.get('RIPPLE_CRON_SECRET')
  if (!expected) return false
  const provided = request.headers.get('x-ripple-cron') ?? request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  return provided === expected
}
