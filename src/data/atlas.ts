import type { Puzzle } from './puzzles'

export type Confidence = 'High' | 'Medium' | 'Debated' | 'Rejected'
export type MediaKind = 'photo' | 'scan' | 'map' | 'audio' | 'web'

export type Annotation = {
  id: string
  label: string
  note: string
  x: number
  y: number
  tone: 'coral' | 'gold' | 'blue' | 'mint'
}

export type MediaAsset = {
  id: string
  kind: MediaKind
  imageUrl?: string
  sourceUrl: string
  license: string
  credit: string
  alt: string
  focalPoint?: { x: number; y: number }
  annotations?: Annotation[]
}

export type EventNode = {
  id: string
  puzzleId: string
  title: string
  detail: string
  year: string
  mediaAssetId?: string
  sortOrder: number
}

export type CausalEdge = {
  id: string
  puzzleId: string
  fromEventId: string
  toEventId: string
  relationshipType: string
  confidence: Confidence
  explanation: string
  sourceIds: string[]
}

export type ResearchCandidate = {
  id: string
  title: string
  hook: string
  category: string
  status: 'New' | 'Researching' | 'Needs review' | 'Approved' | 'Rejected'
  sourceCount: number
  mediaCount: number
  confidence: Confidence
  createdAt: string
  seedQuestion: string
  notes: string
}

export type EditorialReview = {
  id: string
  candidateId: string
  reviewer: string
  status: 'Draft' | 'Approved' | 'Changes requested' | 'Rejected'
  checklist: Record<string, boolean>
  note?: string
  reviewedAt?: string
}

export type PublicationSlot = {
  id: string
  puzzleId: string
  publishDate: string
  timezone: 'UTC'
  status: 'Scheduled' | 'Published' | 'Fallback'
}

const commonsFile = (filename: string, width = 1400) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`

const tamboraAsset: MediaAsset = {
  id: 'media-tambora-caldera',
  kind: 'map',
  imageUrl: commonsFile('Tambora volcano.jpg'),
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tambora_volcano.jpg',
  license: 'Public domain · NASA Landsat',
  credit: 'NASA Landsat / Wikimedia Commons',
  alt: 'Aerial view of Mount Tambora’s broad caldera on Sumbawa Island.',
  focalPoint: { x: 52, y: 50 },
  annotations: [
    { id: 'caldera', label: '6 km caldera', note: 'The crater left by the 1815 eruption.', x: 55, y: 52, tone: 'coral' },
    { id: 'sumbawa', label: 'Sumbawa / ID', note: 'The eruption began here, not in Europe.', x: 22, y: 72, tone: 'gold' },
    { id: 'ash', label: 'Atmospheric trace', note: 'The invisible bridge is the material carried into the sky.', x: 75, y: 27, tone: 'blue' },
  ],
}

const draisAsset: MediaAsset = {
  id: 'media-drais',
  kind: 'scan',
  imageUrl: commonsFile('Drais.jpeg', 900),
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Drais.jpeg',
  license: 'Public domain · historical lithograph',
  credit: 'Unknown author / Wikimedia Commons',
  alt: 'Historical lithograph of Karl Drais riding his early two-wheeled machine.',
  focalPoint: { x: 50, y: 44 },
  annotations: [
    { id: 'balance', label: 'Steerable frame', note: 'Drais solved balance and direction before pedals existed.', x: 51, y: 50, tone: 'mint' },
  ],
}

const postItAsset: MediaAsset = {
  id: 'media-post-it',
  kind: 'photo',
  imageUrl: commonsFile('Post_it_notes.jpg', 1200),
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Post_it_notes.jpg',
  license: 'Public domain · self-published',
  credit: 'EraserGirl / Wikimedia Commons',
  alt: 'Colorful removable notes attached to a wall.',
  focalPoint: { x: 52, y: 46 },
  annotations: [
    { id: 'adhesive', label: 'Removable grip', note: 'The “weakness” became the product feature.', x: 68, y: 54, tone: 'gold' },
  ],
}

const flemingAsset: MediaAsset = {
  id: 'media-fleming',
  kind: 'photo',
  imageUrl: commonsFile('Professor Alexander Fleming at work in his laboratory at St Mary\'s Hospital, London, during the Second World War. D17801 (cropped).jpg', 1100),
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Professor_Alexander_Fleming_at_work_in_his_laboratory_at_St_Mary%27s_Hospital,_London,_during_the_Second_World_War._D17801_(cropped).jpg',
  license: 'Public domain · UK Government photograph',
  credit: 'Ministry of Information Photo Division / Wikimedia Commons',
  alt: 'Alexander Fleming working at a laboratory bench during the Second World War.',
  focalPoint: { x: 51, y: 47 },
  annotations: [
    { id: 'plate', label: 'The overlooked plate', note: 'A ring where bacteria failed to grow became the clue.', x: 34, y: 57, tone: 'mint' },
    { id: 'bench', label: 'LAB / 1928', note: 'The breakthrough began as an observation, not a finished drug.', x: 78, y: 20, tone: 'blue' },
  ],
}

const abstractAsset = (id: string, kind: MediaKind, alt: string, label: string): MediaAsset => ({
  id,
  kind,
  sourceUrl: 'https://commons.wikimedia.org/',
  license: 'Editorial placeholder · replace before publication',
  credit: 'RIPPLE evidence desk',
  alt,
  annotations: [{ id: 'signal', label, note: 'A media slot ready for a reviewed archive image.', x: 50, y: 48, tone: 'coral' }],
})

const atlasByPuzzle: Record<string, { featured: MediaAsset; eventMedia: Record<string, MediaAsset> }> = {
  'tambora-to-bicycle': {
    featured: tamboraAsset,
    eventMedia: {
      tambora: tamboraAsset,
      'year-without-summer': tamboraAsset,
      'crop-failures': abstractAsset('media-crop-fields', 'map', 'A field-note illustration representing crop failures after abnormal weather.', '1816 / HARVEST'),
      'horse-shortage': abstractAsset('media-horse-fodder', 'map', 'An illustrated evidence plate about fodder shortages and transport.', 'OATS / SCARCE'),
      'drais-machine': draisAsset,
    },
  },
  'glue-to-post-it': {
    featured: postItAsset,
    eventMedia: {
      microspheres: abstractAsset('media-adhesive-spheres', 'scan', 'An annotated adhesive evidence plate.', 'MICROSPHERES'),
      bookmark: abstractAsset('media-bookmark', 'scan', 'An annotated bookmark evidence plate.', 'FIRST USE'),
      sampler: postItAsset,
      'post-it': postItAsset,
    },
  },
  'mold-to-penicillin': {
    featured: flemingAsset,
    eventMedia: {
      'mold-plate': flemingAsset,
      inhibition: flemingAsset,
      'penicillin-drug': flemingAsset,
      penicillin: flemingAsset,
    },
  },
  'drum-break-to-hip-hop': {
    featured: abstractAsset('media-amen-break', 'audio', 'An annotated record sleeve representing the Amen break.', '04 BARS / 1969'),
    eventMedia: {
      'amen-break': abstractAsset('media-amen-break', 'audio', 'An annotated record sleeve representing the Amen break.', '04 BARS / 1969'),
      'break-djs': abstractAsset('media-dj-break', 'audio', 'An annotated DJ evidence plate.', 'EXTEND / REPEAT'),
      sampling: abstractAsset('media-sampler', 'audio', 'An annotated sampler evidence plate.', 'SAMPLE / TRIGGER'),
      breakbeat: abstractAsset('media-breakbeat', 'audio', 'An annotated breakbeat evidence plate.', 'RHYTHM / GLOBAL'),
    },
  },
  'mistranslation-to-meme': {
    featured: abstractAsset('media-zero-wing', 'web', 'An annotated web-culture evidence plate.', 'TEXT / REMIX'),
    eventMedia: {
      'zero-wing': abstractAsset('media-zero-wing', 'web', 'An annotated web-culture evidence plate.', 'TEXT / REMIX'),
      screenshots: abstractAsset('media-screenshot', 'web', 'An annotated screenshot evidence plate.', 'COPY / PASTE'),
      remixes: abstractAsset('media-remix', 'web', 'An annotated remix evidence plate.', 'EDIT / SHARE'),
      'meme-culture': abstractAsset('media-meme', 'web', 'An annotated meme-culture evidence plate.', 'CONTEXT / OPTIONAL'),
    },
  },
}

export const atlasForPuzzle = (puzzle: Puzzle) => atlasByPuzzle[puzzle.id] ?? atlasByPuzzle[dailyPuzzleFallbackId]
export const mediaForEvent = (puzzle: Puzzle, eventId: string) => atlasForPuzzle(puzzle).eventMedia[eventId] ?? atlasForPuzzle(puzzle).featured
export const dailyPuzzleFallbackId = 'tambora-to-bicycle'

