import { expandedPuzzles } from './expandedPuzzles'

export type Relationship =
  | 'Caused'
  | 'Enabled'
  | 'Contributed'
  | 'Accelerated'
  | 'Inspired'
  | 'Popularized'
  | 'Responded'

export type Event = {
  id: string
  title: string
  detail: string
  year: string
  icon: string
  tone: string
}

export type Choice = Event & {
  correct: boolean
  whyWrong?: string
  answerId?: string
}

export type Step = {
  id: string
  question: string
  bridge: string
  relationship: Relationship
  from: string
  to: string
  choices: Choice[]
  hint: string
  source: Source
}

export type Source = {
  title: string
  publisher: string
  url: string
}

export type Puzzle = {
  id: string
  number: number
  category: string
  difficulty: 'Easy' | 'Standard' | 'Hard'
  duration: string
  hook: string
  question: string
  start: Event
  ending: Event
  steps: Step[]
  takeaway: string
  sources: Source[]
  accent: string
  automated?: boolean
}

const asCorrect = (event: Event): Choice => ({ ...event, correct: true })

const tambora: Event = {
  id: 'tambora',
  title: 'Mount Tambora erupts',
  detail: 'A colossal eruption darkens skies across the globe.',
  year: '1815 · Sumbawa, Indonesia',
  icon: '🌋',
  tone: 'coral',
}

const yearWithoutSummer: Event = {
  id: 'year-without-summer',
  title: 'The year without a summer',
  detail: 'Ash and aerosols cool the Northern Hemisphere.',
  year: '1816 · Global climate',
  icon: '🌫️',
  tone: 'blue',
}

const cropFailures: Event = {
  id: 'crop-failures',
  title: 'Harvests fail across Europe',
  detail: 'Cold rain and frost destroy crops and raise food prices.',
  year: '1816–1817 · Europe',
  icon: '🌾',
  tone: 'gold',
}

const horseShortage: Event = {
  id: 'horse-shortage',
  title: 'Horses become harder to keep',
  detail: 'Fodder shortages make animal-powered travel expensive.',
  year: '1817 · Central Europe',
  icon: '🐴',
  tone: 'ink',
}

const draisMachine: Event = {
  id: 'drais-machine',
  title: 'An early bicycle is invented',
  detail: 'Karl Drais tests a steerable, human-powered machine.',
  year: '1817 · Mannheim, Germany',
  icon: '🚲',
  tone: 'mint',
}

const seedPuzzles: Puzzle[] = [
  {
    id: 'tambora-to-bicycle',
    number: 143,
    category: 'History & inventions',
    difficulty: 'Standard',
    duration: '2–4 min',
    hook: 'A volcano in Indonesia. A bicycle in Germany. What happened in between?',
    question: 'How did an Indonesian eruption help set two wheels in motion?',
    start: tambora,
    ending: draisMachine,
    accent: '#e26e5b',
    takeaway: 'The first bicycle was not born from a clean line of invention. It emerged from a climate shock that made old ways of moving harder to afford.',
    sources: [
      { title: 'Tambora eruption and its global effects', publisher: 'Smithsonian Global Volcanism Program', url: 'https://volcano.si.edu/volcano.cfm?vn=264040' },
      { title: 'Year Without a Summer', publisher: 'Encyclopaedia Britannica', url: 'https://www.britannica.com/event/Year-Without-a-Summer' },
      { title: 'The invention of the bicycle', publisher: 'Deutsches Museum', url: 'https://www.deutsches-museum.de/en/collections/transport/road-traffic/bicycle' },
    ],
    steps: [
      {
        id: 'tambora-climate',
        question: 'What did the eruption change far beyond Sumbawa?',
        bridge: 'Sulfur-rich material in the atmosphere reflected sunlight and cooled the climate for months.',
        relationship: 'Contributed',
        from: tambora.id,
        to: yearWithoutSummer.id,
        hint: 'Look up — the next domino happens in the atmosphere, not on the ground.',
        source: { title: 'The climate effects of the 1815 eruption', publisher: 'NASA Earth Observatory', url: 'https://earthobservatory.nasa.gov/world-of-change/tambora' },
        choices: [
          asCorrect(yearWithoutSummer),
          { id: 'sulfur-mining', title: 'A sulfur-mining boom begins', detail: 'New mines open to supply European industry.', year: '1816 · Java', icon: '⛏️', tone: 'gold', correct: false, whyWrong: 'Sulfur was part of the eruption cloud, but mining expansion was not the bridge to the bicycle.' },
          { id: 'steam-engines', title: 'Steam engines get cheaper', detail: 'Factories begin producing smaller engines.', year: '1816 · Britain', icon: '⚙️', tone: 'ink', correct: false, whyWrong: 'Steam power was developing, but it did not explain the unusual pressure on transport in 1817.' },
        ],
      },
      {
        id: 'climate-crops',
        question: 'Why did the cold become a transport problem?',
        bridge: 'The abnormal cold, rain, and frost damaged harvests and pushed food prices higher.',
        relationship: 'Contributed',
        from: yearWithoutSummer.id,
        to: cropFailures.id,
        hint: 'The next clue grows in a field.',
        source: { title: 'The Year Without a Summer', publisher: 'National Geographic', url: 'https://education.nationalgeographic.org/resource/year-without-summer/' },
        choices: [
          { id: 'telegraph', title: 'The first long-distance telegraph succeeds', detail: 'Messages begin crossing borders faster.', year: '1816 · Europe', icon: '📡', tone: 'blue', correct: false, whyWrong: 'Communication technology was changing, but it did not result from the harvest crisis.' },
          asCorrect(cropFailures),
          { id: 'polar-exploration', title: 'Arctic exploration accelerates', detail: 'Ships search for a northern passage.', year: '1816 · North Atlantic', icon: '🧭', tone: 'mint', correct: false, whyWrong: 'Exploration and the cold shared a setting, but this was not the chain’s pressure point.' },
        ],
      },
      {
        id: 'crops-horses',
        question: 'Which everyday system felt the shortage most directly?',
        bridge: 'With less grain and hay available, feeding large numbers of working animals became costly.',
        relationship: 'Contributed',
        from: cropFailures.id,
        to: horseShortage.id,
        hint: 'Think about the fuel required by the era’s most common vehicle.',
        source: { title: 'The Year Without a Summer and the bicycle', publisher: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/history/how-a-volcanic-eruption-helped-invent-the-bicycle-180958234/' },
        choices: [
          { id: 'canal-boom', title: 'Canal building reaches a peak', detail: 'New waterways link inland towns.', year: '1817 · Britain', icon: '🛶', tone: 'blue', correct: false, whyWrong: 'Canals were important transport infrastructure, but they did not use up the missing fodder.' },
          asCorrect(horseShortage),
          { id: 'coal-rationing', title: 'Coal is rationed for factories', detail: 'Steam workshops face fuel shortages.', year: '1817 · Germany', icon: '🪨', tone: 'ink', correct: false, whyWrong: 'Coal and fodder were different supply problems; the bicycle’s predecessor was a response to the latter.' },
        ],
      },
      {
        id: 'horses-drais',
        question: 'What practical experiment could replace a horse for short trips?',
        bridge: 'Karl Drais responded to the transport squeeze with a steerable machine powered by its rider.',
        relationship: 'Inspired',
        from: horseShortage.id,
        to: draisMachine.id,
        hint: 'The answer is a machine you can propel yourself — no oats required.',
        source: { title: 'The Draisine: bicycle ancestor', publisher: 'Deutsches Museum', url: 'https://www.deutsches-museum.de/en/collections/transport/road-traffic/bicycle' },
        choices: [
          { id: 'horse-railway', title: 'A horse-drawn railway opens', detail: 'Rails make animal transport smoother.', year: '1817 · Manchester', icon: '🚂', tone: 'coral', correct: false, whyWrong: 'A rail could make a horse more efficient, but it still needed the scarce animal.' },
          asCorrect(draisMachine),
          { id: 'rubber-tire', title: 'Rubber tires become standard', detail: 'Vulcanized rubber softens road travel.', year: '1817 · Europe', icon: '⭕', tone: 'mint', correct: false, whyWrong: 'Rubber tires came later. Drais first solved balance and propulsion with a wooden machine.' },
        ],
      },
    ],
  },
  {
    id: 'glue-to-post-it',
    number: 118,
    category: 'Science & accidents',
    difficulty: 'Easy',
    duration: '1–2 min',
    hook: 'A failed super-glue experiment ends up on millions of desks.',
    question: 'How did a weak adhesive become a very sticky idea?',
    start: { id: 'microspheres', title: 'A chemist makes tiny adhesive spheres', detail: 'A failed search for a powerful glue leaves something unusual behind.', year: '1968 · Minnesota, USA', icon: '🧪', tone: 'blue' },
    ending: { id: 'post-it', title: 'Post-it Notes hit office desks', detail: 'A bookmark-like note becomes a household object.', year: '1980 · USA', icon: '🗒️', tone: 'gold' },
    accent: '#d9a441',
    takeaway: 'The adhesive was not a failure after all — it was waiting for the right job.',
    sources: [
      { title: 'The history of Post-it Notes', publisher: '3M', url: 'https://www.3m.com/3M/en_US/post-it-notes/about-us/' },
      { title: 'The accidental invention of Post-it Notes', publisher: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/innovation/how-post-it-notes-were-invented-180962032/' },
    ],
    steps: [
      { id: 'glue-bookmark', question: 'Who found a use for the “failed” glue?', bridge: 'A colleague at 3M needed a bookmark that would stick without damaging the page.', relationship: 'Inspired', from: 'microspheres', to: 'bookmark', hint: 'Think of a temporary hold, not a permanent bond.', source: { title: 'The history of Post-it Notes', publisher: '3M', url: 'https://www.3m.com/3M/en_US/post-it-notes/about-us/' }, choices: [
        { id: 'bookmark', title: 'A removable bookmark', detail: 'A paper marker stays put, then peels away cleanly.', year: '1974 · 3M', icon: '🔖', tone: 'gold', correct: true },
        { id: 'airplane', title: 'A lighter airplane wing', detail: 'Engineers use the glue to join aluminum.', year: '1974 · Seattle', icon: '✈️', tone: 'blue', correct: false, whyWrong: 'The glue was too weak for structural work. Its gentle grip was the point.' },
        { id: 'surgical-tape', title: 'A new surgical tape', detail: 'Hospitals adopt it for wound dressings.', year: '1974 · Minnesota', icon: '🩹', tone: 'coral', correct: false, whyWrong: 'Medical tape was plausible, but the first breakthrough use was as a removable bookmark.' },
      ] },
      { id: 'bookmark-sampler', question: 'What made the idea believable at scale?', bridge: 'Internal samples showed that the adhesive could hold paper in place while remaining repositionable.', relationship: 'Enabled', from: 'bookmark', to: 'sampler', hint: 'The first test was something you could hand around a room.', source: { title: 'The Post-it Note story', publisher: '3M', url: 'https://www.3m.com/3M/en_US/post-it-notes/about-us/' }, choices: [
        { id: 'sampler', title: 'Free sample pads', detail: 'People try the notes in offices and homes.', year: '1977 · USA', icon: '📒', tone: 'mint', correct: true },
        { id: 'tv-ad', title: 'A national television commercial', detail: 'A glossy ad launches the product overnight.', year: '1977 · USA', icon: '📺', tone: 'coral', correct: false, whyWrong: 'The product spread through sampling and word of mouth before mass advertising.' },
        { id: 'patent', title: 'A new patent for permanent glue', detail: '3M protects a stronger formula.', year: '1977 · USA', icon: '📜', tone: 'ink', correct: false, whyWrong: 'The value was its removable behavior, not a stronger permanent formula.' },
      ] },
      { id: 'sampler-product', question: 'What did the sampler prove?', bridge: 'People quickly found dozens of uses for a note that could be moved without leaving a mess.', relationship: 'Popularized', from: 'sampler', to: 'post-it', hint: 'A small sample becomes a product when people invent uses for it.', source: { title: 'The history of Post-it Notes', publisher: '3M', url: 'https://www.3m.com/3M/en_US/post-it-notes/about-us/' }, choices: [
        { id: 'post-it', title: 'Post-it Notes hit office desks', detail: 'A bookmark-like note becomes a household object.', year: '1980 · USA', icon: '🗒️', tone: 'gold', correct: true },
        { id: 'glue-stick', title: 'The modern glue stick launches', detail: 'Solid adhesive replaces liquid glue.', year: '1980 · Germany', icon: '🧴', tone: 'blue', correct: false, whyWrong: 'Glue sticks solve a different problem: permanent, portable adhesion.' },
        { id: 'fax-paper', title: 'Thermal fax paper becomes standard', detail: 'Offices adopt a new kind of paper.', year: '1980 · Japan', icon: '🖨️', tone: 'ink', correct: false, whyWrong: 'Fax paper was an office technology shift, but it did not use the removable adhesive.' },
      ] },
    ],
  },
  {
    id: 'mold-to-penicillin',
    number: 91,
    category: 'Medicine',
    difficulty: 'Easy',
    duration: '1–2 min',
    hook: 'A messy laboratory plate changes the treatment of infection.',
    question: 'How did a patch of mold become a medical revolution?',
    start: { id: 'mold-plate', title: 'Mold contaminates a culture plate', detail: 'A scientist notices bacteria dying around the mold.', year: '1928 · London, UK', icon: '🧫', tone: 'mint' },
    ending: { id: 'penicillin', title: 'Penicillin reaches patients', detail: 'An antibiotic moves from observation to treatment.', year: '1940s · UK & USA', icon: '💊', tone: 'blue' },
    accent: '#5f9d8d',
    takeaway: 'The breakthrough began with attention: Fleming noticed the edge of an accident instead of throwing the plate away.',
    sources: [
      { title: 'The discovery of penicillin', publisher: 'Nobel Prize', url: 'https://www.nobelprize.org/prizes/medicine/1945/fleming/lecture/' },
      { title: 'Penicillin and the war effort', publisher: 'Wellcome Collection', url: 'https://wellcomecollection.org/articles/WwH3bSAAACcA3LZ6' },
    ],
    steps: [
      { id: 'mold-observation', question: 'What did the mold seem to do?', bridge: 'The mold released a substance that stopped nearby bacteria from growing.', relationship: 'Caused', from: 'mold-plate', to: 'inhibition', hint: 'The clue is the clear ring around the mold.', source: { title: 'The discovery of penicillin', publisher: 'Nobel Prize', url: 'https://www.nobelprize.org/prizes/medicine/1945/fleming/lecture/' }, choices: [
        { id: 'inhibition', title: 'A clear ring stops bacteria', detail: 'Growth disappears around the mold colony.', year: '1928 · London', icon: '⭕', tone: 'mint', correct: true },
        { id: 'fermentation', title: 'Sugar ferments into alcohol', detail: 'The culture produces a new fuel.', year: '1928 · London', icon: '🫧', tone: 'gold', correct: false, whyWrong: 'Fermentation was not what Fleming observed. The striking clue was bacteria failing to grow.' },
        { id: 'stain', title: 'A blue dye stains the plate', detail: 'The sample becomes easier to inspect.', year: '1928 · London', icon: '🔵', tone: 'blue', correct: false, whyWrong: 'The visible ring was biological inhibition, not a staining technique.' },
      ] },
      { id: 'inhibition-drug', question: 'What had to happen before this became medicine?', bridge: 'Researchers isolated and tested the active substance, naming it penicillin.', relationship: 'Enabled', from: 'inhibition', to: 'penicillin-drug', hint: 'A lab observation needs a stable substance that can be tested.', source: { title: 'Penicillin: the Oxford story', publisher: 'University of Oxford', url: 'https://www.ox.ac.uk/news/science-blog/penicillin-oxford-story' }, choices: [
        { id: 'penicillin-drug', title: 'Penicillin is isolated', detail: 'The active compound can be studied and produced.', year: '1939–1941 · Oxford', icon: '⚗️', tone: 'blue', correct: true },
        { id: 'xray', title: 'X-rays reveal bacteria', detail: 'Doctors image infection inside the body.', year: '1939 · London', icon: '🩻', tone: 'ink', correct: false, whyWrong: 'X-rays are diagnostic; they did not turn Fleming’s observation into an antibiotic.' },
        { id: 'vaccine', title: 'A vaccine is made from the mold', detail: 'The mold is weakened and injected.', year: '1939 · Oxford', icon: '💉', tone: 'coral', correct: false, whyWrong: 'Penicillin is an antibiotic, not a vaccine made from weakened mold.' },
      ] },
      { id: 'drug-patients', question: 'What made the discovery matter beyond one laboratory?', bridge: 'Industrial production during World War II made enough penicillin available to treat large numbers of people.', relationship: 'Accelerated', from: 'penicillin-drug', to: 'penicillin', hint: 'The final bridge is about scale, not another discovery.', source: { title: 'Penicillin and the war effort', publisher: 'Wellcome Collection', url: 'https://wellcomecollection.org/articles/WwH3bSAAACcA3LZ6' }, choices: [
        { id: 'penicillin', title: 'Penicillin reaches patients', detail: 'An antibiotic moves from observation to treatment.', year: '1940s · UK & USA', icon: '💊', tone: 'blue', correct: true },
        { id: 'vitamins', title: 'Vitamins become a daily habit', detail: 'Packaged supplements enter supermarkets.', year: '1940s · USA', icon: '🍊', tone: 'gold', correct: false, whyWrong: 'Vitamins were expanding too, but they do not explain the antibacterial treatment.' },
        { id: 'blood-bank', title: 'Blood banks become common', detail: 'Hospitals store donations for surgery.', year: '1940s · UK', icon: '🩸', tone: 'coral', correct: false, whyWrong: 'Blood banks were another wartime medical advance, not the scale-up of penicillin.' },
      ] },
    ],
  },
  {
    id: 'drum-break-to-hip-hop',
    number: 67,
    category: 'Music & culture',
    difficulty: 'Standard',
    duration: '2–3 min',
    hook: 'One four-bar drum break becomes a whole new way to make music.',
    question: 'How did a forgotten B-side help build hip-hop?',
    start: { id: 'amen-break', title: 'The Amen break is recorded', detail: 'A few seconds of drums are captured on a soul B-side.', year: '1969 · Winston-Salem, USA', icon: '🥁', tone: 'coral' },
    ending: { id: 'breakbeat', title: 'Breakbeats power new genres', detail: 'The loop becomes a shared musical vocabulary.', year: '1990s · Global', icon: '🎛️', tone: 'blue' },
    accent: '#cc6a48',
    takeaway: 'A tiny piece of a song became infrastructure: a rhythmic building block that producers could stretch, chop, and reinvent.',
    sources: [
      { title: 'The Amen break: a history', publisher: 'NPR Music', url: 'https://www.npr.org/sections/therecord/2011/03/08/134022518/the-amen-break-the-most-sampled-loop-in-music' },
      { title: 'Sampling and hip-hop', publisher: 'Smithsonian Institution', url: 'https://americanhistory.si.edu/explore/stories/hip-hop' },
    ],
    steps: [
      { id: 'amen-break-djs', question: 'How did the tiny drum passage escape the B-side?', bridge: 'DJs isolated instrumental breaks so dancers could stay in the most energetic part of a record.', relationship: 'Popularized', from: 'amen-break', to: 'break-djs', hint: 'The next step is a live technique, before it is a studio effect.', source: { title: 'The Amen break: a history', publisher: 'NPR Music', url: 'https://www.npr.org/sections/therecord/2011/03/08/134022518/the-amen-break-the-most-sampled-loop-in-music' }, choices: [
        { id: 'break-djs', title: 'DJs extend the break', detail: 'Two copies of a record keep the drums going.', year: '1970s · New York', icon: '🎚️', tone: 'gold', correct: true },
        { id: 'synth-pop', title: 'Synthesizers replace the drums', detail: 'Electronic keyboards take over the rhythm section.', year: '1970s · London', icon: '🎹', tone: 'blue', correct: false, whyWrong: 'Synths changed pop, but the break spread because DJs kept live drums in the foreground.' },
        { id: 'radio-edit', title: 'Radio stations shorten the song', detail: 'Broadcasters create a cleaner edit for airplay.', year: '1970s · USA', icon: '📻', tone: 'ink', correct: false, whyWrong: 'An edit would remove material; the break’s story is about repeating and extending it.' },
      ] },
      { id: 'djs-sampling', question: 'What new tool made the loop portable?', bridge: 'Samplers let producers capture a short break and trigger it as a repeatable building block.', relationship: 'Enabled', from: 'break-djs', to: 'sampling', hint: 'The clue is a machine that can remember a sound.', source: { title: 'Sampling and hip-hop', publisher: 'Smithsonian Institution', url: 'https://americanhistory.si.edu/explore/stories/hip-hop' }, choices: [
        { id: 'sampling', title: 'Samplers turn breaks into building blocks', detail: 'A machine stores a sound and plays it on command.', year: '1980s · USA', icon: '🧰', tone: 'blue', correct: true },
        { id: 'cassette', title: 'Cassette mixtapes become cheaper', detail: 'Fans duplicate albums at home.', year: '1980s · USA', icon: '📼', tone: 'coral', correct: false, whyWrong: 'Mixtapes spread music, but they did not make precise looping possible.' },
        { id: 'drum-machine', title: 'Drum machines erase live rhythms', detail: 'Producers replace recorded drums completely.', year: '1980s · Japan', icon: '🤖', tone: 'ink', correct: false, whyWrong: 'Drum machines were important, but sampling preserved and re-used recorded performances.' },
      ] },
      { id: 'sampling-breakbeat', question: 'What did producers build from the shared rhythm?', bridge: 'The recognizable break was chopped, sped up, slowed down, and carried into hip-hop, jungle, and drum & bass.', relationship: 'Popularized', from: 'sampling', to: 'breakbeat', hint: 'Follow the sound into the genres that made rhythm the headline.', source: { title: 'The Amen break: a history', publisher: 'NPR Music', url: 'https://www.npr.org/sections/therecord/2011/03/08/134022518/the-amen-break-the-most-sampled-loop-in-music' }, choices: [
        { id: 'breakbeat', title: 'Breakbeats power new genres', detail: 'The loop becomes a shared musical vocabulary.', year: '1990s · Global', icon: '🎛️', tone: 'blue', correct: true },
        { id: 'music-video', title: 'Music videos become the main format', detail: 'Songs are written around visual hooks.', year: '1990s · Global', icon: '📺', tone: 'coral', correct: false, whyWrong: 'Music videos changed promotion, but the break’s legacy is audible in the rhythm itself.' },
        { id: 'compact-disc', title: 'Compact discs replace vinyl', detail: 'Digital audio becomes the default format.', year: '1990s · Global', icon: '💿', tone: 'mint', correct: false, whyWrong: 'The format shift happened alongside the story, but it did not create the breakbeat.' },
      ] },
    ],
  },
  {
    id: 'mistranslation-to-meme',
    number: 32,
    category: 'Internet culture',
    difficulty: 'Hard',
    duration: '3–5 min',
    hook: 'A clumsy video-game translation becomes an early global meme.',
    question: 'How did a bad sentence become internet folklore?',
    start: { id: 'zero-wing', title: 'A game translation lands strangely', detail: 'A space captain delivers an unforgettable sentence.', year: '1991 · Europe', icon: '🕹️', tone: 'coral' },
    ending: { id: 'meme-culture', title: 'Remix culture finds its catchphrase', detail: 'The phrase becomes shorthand for gloriously broken localization.', year: '2000s · Internet', icon: '🫠', tone: 'gold' },
    accent: '#b978a4',
    takeaway: 'The phrase survived because it was easy to quote, easy to remix, and perfectly captured the internet’s affection for accidental absurdity.',
    sources: [
      { title: 'All your base are belong to us', publisher: 'Know Your Meme', url: 'https://knowyourmeme.com/memes/all-your-base-are-belong-to-us' },
      { title: 'Zero Wing translation history', publisher: 'The Cutting Room Floor', url: 'https://tcrf.net/Zero_Wing_(Genesis)' },
    ],
    steps: [
      { id: 'zero-wing-caption', question: 'What made the line travel beyond the game?', bridge: 'Screenshots and quoted captions spread the sentence as a strange, self-contained joke.', relationship: 'Popularized', from: 'zero-wing', to: 'screenshots', hint: 'Before video, the phrase moved as something you could copy and paste.', source: { title: 'All your base are belong to us', publisher: 'Know Your Meme', url: 'https://knowyourmeme.com/memes/all-your-base-are-belong-to-us' }, choices: [
        { id: 'screenshots', title: 'Screenshots make the error shareable', detail: 'The line can travel without the cartridge or console.', year: 'Late 1990s · Web forums', icon: '📸', tone: 'blue', correct: true },
        { id: 'arcade-tour', title: 'Arcades translate the game live', detail: 'Attendants explain the story to players.', year: 'Late 1990s · Japan', icon: '🕹️', tone: 'gold', correct: false, whyWrong: 'The phrase spread as text and image online, not through arcade staff.' },
        { id: 'official-patch', title: 'A patch repairs the localization', detail: 'The publisher rewrites every line.', year: 'Late 1990s · Europe', icon: '🧩', tone: 'mint', correct: false, whyWrong: 'A repair would erase the wording; the strange translation remained because people repeated it.' },
      ] },
      { id: 'screenshots-remix', question: 'What did internet users do with the phrase?', bridge: 'They clipped it into banners, remixes, and parody videos, turning a translation mistake into a recognizable format.', relationship: 'Inspired', from: 'screenshots', to: 'remixes', hint: 'The next event is less about reading and more about editing.', source: { title: 'All your base are belong to us', publisher: 'Know Your Meme', url: 'https://knowyourmeme.com/memes/all-your-base-are-belong-to-us' }, choices: [
        { id: 'remixes', title: 'Remixes turn it into a template', detail: 'The words appear in new images and videos.', year: '2000–2001 · Web', icon: '✂️', tone: 'coral', correct: true },
        { id: 'fan-translation', title: 'Fans publish a corrected script', detail: 'A community rewrites the entire game.', year: '2000 · Forums', icon: '📝', tone: 'blue', correct: false, whyWrong: 'The appeal was not correction. It was the comic persistence of the original sentence.' },
        { id: 'console-sequel', title: 'A sequel repeats the same plot', detail: 'The publisher commissions another space opera.', year: '2000 · Japan', icon: '🚀', tone: 'ink', correct: false, whyWrong: 'A sequel might reuse the setting, but it would not explain the phrase’s remix life.' },
      ] },
      { id: 'remixes-meme', question: 'What did the phrase become a symbol of?', bridge: 'It became an early example of a web-native joke: context optional, remixing encouraged.', relationship: 'Popularized', from: 'remixes', to: 'meme-culture', hint: 'The answer describes a behavior, not a new website.', source: { title: 'All your base are belong to us', publisher: 'Know Your Meme', url: 'https://knowyourmeme.com/memes/all-your-base-are-belong-to-us' }, choices: [
        { id: 'meme-culture', title: 'Remix culture finds its catchphrase', detail: 'The phrase becomes shorthand for gloriously broken localization.', year: '2000s · Internet', icon: '🫠', tone: 'gold', correct: true },
        { id: 'search-engine', title: 'Search engines begin translating games', detail: 'Automatic localization becomes standard.', year: '2000s · Web', icon: '🔎', tone: 'blue', correct: false, whyWrong: 'Automatic translation was a later technology story; this one is about people making meaning from a mistake.' },
        { id: 'fan-wiki', title: 'Every game gets a fan encyclopedia', detail: 'Players document all game dialogue.', year: '2000s · Internet', icon: '📚', tone: 'mint', correct: false, whyWrong: 'Fan documentation helped preserve lore, but it was not the cultural effect of this catchphrase.' },
      ] },
    ],
  },
]

export const puzzles: Puzzle[] = [...seedPuzzles, ...expandedPuzzles]

export const dailyPuzzle = puzzles[0]

export const getPuzzleById = (id: string) => puzzles.find((puzzle) => puzzle.id === id) ?? dailyPuzzle

export const getEventById = (puzzle: Puzzle, id: string) => {
  if (puzzle.start.id === id) return puzzle.start
  if (puzzle.ending.id === id) return puzzle.ending
  for (const step of puzzle.steps) {
    const match = step.choices.find((choice) => choice.id === id)
    if (match) return match
  }
  return puzzle.start
}
