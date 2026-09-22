import type { Attempt } from '../types'
import type { Choice, Puzzle, Source, Step } from '../data/puzzles'
import { isSupabaseConfigured, supabaseFunction } from './supabase'

/** Public payloads intentionally omit answer keys until an answer is posted. */
export type SafeChoice = Omit<Choice, 'correct' | 'whyWrong'> & { answerId: string }
export type SafeStep = Omit<Step, 'choices'> & { choices: SafeChoice[]; source: Source }
export type SafePuzzlePayload = Omit<Puzzle, 'steps'> & { steps: SafeStep[]; revealedStep?: number }

export type AnswerResponse = { correct: boolean; explanation: string; bridge: string | null; nextStep: number; completed: boolean }

export const rippleApi = {
  async getDaily(): Promise<SafePuzzlePayload | null> {
    if (!isSupabaseConfigured) return null
    try { return await supabaseFunction<SafePuzzlePayload>('api/daily') } catch { return null }
  },
  async getPuzzles(): Promise<SafePuzzlePayload[] | null> {
    if (!isSupabaseConfigured) return null
    try { return await supabaseFunction<SafePuzzlePayload[]>('api/puzzles') } catch { return null }
  },
  async getPuzzle(slug: string): Promise<SafePuzzlePayload | null> {
    if (!isSupabaseConfigured) return null
    try { return await supabaseFunction<SafePuzzlePayload>(`api/puzzles/${encodeURIComponent(slug)}`) } catch { return null }
  },
  async createAttempt(puzzleId: string): Promise<Attempt | null> {
    if (!isSupabaseConfigured) return null
    try { return await supabaseFunction<Attempt>('api/attempts', { method: 'POST', body: JSON.stringify({ puzzleId }) }) } catch { return null }
  },
  async submitAnswer(attemptId: string, stepId: string, choiceId: string): Promise<AnswerResponse | null> {
    if (!isSupabaseConfigured) return null
    try { return await supabaseFunction<AnswerResponse>(`api/attempts/${attemptId}/answers`, { method: 'POST', body: JSON.stringify({ stepId, choiceId }) }) } catch { return null }
  },
  async requestHint(attemptId: string) {
    if (!isSupabaseConfigured) return null
    try { return await supabaseFunction<{ hint: string; penalty: number }>(`api/attempts/${attemptId}/hints`, { method: 'POST' }) } catch { return null }
  },
}
