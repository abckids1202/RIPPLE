import type { Puzzle } from '../data/puzzles'

export type ValidationResult = { label: string; passed: boolean; detail: string }

export function validatePuzzle(puzzle: Puzzle): ValidationResult[] {
  return [
    { label: 'Chain has 3–6 links', passed: puzzle.steps.length >= 3 && puzzle.steps.length <= 6, detail: `${puzzle.steps.length} links in this draft` },
    { label: 'Every edge has a source', passed: puzzle.steps.every((step) => Boolean(step.source.url)), detail: `${puzzle.steps.filter((step) => step.source.url).length}/${puzzle.steps.length} edges sourced` },
    { label: 'Relationship labels are calibrated', passed: puzzle.steps.every((step) => Boolean(step.relationship)), detail: 'Each bridge names the type of influence' },
    { label: 'Each step has plausible decoys', passed: puzzle.steps.every((step) => step.choices.filter((choice) => !choice.correct && choice.whyWrong).length >= 2), detail: 'Decoys include rejection copy' },
    { label: 'Takeaway is present', passed: puzzle.takeaway.trim().length > 40, detail: 'The result teaches one retellable idea' },
  ]
}
