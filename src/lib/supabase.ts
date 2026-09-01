export type SupabaseConfig = {
  url: string
  anonKey: string
}

export const supabaseConfig: SupabaseConfig | null = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? { url: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY }
  : null

export const isSupabaseConfigured = Boolean(supabaseConfig)

export const supabaseHeaders = (accessToken?: string): HeadersInit => ({
  apikey: supabaseConfig?.anonKey ?? '',
  Authorization: `Bearer ${accessToken ?? supabaseConfig?.anonKey ?? ''}`,
  'Content-Type': 'application/json',
})

export async function supabaseFunction<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseConfig) throw new Error('Supabase is not configured')
  const response = await fetch(`${supabaseConfig.url}/functions/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers: { ...supabaseHeaders(), ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`)
  return response.json() as Promise<T>
}

