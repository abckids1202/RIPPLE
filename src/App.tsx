import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { dailyPuzzle, getEventById, getPuzzleById, puzzles, type Choice, type Event, type Puzzle, type Step } from './data/puzzles'
import './styles.css'

type Screen = 'home' | 'archive' | 'how' | 'game' | 'results'
type GameStage = 'intro' | 'playing'

type Attempt = {
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
}

type Feedback = {
  choiceId: string
  correct: boolean
  text: string
}

const ACTIVE_KEY = 'ripple-active-attempt-v1'
const HISTORY_KEY = 'ripple-completed-v1'

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

const makeAttempt = (puzzle: Puzzle): Attempt => ({
  puzzleId: puzzle.id,
  chain: [puzzle.start.id],
  stepIndex: 0,
  mistakes: 0,
  hints: 0,
  firstTry: 0,
  wrongChoices: [],
  hintSteps: [],
  startedAt: Date.now(),
})

const numberLabel = (number: number) => `#${String(number).padStart(3, '0')}`

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="RIPPLE home">
      <span className="logo-mark" aria-hidden="true"><span /><span /><span /></span>
      <span>RIPPLE</span>
    </button>
  )
}

function Header({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  return (
    <header className="site-header">
      <Logo onClick={() => onNavigate('home')} />
      <nav className="desktop-nav" aria-label="Main navigation">
        <button className={screen === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate('home')}>Daily ripple</button>
        <button className={screen === 'archive' ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate('archive')}>Archive <span className="nav-count">{puzzles.length}</span></button>
        <button className={screen === 'how' ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate('how')}>How it works</button>
      </nav>
      <div className="header-right">
        <span className="streak-pill"><span aria-hidden="true">✦</span> 4 day streak</span>
        <button className="avatar-button" aria-label="Your profile">LM</button>
      </div>
    </header>
  )
}

function EventCard({ event, compact = false, endpoint = false }: { event: Event; compact?: boolean; endpoint?: boolean }) {
  return (
    <article className={`event-card tone-${event.tone} ${compact ? 'compact' : ''} ${endpoint ? 'endpoint' : ''}`}>
      <div className="event-topline">
        <span className="event-icon" aria-hidden="true">{event.icon}</span>
        {endpoint && <span className="endpoint-label">{event.id === 'tambora' || event.id === 'mold-plate' || event.id === 'microspheres' || event.id === 'amen-break' || event.id === 'zero-wing' ? 'Start' : 'Finish'}</span>}
      </div>
      <h3>{event.title}</h3>
      <p>{event.detail}</p>
      <span className="event-year">{event.year}</span>
    </article>
  )
}

function ThreadArrow({ label, small = false }: { label?: string; small?: boolean }) {
  return (
    <div className={`thread-arrow ${small ? 'small' : ''}`} aria-hidden="true">
      <span className="thread-line" />
      {label && <span className="thread-label">{label}</span>}
      <span className="thread-head">›</span>
    </div>
  )
}

function HomeScreen({
  dailyDone,
  activeAttempt,
  onPlay,
  onResume,
  onNavigate,
}: {
  dailyDone: boolean
  activeAttempt: Attempt | null
  onPlay: (puzzle: Puzzle) => void
  onResume: () => void
  onNavigate: (screen: Screen) => void
}) {
  return (
    <main className="home-page">
      <section className="hero-section page-width">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> DAILY RIPPLE <span className="eyebrow-divider" /> {numberLabel(dailyPuzzle.number)}</div>
          <h1>How did this<br /><em>lead to that?</em></h1>
          <p className="hero-intro">Two events. One hidden chain. Follow the evidence and discover how the world connects.</p>
          <div className="hero-actions">
            {activeAttempt && !dailyDone ? (
              <button className="primary-button" onClick={onResume}>Resume today’s ripple <span>→</span></button>
            ) : (
              <button className="primary-button" onClick={() => onPlay(dailyPuzzle)}>{dailyDone ? 'Review today’s ripple' : 'Play today’s ripple'} <span>→</span></button>
            )}
            <span className="time-note"><span aria-hidden="true">◷</span> 2–4 min · no account needed</span>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars"><span>AS</span><span>JV</span><span>MK</span><span>+</span></div>
            <span>12,842 curious minds played today</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Preview of today's causal chain">
          <div className="scribble scribble-one">follow the thread</div>
          <div className="visual-note note-top"><span>THE CHAIN</span><strong>Every answer<br />changes the map.</strong></div>
          <div className="mini-map">
            <div className="map-grid" />
            <div className="map-path path-one" />
            <div className="map-path path-two" />
            <div className="map-pin pin-a"><span>🌋</span><small>1815</small></div>
            <div className="map-pin pin-b"><span>🌫️</span><small>1816</small></div>
            <div className="map-pin pin-c"><span>🚲</span><small>1817</small></div>
            <div className="butterfly" aria-hidden="true">🦋</div>
          </div>
          <div className="visual-note note-bottom"><span>FIELD NOTE 143</span><strong>Somewhere between<br />ash and invention.</strong></div>
          <span className="visual-stamp">REAL<br />EVENTS<br /><b>↗</b></span>
        </div>
      </section>

      <section className="daily-preview page-width">
        <div className="section-heading">
          <div>
            <span className="section-kicker">TODAY’S CASE FILE</span>
            <h2>A volcanic winter. An unlikely ride.</h2>
          </div>
          <button className="text-button" onClick={() => onPlay(dailyPuzzle)}>Open case file <span>→</span></button>
        </div>
        <div className="preview-board">
          <div className="preview-event"><span className="preview-icon">🌋</span><div><span>BEGINNING</span><strong>Mount Tambora erupts</strong><small>1815 · Sumbawa, Indonesia</small></div></div>
          <div className="preview-thread"><span>4 hidden links</span><div><i /><i /><i /><i /></div></div>
          <div className="preview-event finish"><span className="preview-icon">🚲</span><div><span>ENDING</span><strong>An early bicycle is invented</strong><small>1817 · Mannheim, Germany</small></div></div>
          <div className="preview-board-mark">R</div>
        </div>
      </section>

      <section className="principles-section page-width">
        <div className="principle-intro"><span className="section-kicker">NOT JUST TRIVIA</span><h2>Facts are more fun<br />when they <em>connect.</em></h2></div>
        <div className="principle-list">
          <div className="principle"><span>01</span><div><strong>Think in relationships</strong><p>RIPPLE asks how one thing led to another — not whether you memorized a date.</p></div></div>
          <div className="principle"><span>02</span><div><strong>Wrong answers teach</strong><p>Every broken branch explains what happened, and why it wasn’t the bridge.</p></div></div>
          <div className="principle"><span>03</span><div><strong>Sources on every arrow</strong><p>The reveal is a miniature evidence wall, with a source for every connection.</p></div></div>
        </div>
      </section>

      <section className="archive-preview page-width">
        <div className="section-heading"><div><span className="section-kicker">THE ARCHIVE</span><h2>More ripples to chase</h2></div><button className="text-button" onClick={() => onNavigate('archive')}>See all cases <span>→</span></button></div>
        <div className="archive-grid">{puzzles.slice(1, 4).map((puzzle) => <PuzzleTile key={puzzle.id} puzzle={puzzle} onPlay={onPlay} />)}</div>
      </section>
    </main>
  )
}

function PuzzleTile({ puzzle, onPlay, completed = false }: { puzzle: Puzzle; onPlay: (puzzle: Puzzle) => void; completed?: boolean }) {
  return (
    <button className="puzzle-tile" onClick={() => onPlay(puzzle)} style={{ '--tile-accent': puzzle.accent } as CSSProperties}>
      <div className="tile-top"><span className="tile-number">{numberLabel(puzzle.number)}</span><span className="difficulty">{puzzle.difficulty}</span></div>
      <div className="tile-chain"><span>{puzzle.start.icon}</span><i /><span>{puzzle.steps[0].choices.find((choice) => choice.correct)?.icon}</span><i /><span>{puzzle.ending.icon}</span></div>
      <span className="tile-category">{puzzle.category}</span>
      <h3>{puzzle.question}</h3>
      <div className="tile-bottom"><span>{puzzle.duration}</span>{completed ? <span className="completed-mark">✓ Completed</span> : <span className="tile-arrow">↗</span>}</div>
    </button>
  )
}

function ArchiveScreen({ history, onPlay }: { history: Record<string, Attempt>; onPlay: (puzzle: Puzzle) => void }) {
  const [filter, setFilter] = useState('All cases')
  const categories = ['All cases', ...Array.from(new Set(puzzles.map((puzzle) => puzzle.category)))]
  const visible = filter === 'All cases' ? puzzles : puzzles.filter((puzzle) => puzzle.category === filter)
  return (
    <main className="archive-page page-width page-top">
      <div className="archive-header"><div><span className="section-kicker">ENDLESS ARCHIVE</span><h1>Follow another thread.</h1><p>Every case is a real chain of cause and effect. Pick a subject, then see where it leads.</p></div><div className="archive-total"><strong>{puzzles.length}</strong><span>case files<br />available</span></div></div>
      <div className="filter-row" aria-label="Filter archive">{categories.map((category) => <button key={category} className={filter === category ? 'filter-chip selected' : 'filter-chip'} onClick={() => setFilter(category)}>{category}</button>)}</div>
      <div className="archive-full-grid">{visible.map((puzzle) => <PuzzleTile key={puzzle.id} puzzle={puzzle} onPlay={onPlay} completed={Boolean(history[puzzle.id]?.completed)} />)}</div>
      <div className="archive-footnote"><span className="footnote-mark">✦</span><p>New cases are researched and reviewed before they enter the archive. Have a strange connection in mind? <button className="inline-link">Send a pitch</button></p></div>
    </main>
  )
}

function HowScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <main className="how-page page-width page-top">
      <div className="how-intro"><span className="section-kicker">THE RIPPLE METHOD</span><h1>Curiosity is<br /><em>a chain reaction.</em></h1><p>RIPPLE turns the gap between two real events into a tiny investigation. You don’t need to know the answer — you just need to find the next believable domino.</p></div>
      <div className="method-steps">
        <div className="method-step"><span className="method-index">01</span><div className="method-visual method-start">🌋</div><div><h2>Start with a mystery</h2><p>Two events that seem unrelated. A volcano and a bicycle. A moldy plate and a medical revolution. The stranger the gap, the better.</p></div></div>
        <div className="method-step"><span className="method-index">02</span><div className="method-visual method-choice">↗<span>◌</span>↘</div><div><h2>Choose the next domino</h2><p>Three plausible events appear. Use the dates, the details, and your best theory. One choice moves the chain forward.</p></div></div>
        <div className="method-step"><span className="method-index">03</span><div className="method-visual method-reveal">🌋 → 🚲</div><div><h2>See the evidence</h2><p>Wrong branches are useful. The final map labels each relationship and points to the source behind the story.</p></div></div>
      </div>
      <div className="how-cta"><div><span className="section-kicker">READY?</span><h2>Go find the next link.</h2></div><button className="primary-button" onClick={() => onNavigate('home')}>Play the daily ripple <span>→</span></button></div>
    </main>
  )
}

function GameScreen({
  puzzle,
  attempt,
  stage,
  feedback,
  onStageChange,
  onChoice,
  onHint,
  onContinue,
  onExit,
}: {
  puzzle: Puzzle
  attempt: Attempt
  stage: GameStage
  feedback: Feedback | null
  onStageChange: (stage: GameStage) => void
  onChoice: (choice: Choice, step: Step) => void
  onHint: (step: Step) => void
  onContinue: () => void
  onExit: () => void
}) {
  const currentStep = puzzle.steps[attempt.stepIndex]
  const currentEvent = getEventById(puzzle, currentStep?.from ?? puzzle.start.id)
  const chainEvents = attempt.chain.map((id) => getEventById(puzzle, id))
  const hintVisible = currentStep ? attempt.hintSteps.includes(currentStep.id) : false
  const isLast = attempt.stepIndex === puzzle.steps.length - 1
  const solvedLinks = attempt.chain.length - 1

  return (
    <main className="game-page page-width">
      <div className="game-toolbar"><button className="back-button" onClick={onExit}>← <span>Exit case</span></button><div className="game-meta"><span>{numberLabel(puzzle.number)}</span><i /> <span>{puzzle.category}</span></div><span className="save-note">Saved locally <span>·</span> no account</span></div>
      <div className="game-heading"><div><span className="section-kicker">CASE FILE {numberLabel(puzzle.number)}</span><h1>{puzzle.question}</h1></div><div className="step-count"><strong>{String(Math.min(solvedLinks + 1, puzzle.steps.length)).padStart(2, '0')}</strong><span>/ {String(puzzle.steps.length).padStart(2, '0')} links</span></div></div>
      <div className="progress-track" aria-label={`Step ${Math.min(solvedLinks + 1, puzzle.steps.length)} of ${puzzle.steps.length}`}>
        <div className="progress-fill" style={{ width: `${(solvedLinks / puzzle.steps.length) * 100}%` }} />
        {puzzle.steps.map((step, index) => <span key={step.id} className={index < solvedLinks ? 'progress-dot done' : index === attempt.stepIndex ? 'progress-dot current' : 'progress-dot'} style={{ left: `${(index / puzzle.steps.length) * 100}%` }} />)}
        <span className="progress-dot endpoint-dot" style={{ left: '100%' }} />
      </div>

      <AnimatePresence mode="wait">
        {stage === 'intro' ? (
          <motion.section className="intro-stage" key="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <p className="intro-lede">{puzzle.hook}</p>
            <div className="endpoint-pair"><EventCard event={puzzle.start} endpoint /><ThreadArrow label="hidden chain" /><EventCard event={puzzle.ending} endpoint /></div>
            <div className="intro-bottom"><div className="rule-note"><span>RULE OF THUMB</span><p>Choose the event that makes the next one feel more likely. You can’t get stuck.</p></div><button className="primary-button begin-button" onClick={() => onStageChange('playing')}>Begin the chain <span>→</span></button></div>
          </motion.section>
        ) : (
          <motion.section className="play-stage" key={currentStep.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="active-chain"><div className="chain-caption"><span>THE THREAD SO FAR</span><span>{solvedLinks} of {puzzle.steps.length} connected</span></div><div className="chain-strip">{chainEvents.map((event, index) => <div className="strip-node-wrap" key={`${event.id}-${index}`}><div className={`strip-node ${index === chainEvents.length - 1 ? 'active' : ''}`}><span>{event.icon}</span></div>{index < chainEvents.length - 1 && <span className="strip-link">→</span>}</div>)}{puzzle.steps.length - solvedLinks > 0 && <div className="strip-gap">{Array.from({ length: puzzle.steps.length - solvedLinks }, (_, index) => <span key={`gap-${index}`}>?</span>)}</div>}{solvedLinks < puzzle.steps.length && <div className="strip-end"><span>{puzzle.ending.icon}</span><small>FINISH</small></div>}</div></div>
            <div className="current-case"><div className="current-event-wrap"><span className="current-label">CURRENT EVENT</span><EventCard event={currentEvent} /></div><div className="choices-wrap"><div className="choice-heading"><div><span className="section-kicker">NEXT DOMINO</span><h2>{currentStep.question}</h2></div><span className="choice-count">3 options</span></div><div className="choices" role="group" aria-label="Choose the next event">{currentStep.choices.map((choice, index) => <ChoiceCard key={choice.id} choice={choice} index={index} wrong={attempt.wrongChoices.includes(choice.id)} selected={feedback?.choiceId === choice.id} disabled={Boolean(feedback?.correct) || attempt.wrongChoices.includes(choice.id)} onClick={() => onChoice(choice, currentStep)} />)}</div>
              <div className="feedback-area" aria-live="polite">{feedback ? <motion.div className={`feedback-card ${feedback.correct ? 'success' : 'wrong'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span className="feedback-icon">{feedback.correct ? '✓' : '×'}</span><div><strong>{feedback.correct ? (isLast ? 'The final link.' : 'That’s the bridge.') : 'A believable branch — but not this chain.'}</strong><p>{feedback.text}</p></div>{feedback.correct && <button className="continue-button" onClick={onContinue}>{isLast ? 'Reveal the ripple' : 'Continue'} <span>→</span></button>}</motion.div> : <div className="choice-tools"><button className={`hint-button ${hintVisible ? 'revealed' : ''}`} onClick={() => currentStep && onHint(currentStep)} disabled={hintVisible}><span>✦</span> {hintVisible ? 'Hint revealed' : 'Need a nudge?'} <small>{hintVisible ? '' : '−40 pts'}</small></button><span className="mistake-count">{attempt.mistakes} {attempt.mistakes === 1 ? 'wrong branch' : 'wrong branches'}</span></div>}</div>
              {hintVisible && !feedback && <motion.div className="hint-card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}><span>FIELD NOTE</span><p>{currentStep.hint}</p></motion.div>}
            </div></div>
          </motion.section>
        )}
      </AnimatePresence>
      <div className="game-footer"><span><span className="footer-butterfly">🦋</span> Follow the evidence.</span><span>RIPPLE is a game about relationships, not perfect recall.</span></div>
    </main>
  )
}

function ChoiceCard({ choice, wrong, selected, disabled, onClick, index }: { choice: Choice; wrong: boolean; selected: boolean; disabled: boolean; onClick: () => void; index: number }) {
  return (
    <button className={`choice-card tone-${choice.tone} ${wrong ? 'wrong-choice' : ''} ${selected ? 'selected-choice' : ''}`} disabled={disabled} onClick={onClick} aria-label={`${choice.title}${wrong ? ', incorrect branch' : ''}`}>
      <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
      <span className="choice-icon" aria-hidden="true">{choice.icon}</span>
      <span className="choice-copy"><strong>{choice.title}</strong><small>{choice.detail}</small><em>{choice.year}</em></span>
      <span className="choice-status">{wrong ? '×' : selected ? '✓' : '↗'}</span>
    </button>
  )
}

function ResultsScreen({ puzzle, attempt, onPlay, onNavigate }: { puzzle: Puzzle; attempt: Attempt; onPlay: (puzzle: Puzzle) => void; onNavigate: (screen: Screen) => void }) {
  const [copied, setCopied] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const chainEvents = attempt.chain.map((id) => getEventById(puzzle, id))
  const score = attempt.firstTry * 200 + Math.max(0, attempt.chain.length - 1 - attempt.firstTry) * 120 + 100 + (attempt.mistakes === 0 && attempt.hints === 0 ? 100 : 0)
  const shareText = `RIPPLE ${numberLabel(puzzle.number)}\n${chainEvents.map((event) => event.icon).join(' → ')}\n${attempt.firstTry}/${puzzle.steps.length} links first try · ${attempt.mistakes} ${attempt.mistakes === 1 ? 'mistake' : 'mistakes'} · ${attempt.hints} ${attempt.hints === 1 ? 'hint' : 'hints'}\nCan you connect them? ${window.location.origin}/?ripple=${puzzle.id}`

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `RIPPLE ${numberLabel(puzzle.number)}`, text: shareText })
      else await navigator.clipboard.writeText(shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      try { await navigator.clipboard.writeText(shareText); setCopied(true); window.setTimeout(() => setCopied(false), 2200) } catch { /* Clipboard is optional. */ }
    }
  }

  return (
    <main className="results-page page-width page-top">
      <div className="result-hero"><div><span className="section-kicker">RIPPLE COMPLETE · {numberLabel(puzzle.number)}</span><h1>You traced<br /><em>the ripple.</em></h1><p>{puzzle.takeaway}</p></div><div className="result-score"><span>YOUR TRACE</span><strong>{score}</strong><small>points</small><div className="score-rule" /><span className="score-note">{attempt.mistakes === 0 ? 'Clean connection' : `${attempt.mistakes} branch${attempt.mistakes > 1 ? 'es' : ''} explored`}</span></div></div>
      <div className="share-card"><div className="share-card-top"><div><span className="section-kicker">SPOILER-FREE RESULT</span><strong>RIPPLE {numberLabel(puzzle.number)}</strong></div><span className="share-butterfly">🦋</span></div><div className="share-chain">{chainEvents.map((event, index) => <span key={`${event.id}-${index}`}>{event.icon}{index < chainEvents.length - 1 && <i>→</i>}</span>)}</div><div className="share-stats"><span><b>{attempt.firstTry}</b>/{puzzle.steps.length} first try</span><span><b>{attempt.mistakes}</b> {attempt.mistakes === 1 ? 'mistake' : 'mistakes'}</span><span><b>{attempt.hints}</b> {attempt.hints === 1 ? 'hint' : 'hints'}</span></div><button className="share-button" onClick={handleShare}>{copied ? 'Copied to clipboard ✓' : 'Share your trace ↗'}</button></div>
      <section className="story-section"><div className="section-heading"><div><span className="section-kicker">THE COMPLETE STORY</span><h2>How one thing led to another.</h2></div><span className="relationship-key"><i className="key-dot" /> evidence-backed link</span></div><div className="story-map">{chainEvents.map((event, index) => <div className="story-node-wrap" key={`${event.id}-${index}`}><motion.div className="story-node" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}><span className="story-icon">{event.icon}</span><span className="story-year">{event.year}</span><strong>{event.title}</strong><p>{event.detail}</p></motion.div>{index < chainEvents.length - 1 && <div className="story-connector"><span className="connector-line" /><span>↗</span></div>}</div>)}</div></section>
      <section className="explanation-section"><div className="section-heading"><div><span className="section-kicker">THE ARROWS EXPLAINED</span><h2>Small links. Big ripple.</h2></div><button className="source-toggle" onClick={() => setShowSources(!showSources)}>{showSources ? 'Hide sources' : 'Show sources'} <span>{showSources ? '↑' : '↓'}</span></button></div><div className="edge-list">{puzzle.steps.map((step, index) => <article className="edge-row" key={step.id}><div className="edge-number">0{index + 1}</div><div className="edge-body"><div className="edge-title"><span>{getEventById(puzzle, step.from).icon} {getEventById(puzzle, step.from).title}</span><b>→</b><span>{getEventById(puzzle, step.to).icon} {getEventById(puzzle, step.to).title}</span></div><div className="relationship-pill">{step.relationship}</div><p>{step.bridge}</p>{showSources && <a className="edge-source" href={step.source.url} target="_blank" rel="noreferrer">Source: {step.source.title} <span>↗</span></a>}</div></article>)}</div></section>
      <div className="result-next"><div><span className="section-kicker">KEEP GOING</span><h2>Another strange connection?</h2></div><div className="result-next-actions"><button className="secondary-button" onClick={() => onNavigate('archive')}>Browse archive</button><button className="primary-button" onClick={() => onPlay(puzzles[(puzzles.findIndex((item) => item.id === puzzle.id) + 1) % puzzles.length])}>Next case <span>→</span></button></div></div>
    </main>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle>(dailyPuzzle)
  const [stage, setStage] = useState<GameStage>('intro')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(() => readJson<Attempt | null>(ACTIVE_KEY, null))
  const [history, setHistory] = useState<Record<string, Attempt>>(() => readJson<Record<string, Attempt>>(HISTORY_KEY, {}))
  const [loadedFromUrl, setLoadedFromUrl] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedId = params.get('ripple')
    if (sharedId && !loadedFromUrl) {
      const puzzle = getPuzzleById(sharedId)
      setSelectedPuzzle(puzzle)
      setScreen('game')
      setStage('intro')
      setAttempt(makeAttempt(puzzle))
      setLoadedFromUrl(true)
    }
  }, [loadedFromUrl])

  useEffect(() => {
    if (attempt && !attempt.completed && screen === 'game') window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(attempt))
  }, [attempt, screen])

  const dailyDone = Boolean(history[dailyPuzzle.id]?.completed)
  const startPuzzle = (puzzle: Puzzle) => {
    setSelectedPuzzle(puzzle)
    setFeedback(null)
    const previous = history[puzzle.id]
    if (previous?.completed) {
      setAttempt(previous)
      setScreen('results')
      return
    }
    const saved = readJson<Attempt | null>(ACTIVE_KEY, null)
    const next = saved?.puzzleId === puzzle.id && !saved.completed ? saved : makeAttempt(puzzle)
    setAttempt(next)
    setStage(next.chain.length > 1 ? 'playing' : 'intro')
    setScreen('game')
  }

  const resumeDaily = () => startPuzzle(dailyPuzzle)

  const updateAttempt = (updater: (current: Attempt) => Attempt) => setAttempt((current) => current ? updater(current) : current)

  const handleChoice = (choice: Choice, step: Step) => {
    if (feedback?.correct || !attempt) return
    if (choice.correct) {
      const firstTry = attempt.wrongChoices.some((id) => step.choices.some((item) => item.id === id)) ? attempt.firstTry : attempt.firstTry + 1
      updateAttempt((current) => ({ ...current, chain: [...current.chain, choice.id], firstTry }))
      setFeedback({ choiceId: choice.id, correct: true, text: step.bridge })
    } else {
      updateAttempt((current) => ({ ...current, mistakes: current.mistakes + 1, wrongChoices: [...current.wrongChoices, choice.id] }))
      setFeedback({ choiceId: choice.id, correct: false, text: choice.whyWrong ?? 'This branch is plausible, but the evidence points somewhere else.' })
    }
  }

  const handleContinue = () => {
    if (!attempt || !feedback?.correct) return
    if (attempt.stepIndex >= selectedPuzzle.steps.length - 1) {
      const completed = { ...attempt, completed: true }
      setAttempt(completed)
      setHistory((current) => {
        const next = { ...current, [selectedPuzzle.id]: completed }
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
        return next
      })
      window.localStorage.removeItem(ACTIVE_KEY)
      setFeedback(null)
      setScreen('results')
    } else {
      updateAttempt((current) => ({ ...current, stepIndex: current.stepIndex + 1 }))
      setFeedback(null)
    }
  }

  const handleHint = (step: Step) => {
    if (!attempt || attempt.hintSteps.includes(step.id)) return
    updateAttempt((current) => ({ ...current, hints: current.hints + 1, hintSteps: [...current.hintSteps, step.id] }))
  }

  const navigate = (nextScreen: Screen) => {
    setScreen(nextScreen)
    if (nextScreen !== 'game') setFeedback(null)
  }

  const activeResults = useMemo(() => attempt?.completed ? attempt : history[selectedPuzzle.id], [attempt, history, selectedPuzzle.id])

  return (
    <div className="app-shell">
      {screen !== 'game' && <Header screen={screen} onNavigate={navigate} />}
      {screen === 'home' && <HomeScreen dailyDone={dailyDone} activeAttempt={attempt && !attempt.completed && attempt.puzzleId === dailyPuzzle.id ? attempt : null} onPlay={startPuzzle} onResume={resumeDaily} onNavigate={navigate} />}
      {screen === 'archive' && <ArchiveScreen history={history} onPlay={startPuzzle} />}
      {screen === 'how' && <HowScreen onNavigate={navigate} />}
      {screen === 'game' && attempt && <GameScreen puzzle={selectedPuzzle} attempt={attempt} stage={stage} feedback={feedback} onStageChange={setStage} onChoice={handleChoice} onHint={handleHint} onContinue={handleContinue} onExit={() => navigate('home')} />}
      {screen === 'results' && activeResults && <ResultsScreen puzzle={selectedPuzzle} attempt={activeResults} onPlay={startPuzzle} onNavigate={navigate} />}
      <footer className="site-footer"><div className="page-width"><span>RIPPLE <small>© 2025 · A game about connected things.</small></span><span><button onClick={() => navigate('how')}>Methodology</button><button>Privacy</button><button>Feedback</button></span></div></footer>
    </div>
  )
}
