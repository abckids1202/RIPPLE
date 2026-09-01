import type { EditorialReview, ResearchCandidate } from './atlas'

export const editorCandidates: ResearchCandidate[] = [
  {
    id: 'candidate-london-smog',
    title: 'The fog that changed a city’s air laws',
    hook: 'A weather inversion. A public health act. A new way to see pollution.',
    category: 'Environment & policy',
    status: 'Needs review',
    sourceCount: 6,
    mediaCount: 3,
    confidence: 'High',
    createdAt: '2026-08-31',
    seedQuestion: 'How did a week of toxic air lead to a new kind of environmental law?',
    notes: 'Strong primary-source trail. Needs a shorter middle link and a public-domain photograph with clear credit.',
  },
  {
    id: 'candidate-paperclip',
    title: 'The failed fastener that became office infrastructure',
    hook: 'A patent dispute. A bent wire. The object holding a desk together.',
    category: 'Design & work',
    status: 'Researching',
    sourceCount: 4,
    mediaCount: 1,
    confidence: 'Medium',
    createdAt: '2026-08-30',
    seedQuestion: 'How did a patent race make the paperclip look inevitable?',
    notes: 'The origin story is contested. Keep as a source-detective candidate until the relationship language is narrowed.',
  },
  {
    id: 'candidate-frankenstein',
    title: 'A volcanic summer writes a monster',
    hook: 'Grey skies in Switzerland. A ghost-story challenge. A book that outlives the weather.',
    category: 'Climate & culture',
    status: 'New',
    sourceCount: 8,
    mediaCount: 4,
    confidence: 'Medium',
    createdAt: '2026-08-29',
    seedQuestion: 'How did the weather after Tambora help create Frankenstein?',
    notes: 'Excellent retellability. Must distinguish “contributed to” from “caused” and credit the literary scholarship.',
  },
]

export const defaultEditorialReview = (candidate: ResearchCandidate): EditorialReview => ({
  id: `review-${candidate.id}`,
  candidateId: candidate.id,
  reviewer: 'Editorial desk',
  status: 'Draft',
  checklist: {
    'Every edge has a source': candidate.sourceCount > 0,
    'Causal language is calibrated': candidate.confidence !== 'Debated',
    'Decoys are plausible': false,
    'Media license and credit recorded': candidate.mediaCount > 0,
    'Alt text is written': candidate.mediaCount > 0,
    'Blind playtest complete': false,
  },
})
