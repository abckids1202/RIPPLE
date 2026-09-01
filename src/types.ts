export type Attempt = {
  id?: string
  puzzleId: string
  chain: string[]
  stepIndex: number
  mistakes: number
  hints: number
  firstTry: number
  wrongChoices: string[]
  hintSteps: string[]
  startedAt: number
  completed?: boolean
  sessionKey?: string
}
