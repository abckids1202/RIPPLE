import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { atlasForPuzzle, mediaForEvent, type Annotation, type EditorialReview, type MediaAsset } from './data/atlas'
import { defaultEditorialReview, editorCandidates } from './data/editor'
import { dailyPuzzle, getEventById, getPuzzleById, puzzles, type Choice, type Event, type Puzzle, type Step } from './data/puzzles'
import { isSupabaseConfigured } from './lib/supabase'
import { rippleApi, type SafePuzzlePayload } from './lib/ripple-api'
import type { Attempt } from './types'
import './styles.css'

type Screen = 'home' | 'archive' | 'how' | 'game' | 'results' | 'editor'
type GameStage = 'intro' | 'playing'
type Feedback = { choiceId: string; correct: boolean; text: string }

const ACTIVE_KEY = 'ripple-active-attempt-v2'
const HISTORY_KEY = 'ripple-completed-v2'

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch { return fallback }
}

const makeAttempt = (puzzle: Puzzle): Attempt => ({ puzzleId: puzzle.id, chain: [puzzle.start.id], stepIndex: 0, mistakes: 0, hints: 0, firstTry: 0, wrongChoices: [], hintSteps: [], startedAt: Date.now() })

function fromCloud(payload: SafePuzzlePayload, fallbackNumber: number): Puzzle {
  return { ...payload, number: payload.number ?? fallbackNumber, automated: payload.automated, steps: payload.steps.map((step) => ({ ...step, choices: step.choices.map((choice) => ({ ...choice, correct: false })) as Choice[] })) }
}
const numberLabel = (number: number) => `#${String(number).padStart(3, '0')}`

function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand" onClick={onClick} aria-label="RIPPLE home"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>RIPPLE</span></button>
}

function Header({ screen, onNavigate, caseCount }: { screen: Screen; onNavigate: (screen: Screen) => void; caseCount: number }) {
  return <header className="topbar"><Brand onClick={() => onNavigate('home')} /><nav className="main-nav" aria-label="Main navigation"><button className={screen === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('home')}>Daily</button><button className={screen === 'archive' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('archive')}>Archive <span>{String(caseCount).padStart(2, '0')}</span></button><button className={screen === 'how' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('how')}>Method</button></nav><div className="topbar-actions"><button className={screen === 'editor' ? 'desk-link active' : 'desk-link'} onClick={() => onNavigate('editor')}><span>⌘</span> Editor desk</button><span className="streak"><b>✦</b> 4 day streak</span><button className="profile-dot" aria-label="Your profile">LM</button></div></header>
}

function MediaFrame({ asset, className = '', label, activeAnnotation, onAnnotationClick, showCredit = true }: { asset: MediaAsset; className?: string; label?: string; activeAnnotation?: string; onAnnotationClick?: (annotation: Annotation) => void; showCredit?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false)
  const annotations = asset.annotations ?? []
  return <figure className={`media-frame ${className}`}><div className={`media-stage kind-${asset.kind} ${imageFailed || !asset.imageUrl ? 'media-fallback' : ''}`}>{asset.imageUrl && !imageFailed ? <img src={asset.imageUrl} alt={asset.alt} onError={() => setImageFailed(true)} /> : <EvidenceArtwork asset={asset} />}<div className="media-grain" aria-hidden="true" />{label && <span className="media-label">{label}</span>}{annotations.map((annotation) => <button key={annotation.id} className={`annotation-pin pin-${annotation.tone} ${activeAnnotation === annotation.id ? 'selected' : ''}`} style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }} onClick={(event) => { event.stopPropagation(); onAnnotationClick?.(annotation) }} aria-label={`${annotation.label}: ${annotation.note}`}><span className="pin-ring" /><span className="pin-dot" />{activeAnnotation === annotation.id && <span className="annotation-popover"><b>{annotation.label}</b><small>{annotation.note}</small></span>}</button>)}<span className="media-kind">{asset.kind.toUpperCase()} / EVIDENCE</span></div>{showCredit && <figcaption><span>{asset.credit}</span><a href={asset.sourceUrl} target="_blank" rel="noreferrer">{asset.license} ↗</a></figcaption>}</figure>
}

function EvidenceArtwork({ asset }: { asset: MediaAsset }) {
  return <div className={`evidence-art art-${asset.kind}`} aria-label={asset.alt}><div className="art-grid" /><div className="art-rings" /><span className="art-code">{asset.annotations?.[0]?.label ?? 'ARCHIVE / OPEN'}</span>{asset.kind === 'audio' && <div className="waveform">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>}{asset.kind === 'web' && <div className="web-window"><span /><span /><span /><b>context_optional.txt</b><em>copy / remix / repeat</em></div>}{asset.kind === 'scan' && <div className="scan-sheet"><b>FIELD NOTE</b><span>OBSERVED / TESTED</span><em>01—04</em></div>}</div>
}

function EventPanel({ event, media, className = '' }: { event: Event; media: MediaAsset; className?: string }) {
  return <article className={`event-panel ${className}`}><MediaFrame asset={media} className="event-media" label={event.year.split('·')[0].trim()} showCredit={false} /><div className="event-panel-copy"><span className="event-overline">{event.year}</span><h3>{event.title}</h3><p>{event.detail}</p></div></article>
}

function ChainRail({ puzzle, chain, solvedLinks }: { puzzle: Puzzle; chain: string[]; solvedLinks: number }) {
  const remaining = Math.max(0, puzzle.steps.length - solvedLinks)
  return <div className="chain-rail"><div className="rail-header"><span>THE THREAD / LIVE MAP</span><span>{solvedLinks} of {puzzle.steps.length} links resolved</span></div><div className="rail-track">{chain.map((id, index) => { const event = getEventById(puzzle, id); return <div className="rail-node-wrap" key={`${id}-${index}`}><div className={`rail-node ${index === chain.length - 1 ? 'active' : ''}`}><span>{event.icon}</span><small>{event.year.split('·')[0].trim()}</small></div>{index < chain.length - 1 && <i className="rail-arrow">→</i>}</div> })}{remaining > 0 && <div className="rail-unknowns">{Array.from({ length: remaining }, (_, index) => <span key={index}>?</span>)}</div>}{remaining > 0 && <><i className="rail-arrow">→</i><div className="rail-finish"><span>{puzzle.ending.icon}</span><small>FINISH</small></div></>}</div></div>
}

function HomeScreen({ puzzle, dailyDone, activeAttempt, onPlay, onResume, onNavigate }: { puzzle: Puzzle; dailyDone: boolean; activeAttempt: Attempt | null; onPlay: (puzzle: Puzzle) => void; onResume: () => void; onNavigate: (screen: Screen) => void }) {
  const atlas = atlasForPuzzle(puzzle)
  const [activePin, setActivePin] = useState<string | undefined>(atlas.featured.annotations?.[0]?.id)
  const dailyEvents = [puzzle.start, ...puzzle.steps.slice(0, 2).map((step) => step.choices.find((choice) => choice.correct) as Event), puzzle.ending]
  return <main className="home-page"><section className="home-hero shell-width"><div className="hero-editorial"><div className="case-masthead"><span className="case-dot" /> DAILY CASE FILE <b>{numberLabel(puzzle.number)}</b><span className="case-rule" /> <span>RESEARCHED TODAY</span></div><h1>The world is full of<br /><em>hidden consequences.</em></h1><p className="hero-dek">RIPPLE is a daily learning game about the links between events. Start with a volcano. End with a bicycle. Follow the evidence in between.</p><div className="hero-buttons"><button className="button-dark" onClick={() => dailyDone ? onPlay(puzzle) : activeAttempt ? onResume() : onPlay(puzzle)}>{dailyDone ? 'Review today’s case' : activeAttempt ? 'Resume the investigation' : 'Open today’s case'} <span>↗</span></button><span className="time-stamp"><b>02:00</b> average investigation · no account required</span></div><div className="hero-lesson"><span className="lesson-mark">↳</span><div><span className="micro-label">TODAY YOU’LL LEARN</span><strong>How the 1815 Tambora eruption helped put Europe on two wheels.</strong></div></div></div><div className="hero-visual-wrap"><div className="hero-tab"><span>PLATE 01</span><b>FIELD IMAGE</b><span>OPEN ↗</span></div><MediaFrame asset={atlas.featured} className="hero-media" label="Sumbawa / 1815" activeAnnotation={activePin} onAnnotationClick={(annotation) => setActivePin(annotation.id)} /><div className="hero-callout callout-left"><span>01 / ORIGIN</span><strong>Ash enters<br />the story.</strong></div><div className="hero-callout callout-right"><span>READ THE TRACE</span><strong>Every arrow<br />has a source.</strong></div><span className="hero-margin-note">pin the<br />moment</span></div></section><section className="daily-strip shell-width"><div className="strip-heading"><div><span className="micro-label">THE DAILY THREAD</span><h2>A volcano. A bad harvest. A bicycle.</h2></div><button className="button-quiet" onClick={() => onPlay(puzzle)}>Investigate the case <span>→</span></button></div><div className="event-sequence">{dailyEvents.map((event, index) => <div className="sequence-node" key={`${event.id}-${index}`}><div className="sequence-number">0{index + 1}</div><div className="sequence-art"><span>{event.icon}</span><b>{event.year.split('·')[0].trim()}</b></div><strong>{event.title}</strong>{index < dailyEvents.length - 1 && <div className="sequence-connector"><span>↗</span></div>}</div>)}</div><div className="source-line"><span><i /> SOURCE-FIRST DESIGN</span><span>Read the claim. Inspect the evidence. Decide what it really means.</span></div></section><section className="learning-section shell-width"><div className="learning-card"><div className="learning-marker">R</div><div><span className="micro-label">THE RIPPLE PROMISE</span><h2>More than a fact.<br /><em>A way to see.</em></h2></div><div className="learning-copy"><p>Most trivia asks if you know something. RIPPLE asks what that something changed.</p><button className="button-outline" onClick={() => onNavigate('how')}>See the method <span>↗</span></button></div></div></section><section className="archive-home shell-width"><div className="strip-heading"><div><span className="micro-label">CASE ARCHIVE</span><h2>Other stories worth following.</h2></div><button className="button-quiet" onClick={() => onNavigate('archive')}>Browse all cases <span>→</span></button></div><div className="case-grid">{puzzles.slice(1, 4).map((item) => <CaseCard key={item.id} puzzle={item} onPlay={onPlay} />)}</div></section></main>
}

function CaseCard({ puzzle, onPlay, completed = false }: { puzzle: Puzzle; onPlay: (puzzle: Puzzle) => void; completed?: boolean }) {
  const media = atlasForPuzzle(puzzle).featured
  return <article className="case-card" role="button" tabIndex={0} onClick={() => onPlay(puzzle)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPlay(puzzle) } }} style={{ '--case-accent': puzzle.accent } as CSSProperties} aria-label={`Open case ${numberLabel(puzzle.number)}: ${puzzle.question}`}><div className="case-card-image"><MediaFrame asset={media} showCredit={false} /><span className="case-card-number">{numberLabel(puzzle.number)}</span><span className="case-card-open">OPEN ↗</span></div><div className="case-card-copy"><span className="micro-label">{puzzle.category} / {puzzle.difficulty}</span>{puzzle.automated && <span className="micro-label">AI-DRAFTED / AUTO-CHECKED</span>}<h3>{puzzle.question}</h3><div><span>{puzzle.duration}</span>{completed ? <b className="done-label">✓ Completed</b> : <b>Follow the thread →</b>}</div></div></article>
}

function ArchiveScreen({ history, onPlay, catalog }: { history: Record<string, Attempt>; onPlay: (puzzle: Puzzle) => void; catalog: Puzzle[] }) {
  const [filter, setFilter] = useState('All cases')
  const categories = ['All cases', ...Array.from(new Set(catalog.map((puzzle) => puzzle.category)))]
  const visible = filter === 'All cases' ? catalog : catalog.filter((puzzle) => puzzle.category === filter)
  return <main className="page shell-width page-spacer"><div className="archive-intro"><div><span className="micro-label">THE CASE ARCHIVE</span><h1>Find the next<br /><em>hidden link.</em></h1><p>Real events, carefully connected. Search by subject, then let the evidence change your mind.</p></div><div className="archive-count"><strong>{String(catalog.length).padStart(2, '0')}</strong><span>case files</span></div></div><div className="filter-tabs" aria-label="Filter archive">{categories.map((category) => <button key={category} className={filter === category ? 'selected' : ''} onClick={() => setFilter(category)}>{category}</button>)}</div><div className="archive-case-grid">{visible.map((puzzle) => <CaseCard key={puzzle.id} puzzle={puzzle} onPlay={onPlay} completed={Boolean(history[puzzle.id]?.completed)} />)}</div><div className="archive-footer-note"><span>✦</span><p>New cases are researched from source material and pass automated checks before publication. <button>Send a story lead →</button></p></div></main>
}

function HowScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return <main className="page shell-width page-spacer"><div className="method-intro"><span className="micro-label">THE RIPPLE METHOD</span><h1>Learn by<br /><em>following the thread.</em></h1><p>A daily case begins with a gap between two events. You make the connection. We show the evidence, the uncertainty, and the story worth remembering.</p></div><div className="method-grid"><div className="method-panel"><span>01</span><div className="method-glyph glyph-pin">⌖</div><h2>Spot the mystery.</h2><p>Two events, apparently unrelated. A mountain and a machine. A lab accident and a medicine. Curiosity does the rest.</p></div><div className="method-panel"><span>02</span><div className="method-glyph glyph-branch">↗<i>?</i>↘</div><h2>Choose a bridge.</h2><p>Three plausible next events. Dates, details, and context give you enough to reason without memorizing everything.</p></div><div className="method-panel"><span>03</span><div className="method-glyph glyph-source">▤</div><h2>Read the evidence.</h2><p>Every arrow names its relationship and carries a source. The goal is a sharper story, not an overconfident one.</p></div></div><div className="method-cta"><div><span className="micro-label">THE POINT</span><h2>Leave with a story<br />you can retell.</h2></div><button className="button-paper" onClick={() => onNavigate('home')}>Try today’s case <span>↗</span></button></div></main>
}

function GameScreen({ puzzle, attempt, stage, feedback, onStageChange, onChoice, onHint, onContinue, onExit }: { puzzle: Puzzle; attempt: Attempt; stage: GameStage; feedback: Feedback | null; onStageChange: (stage: GameStage) => void; onChoice: (choice: Choice, step: Step) => void; onHint: (step: Step) => void; onContinue: () => void; onExit: () => void }) {
  const currentStep = puzzle.steps[attempt.stepIndex]
  const currentEvent = getEventById(puzzle, currentStep?.from ?? puzzle.start.id)
  const currentMedia = mediaForEvent(puzzle, currentEvent.id)
  const [activePin, setActivePin] = useState<string | undefined>(currentMedia.annotations?.[0]?.id)
  const solvedLinks = attempt.chain.length - 1
  const hintVisible = currentStep ? attempt.hintSteps.includes(currentStep.id) : false
  const isLast = attempt.stepIndex === puzzle.steps.length - 1

  useEffect(() => setActivePin(mediaForEvent(puzzle, currentEvent.id).annotations?.[0]?.id), [puzzle, currentEvent.id])

  return <main className="game-shell one-screen-game">
    <div className="game-top shell-width">
      <button className="exit-button" onClick={onExit} aria-label="Back to archive">← <span>Back</span></button>
      <div className="game-case-label"><b>{numberLabel(puzzle.number)}</b><i />{puzzle.category}</div>
      <div className="game-status"><span className="game-step"><strong>{String(Math.min(solvedLinks + 1, puzzle.steps.length)).padStart(2, '0')}</strong><span>/ {String(puzzle.steps.length).padStart(2, '0')} links</span></span><span className="local-save">LOCAL SAVE <b>●</b></span></div>
    </div>

    <div className="game-context shell-width">
      {stage === 'intro' ? <div className="context-copy"><span className="micro-label">CASE FILE / {numberLabel(puzzle.number)}</span><h1>Open the evidence.</h1></div> : <div className="context-copy"><span className="micro-label">EVENT NOW</span><h1>{currentEvent.title}</h1><span className="context-year">{currentEvent.year}</span></div>}
      <ChainRail puzzle={puzzle} chain={attempt.chain} solvedLinks={solvedLinks} />
    </div>

    <div className="shell-width game-content one-screen-content">
      <AnimatePresence mode="wait">
        {stage === 'intro' ? <motion.section className="one-screen-intro" key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <div className="intro-image"><MediaFrame asset={atlasForPuzzle(puzzle).featured} label="CASE IMAGE / OPEN" /></div>
          <div className="intro-copy"><span className="micro-label">THE QUESTION</span><h2>{puzzle.question}</h2><p>{puzzle.hook}</p><div className="intro-note"><span>FIELD NOTE</span><strong>You’ll see the full chain after each best guess.</strong></div><button className="button-dark intro-start" onClick={() => onStageChange('playing')}>Begin the investigation <span>↗</span></button></div>
          <div className="intro-endpoints"><EventPanel event={puzzle.start} media={mediaForEvent(puzzle, puzzle.start.id)} /><span className="endpoint-arrow">→</span><EventPanel event={puzzle.ending} media={mediaForEvent(puzzle, puzzle.ending.id)} /></div>
        </motion.section> : <motion.section className="game-board one-screen-board" key={currentStep.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <section className="evidence-column" aria-label="Current evidence">
            <div className="board-label"><span>READ THE EVIDENCE</span><span>{currentEvent.year}</span></div>
            <MediaFrame asset={currentMedia} className="board-media" label={currentEvent.year} activeAnnotation={activePin} onAnnotationClick={(annotation) => setActivePin(annotation.id)} />
            <div className="observation-note"><span className="note-stamp">LOOK</span><p>{currentEvent.detail}</p></div>
            <a className="source-ribbon" href={currentStep.source.url} target="_blank" rel="noreferrer"><span>SOURCE</span><strong>{currentStep.source.title}</strong><span>OPEN ↗</span></a>
          </section>

          <section className="choice-column" aria-label="Investigation decision">
            <div className="choice-heading"><div><span className="micro-label">NEXT LINK</span><h2>{currentStep.question}</h2></div><span className="option-count">3 choices</span></div>
            <div className="choices" role="group" aria-label="Choose the next event">{currentStep.choices.map((choice, index) => <ChoiceCard key={choice.id} choice={choice} puzzle={puzzle} index={index} wrong={attempt.wrongChoices.includes(choice.id)} selected={feedback?.choiceId === choice.id} disabled={Boolean(feedback?.correct) || attempt.wrongChoices.includes(choice.id)} onClick={() => onChoice(choice, currentStep)} />)}</div>
            <div className="feedback-zone one-feedback" aria-live="polite">
              {feedback ? <motion.div className={`feedback-box ${feedback.correct ? 'success' : 'wrong'}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}><span className="feedback-symbol">{feedback.correct ? '✓' : '×'}</span><div><strong>{feedback.correct ? (isLast ? 'The chain closes here.' : 'That’s the bridge.') : 'A plausible detour.'}</strong><p>{feedback.text}</p></div>{feedback.correct && <button className="continue-link" onClick={onContinue}>{isLast ? 'Reveal the atlas' : 'Continue'} <span>↗</span></button>}</motion.div> : <div className="choice-tools"><button className={`hint-link ${hintVisible ? 'revealed' : ''}`} onClick={() => currentStep && onHint(currentStep)} disabled={hintVisible}><span>✦</span>{hintVisible ? 'Field note revealed' : 'Need a hint?'} {!hintVisible && <small>−40 pts</small>}</button><span>{attempt.mistakes} {attempt.mistakes === 1 ? 'detour' : 'detours'}</span></div>}
            </div>
            {hintVisible && !feedback && <motion.div className="hint-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span>FIELD NOTE</span><p>{currentStep.hint}</p></motion.div>}
          </section>
        </motion.section>}
      </AnimatePresence>
    </div>

    <div className="game-bottom shell-width"><span>🦋 <b>Follow the evidence.</b></span><span>{attempt.mistakes} detours · {attempt.hints} hints</span></div>
  </main>
}

function ChoiceCard({ choice, puzzle, index, wrong, selected, disabled, onClick }: { choice: Choice; puzzle: Puzzle; index: number; wrong: boolean; selected: boolean; disabled: boolean; onClick: () => void }) {
  const media = mediaForEvent(puzzle, choice.id)
  return <button className={`choice-card ${wrong ? 'wrong-choice' : ''} ${selected ? 'selected-choice' : ''}`} disabled={disabled} onClick={onClick} aria-label={`${choice.title}${wrong ? ', incorrect branch' : ''}`}><span className="choice-letter">{String.fromCharCode(65 + index)}</span><span className={`choice-thumb ${media.imageUrl ? 'has-image' : `thumb-${choice.tone}`}`}>{media.imageUrl ? <img src={media.imageUrl} alt="" /> : <b>{choice.icon}</b>}</span><span className="choice-text"><strong>{choice.title}</strong><small>{choice.detail}</small><em>{choice.year}</em></span><span className="choice-arrow">{wrong ? '×' : selected ? '✓' : '↗'}</span></button>
}

function ResultsScreen({ puzzle, attempt, onPlay, onNavigate }: { puzzle: Puzzle; attempt: Attempt; onPlay: (puzzle: Puzzle) => void; onNavigate: (screen: Screen) => void }) {
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)
  const chainEvents = attempt.chain.map((id) => getEventById(puzzle, id))
  const score = attempt.firstTry * 200 + Math.max(0, chainEvents.length - 1 - attempt.firstTry) * 120 + 100 + (attempt.mistakes === 0 && attempt.hints === 0 ? 100 : 0)
  const shareText = `RIPPLE ${numberLabel(puzzle.number)}\n${chainEvents.map((event) => event.icon).join(' → ')}\n${attempt.firstTry}/${puzzle.steps.length} first try · ${attempt.mistakes} detours · ${attempt.hints} field notes\nCan you follow the thread? ${window.location.origin}/?ripple=${puzzle.id}`
  const share = async () => { try { if (navigator.share) await navigator.share({ title: `RIPPLE ${numberLabel(puzzle.number)}`, text: shareText }); else await navigator.clipboard.writeText(shareText); setCopied(true); window.setTimeout(() => setCopied(false), 2200) } catch { try { await navigator.clipboard.writeText(shareText); setCopied(true); window.setTimeout(() => setCopied(false), 2200) } catch { /* optional clipboard */ } } }
  return <main className="page shell-width results-page"><div className="results-hero"><div><span className="micro-label">CASE CLOSED / {numberLabel(puzzle.number)}</span><h1>You found<br /><em>the thread.</em></h1><p>{puzzle.takeaway}</p></div><div className="result-stamp"><span>YOUR TRACE</span><strong>{score}</strong><small>POINTS</small><i /><b>{attempt.mistakes === 0 ? 'CLEAN CONNECTION' : `${attempt.mistakes} DETOUR${attempt.mistakes > 1 ? 'S' : ''} EXPLORED`}</b></div></div><div className="share-card"><div className="share-top"><div><span className="micro-label">SPOILER-FREE FIELD NOTE</span><strong>RIPPLE {numberLabel(puzzle.number)}</strong></div><span className="share-mark">R</span></div><div className="share-path">{chainEvents.map((event, index) => <span key={`${event.id}-${index}`}>{event.icon}{index < chainEvents.length - 1 && <i>→</i>}</span>)}</div><div className="share-stats"><span><b>{attempt.firstTry}</b>/{puzzle.steps.length} first try</span><span><b>{attempt.mistakes}</b> detours</span><span><b>{attempt.hints}</b> field notes</span></div><button className="share-button" onClick={share}>{copied ? 'Copied to clipboard ✓' : 'Share your trace ↗'}</button></div><section className="atlas-results"><div className="section-row"><div><span className="micro-label">THE COMPLETE ATLAS</span><h2>How one thing led to another.</h2></div><span className="evidence-key"><i /> source-backed link</span></div><div className="result-map">{chainEvents.map((event, index) => <div className="result-map-node" key={`${event.id}-${index}`}><motion.div className="result-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 }}><MediaFrame asset={mediaForEvent(puzzle, event.id)} className="result-media" showCredit={false} /><span className="micro-label">{event.year}</span><h3>{event.title}</h3><p>{event.detail}</p></motion.div>{index < chainEvents.length - 1 && <span className="result-map-arrow">↗</span>}</div>)}</div></section><section className="edge-section"><div className="section-row"><div><span className="micro-label">THE ARROWS EXPLAINED</span><h2>Small links. Big consequences.</h2></div><button className="button-quiet" onClick={() => setShowSources(!showSources)}>{showSources ? 'Hide sources' : 'Open sources'} <span>{showSources ? '↑' : '↓'}</span></button></div><div className="edge-list">{puzzle.steps.map((step, index) => <article className="edge-item" key={step.id}><span className="edge-index">0{index + 1}</span><div><div className="edge-route"><span>{getEventById(puzzle, step.from).title}</span><b>→</b><span>{getEventById(puzzle, step.to).title}</span></div><span className="relationship-tag">{step.relationship}</span><p>{step.bridge}</p>{showSources && <a href={step.source.url} target="_blank" rel="noreferrer">Source: {step.source.title} ↗</a>}</div></article>)}</div></section><div className="results-next"><div><span className="micro-label">KEEP INVESTIGATING</span><h2>There’s another thread nearby.</h2></div><div><button className="button-outline" onClick={() => onNavigate('archive')}>Browse archive</button><button className="button-dark" onClick={() => onPlay(puzzles[(puzzles.findIndex((item) => item.id === puzzle.id) + 1) % puzzles.length])}>Next case <span>↗</span></button></div></div></main>
}

function EditorScreen() {
  const [candidates, setCandidates] = useState(editorCandidates)
  const [selectedId, setSelectedId] = useState(editorCandidates[0].id)
  const [reviews, setReviews] = useState<Record<string, EditorialReview>>(() => Object.fromEntries(editorCandidates.map((candidate) => [candidate.id, defaultEditorialReview(candidate)])))
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0]
  const review = reviews[selected.id]
  const toggleCheck = (label: string) => setReviews((current) => ({ ...current, [selected.id]: { ...current[selected.id], checklist: { ...current[selected.id].checklist, [label]: !current[selected.id].checklist[label] } } }))
  const approve = () => { if (!Object.values(review.checklist).every(Boolean)) return; setCandidates((current) => current.map((candidate) => candidate.id === selected.id ? { ...candidate, status: 'Approved' } : candidate)); setReviews((current) => ({ ...current, [selected.id]: { ...current[selected.id], status: 'Approved', reviewedAt: new Date().toISOString() } })) }
  return <main className="editor-page"><div className="editor-head"><div><span className="micro-label">PRIVATE WORKSPACE / EDITOR DESK</span><h1>Research the<br /><em>next ripple.</em></h1><p>Turn a promising connection into a reviewed, source-backed case file.</p></div><div className={`workspace-status ${isSupabaseConfigured ? 'live' : ''}`}><span>●</span><div><b>{isSupabaseConfigured ? 'LIVE WORKSPACE' : 'LOCAL PREVIEW'}</b><small>{isSupabaseConfigured ? 'RLS protected · Supabase connected' : 'Connect Supabase to edit live records'}</small></div></div></div><div className="editor-layout"><aside className="candidate-sidebar"><div className="sidebar-head"><span>CANDIDATE INBOX</span><b>{candidates.length}</b></div>{candidates.map((candidate) => <button key={candidate.id} className={candidate.id === selected.id ? 'candidate-row active' : 'candidate-row'} onClick={() => setSelectedId(candidate.id)}><span className="candidate-status">{candidate.status === 'Approved' ? '✓' : candidate.status === 'Needs review' ? '!' : '·'}</span><span><b>{candidate.title}</b><small>{candidate.category} · {candidate.sourceCount} sources</small></span><span className="candidate-arrow">↗</span></button>)}<div className="sidebar-foot"><span>DAILY RESEARCH JOB</span><strong>Next run · 06:00 UTC</strong><small>Source feeds + Brave Search adapter</small></div></aside><section className="review-panel"><div className="review-toolbar"><span className="micro-label">CANDIDATE / {selected.id.toUpperCase()}</span><span className={`review-status status-${selected.status.toLowerCase().replace(' ', '-')}`}>{selected.status}</span></div><div className="candidate-title"><h2>{selected.title}</h2><p>{selected.hook}</p><div className="candidate-meta"><span>{selected.category}</span><span>{selected.confidence} confidence</span><span>Collected {selected.createdAt}</span></div></div><div className="candidate-evidence"><div><span className="micro-label">SOURCE TRAIL</span><h3>{selected.sourceCount} sources found</h3><p>{selected.notes}</p><button className="button-outline">Open evidence bundle ↗</button></div><div className="candidate-media-preview"><div className="preview-lines" /><span>MEDIA QUEUE</span><strong>{selected.mediaCount} asset{selected.mediaCount === 1 ? '' : 's'} suggested</strong><small>License + credit required</small></div></div><div className="review-checks"><div className="review-section-title"><div><span className="micro-label">PUBLISHING GATE</span><h3>Review before approval.</h3></div><span>{Object.values(review.checklist).filter(Boolean).length}/{Object.keys(review.checklist).length} complete</span></div>{Object.entries(review.checklist).map(([label, passed]) => <button className={`check-row ${passed ? 'passed' : ''}`} key={label} onClick={() => toggleCheck(label)}><span>{passed ? '✓' : '○'}</span><b>{label}</b><small>{passed ? 'verified' : 'needs review'}</small></button>)}</div><div className="review-actions"><button className="button-quiet">Request changes</button><button className="button-dark" disabled={!Object.values(review.checklist).every(Boolean)} onClick={approve}>{selected.status === 'Approved' ? 'Approved ✓' : 'Approve for scheduling'} <span>↗</span></button></div></section></div></main>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [catalog, setCatalog] = useState<Puzzle[]>(puzzles)
  const [daily, setDaily] = useState<Puzzle>(dailyPuzzle)
  const [remotePuzzleIds, setRemotePuzzleIds] = useState<Set<string>>(() => new Set())
  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle>(dailyPuzzle)
  const [stage, setStage] = useState<GameStage>('intro')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(() => readJson<Attempt | null>(ACTIVE_KEY, null))
  const [history, setHistory] = useState<Record<string, Attempt>>(() => readJson<Record<string, Attempt>>(HISTORY_KEY, {}))
  const [loadedUrl, setLoadedUrl] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    void Promise.all([rippleApi.getDaily(), rippleApi.getPuzzles()]).then(([dailyPayload, listPayload]) => {
      if (cancelled) return
      const cloud = (listPayload ?? []).map((puzzle, index) => fromCloud(puzzle, 1000 + index))
      const cloudDaily = dailyPayload ? fromCloud(dailyPayload, cloud.find((puzzle) => puzzle.id === dailyPayload.id)?.number ?? 1000) : null
      if (cloudDaily && !cloud.some((puzzle) => puzzle.id === cloudDaily.id)) cloud.unshift(cloudDaily)
      if (cloud.length) {
        setCatalog([...cloud, ...puzzles.filter((local) => !cloud.some((remote) => remote.id === local.id))])
        setRemotePuzzleIds(new Set(cloud.map((puzzle) => puzzle.id)))
      }
      if (cloudDaily) setDaily(cloudDaily)
    })
    return () => { cancelled = true }
  }, [])

useEffect(() => { const sharedId = new URLSearchParams(window.location.search).get('ripple'); if (sharedId && !loadedUrl) { const puzzle = catalog.find((item) => item.id === sharedId); if (puzzle) { setLoadedUrl(true); void startPuzzle(puzzle) } } }, [catalog, loadedUrl])
  useEffect(() => { if (attempt && !attempt.completed && screen === 'game') window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(attempt)) }, [attempt, screen])

const startPuzzle = async (puzzle: Puzzle) => { setSelectedPuzzle(puzzle); setFeedback(null); if (history[puzzle.id]?.completed) { setAttempt(history[puzzle.id]); setScreen('results'); return } const saved = readJson<Attempt | null>(ACTIVE_KEY, null); let next = saved?.puzzleId === puzzle.id && !saved.completed ? saved : makeAttempt(puzzle); if ((!saved || saved.puzzleId !== puzzle.id || saved.completed) && remotePuzzleIds.has(puzzle.id)) { const server = await rippleApi.createAttempt(puzzle.id); if (!server) { window.alert('Could not connect to RIPPLE. Please try again.'); return } next = { ...next, ...server, puzzleId: puzzle.id, chain: [puzzle.start.id], wrongChoices: [], hintSteps: [], startedAt: typeof server.startedAt === 'number' ? server.startedAt : Date.now() } } setAttempt(next); setStage(next.chain.length > 1 ? 'playing' : 'intro'); setScreen('game') }
  const updateAttempt = (updater: (current: Attempt) => Attempt) => setAttempt((current) => current ? updater(current) : current)
const handleChoice = async (choice: Choice, step: Step) => { if (feedback?.correct || !attempt) return; if (attempt.id && choice.answerId) { const result = await rippleApi.submitAnswer(attempt.id, step.id, choice.answerId); if (!result) { setFeedback({ choiceId: choice.id, correct: false, text: 'Your answer was not submitted. Check your connection and try again.' }); return } if (result.correct) { const triedWrong = attempt.wrongChoices.some((id) => step.choices.some((item) => item.id === id)); updateAttempt((current) => ({ ...current, chain: [...current.chain, choice.id], firstTry: triedWrong ? current.firstTry : current.firstTry + 1 })); setFeedback({ choiceId: choice.id, correct: true, text: result.bridge ?? step.bridge }) } else { updateAttempt((current) => ({ ...current, mistakes: current.mistakes + 1, wrongChoices: [...current.wrongChoices, choice.id] })); setFeedback({ choiceId: choice.id, correct: false, text: result.explanation || 'The evidence points to another branch.' }) } return } if (choice.correct) { const triedWrong = attempt.wrongChoices.some((id) => step.choices.some((item) => item.id === id)); updateAttempt((current) => ({ ...current, chain: [...current.chain, choice.id], firstTry: triedWrong ? current.firstTry : current.firstTry + 1 })); setFeedback({ choiceId: choice.id, correct: true, text: step.bridge }) } else { updateAttempt((current) => ({ ...current, mistakes: current.mistakes + 1, wrongChoices: [...current.wrongChoices, choice.id] })); setFeedback({ choiceId: choice.id, correct: false, text: choice.whyWrong ?? 'The evidence points to another branch.' }) } }
  const handleContinue = () => { if (!attempt || !feedback?.correct) return; if (attempt.stepIndex >= selectedPuzzle.steps.length - 1) { const completed = { ...attempt, completed: true }; setAttempt(completed); setHistory((current) => { const next = { ...current, [selectedPuzzle.id]: completed }; window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); return next }); window.localStorage.removeItem(ACTIVE_KEY); setFeedback(null); setScreen('results') } else { updateAttempt((current) => ({ ...current, stepIndex: current.stepIndex + 1 })); setFeedback(null) } }
const handleHint = async (step: Step) => { if (!attempt || attempt.hintSteps.includes(step.id)) return; if (attempt.id) await rippleApi.requestHint(attempt.id); updateAttempt((current) => ({ ...current, hints: current.hints + 1, hintSteps: [...current.hintSteps, step.id] })) }
  const navigate = (next: Screen) => { setScreen(next); if (next !== 'game') setFeedback(null) }
  const activeResult = useMemo(() => attempt?.completed ? attempt : history[selectedPuzzle.id], [attempt, history, selectedPuzzle.id])

  return <div className={'app ' + (screen === 'game' ? 'is-game-screen' : '')}>
    <div className="paper-grain" aria-hidden="true" />
    {screen !== 'game' && <Header screen={screen} onNavigate={navigate} caseCount={catalog.length} />}
    {screen === 'home' && <HomeScreen puzzle={daily} dailyDone={Boolean(history[daily.id]?.completed)} activeAttempt={attempt && !attempt.completed && attempt.puzzleId === daily.id ? attempt : null} onPlay={startPuzzle} onResume={() => startPuzzle(daily)} onNavigate={navigate} />}
    {screen === 'archive' && <ArchiveScreen history={history} onPlay={startPuzzle} catalog={catalog} />}
    {screen === 'how' && <HowScreen onNavigate={navigate} />}
    {screen === 'game' && attempt && <GameScreen puzzle={selectedPuzzle} attempt={attempt} stage={stage} feedback={feedback} onStageChange={setStage} onChoice={handleChoice} onHint={handleHint} onContinue={handleContinue} onExit={() => navigate('home')} />}
    {screen === 'results' && activeResult && <ResultsScreen puzzle={selectedPuzzle} attempt={activeResult} onPlay={startPuzzle} onNavigate={navigate} />}
    {screen === 'editor' && <EditorScreen />}
    {screen !== 'game' && <footer className="footer"><div className="shell-width"><span><b>RIPPLE</b> / A source-first learning game</span><span><button onClick={() => navigate('editor')}>Editor desk</button><button onClick={() => navigate('how')}>Methodology</button><button>Privacy</button></span></div></footer>}
  </div>
}
