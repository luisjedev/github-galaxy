import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  transitionAppState,
  type AppError,
  type AppState,
  type LoadingStage,
} from './domain/app-state'
import {
  atmosphereRadius,
  collisionRadius,
  informationZoneRadius,
  STAR_RADIUS,
  type ActiveCelestialBody,
} from './domain/celestial-interaction'
import { evaluateCompatibility, type Compatibility } from './domain/compatibility'
import { describeShipAppearance } from './domain/flight'
import { type GitHubSystem, type PlanetDescriptor } from './domain/github-system'
import {
  GalaxyScene,
  SHIP_WORLD_SCALE,
  type CelestialMarkerState,
} from './components/GalaxyScene'
import {
  useProceduralAudio,
  type AudioExperienceState,
} from './hooks/use-procedural-audio'
import type { ReactiveAudioState } from './platform/procedural-audio'
import { validateGitHubUsername } from './domain/github-username'
import { readBrowserCapabilities } from './platform/browser-capabilities'
import { readVisualSettings } from './platform/visual-settings'
import { GitHubRequestError, loadGitHubSystem } from './platform/github-client'
import { generateSystemOrbitalVisual } from './domain/orbital-generation'
import { calculateSystemExitRadius } from './domain/wormhole'
import {
  isWormholeTravelPhase,
  useWormholeTravel,
} from './hooks/use-wormhole-travel'

const controls = [
  ['W / S', 'Avanzar · frenar / reversa'],
  ['A / D', 'Girar a la izquierda · derecha'],
  ['J / K', 'Inclinar abajo · arriba (combinar con W / S)'],
  ['Espacio', 'Turbo'],
  ['E', 'Abrir destino'],
  ['R', 'Volver al punto de entrada'],
  ['Esc', 'Pausa'],
] as const

function Brand() {
  return (
    <div className="brand" aria-label="GitGalaxy">
      <span className="brand__orbit" aria-hidden="true">
        <span className="brand__planet" />
      </span>
      <div>
        <span className="brand__name" role="heading" aria-level={1}>
          GitGalaxy
        </span>
        <span className="brand__tagline">Tu código, un universo</span>
      </div>
    </div>
  )
}

function CompatibilityNotice({ reason }: { reason: 'mobile' | 'webgl' }) {
  const isMobile = reason === 'mobile'

  return (
    <main className="centered-layout">
      <section className="glass-panel notice" role="alert" data-app-state="error">
        <Brand />
        <div className="notice__icon" aria-hidden="true">
          {isMobile ? '⌨' : '◌'}
        </div>
        <p className="eyebrow">Experiencia no compatible</p>
        <h1>
          {isMobile
            ? 'GitGalaxy requiere un ordenador de escritorio y teclado'
            : 'WebGL no está disponible en este navegador'}
        </h1>
        <p>
          {isMobile
            ? 'Este MVP está diseñado para pilotarse con teclado y no ofrece controles táctiles incompletos.'
            : 'Actualiza tu navegador o activa la aceleración gráfica para explorar sistemas en GitGalaxy.'}
        </p>
      </section>
    </main>
  )
}

function Menu({ onExplore }: { onExplore: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedUsername = username.trim()
    const error = validateGitHubUsername(normalizedUsername)
    setValidationError(error)
    if (!error) onExplore(normalizedUsername)
  }

  return (
    <main className="menu-layout" data-app-state="menu">
      <section className="hero">
        <Brand />
        <div className="hero__copy">
          <p className="eyebrow">Exploración procedural de GitHub</p>
          <h1>
            Convierte proyectos
            <br />
            en <span>mundos.</span>
          </h1>
          <p className="hero__description">
            Escribe un usuario de GitHub y contempla sus repositorios públicos como un sistema solar
            que podrás pilotar y descubrir.
          </p>
        </div>

        <form className="explore-form" onSubmit={submit}>
          <label htmlFor="github-username">Usuario de GitHub</label>
          <div className="explore-form__controls">
            <span className="prompt" aria-hidden="true">
              @
            </span>
            <input
              id="github-username"
              name="username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="octocat"
              value={username}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'username-error' : 'username-hint'}
              onChange={(event) => {
                setUsername(event.target.value)
                setValidationError(null)
              }}
            />
            <button type="submit">
              Explorar sistema <span aria-hidden="true">→</span>
            </button>
          </div>
          {validationError ? (
            <p className="form-error" id="username-error" role="alert">
              {validationError}
            </p>
          ) : (
            <p className="form-hint" id="username-hint">
              Pulsa Enter para despegar
            </p>
          )}
          <p className="api-notice">
            Usamos la API pública de GitHub sin autenticación. Tiene un límite de solicitudes y nunca
            te pediremos un token.
          </p>
        </form>
      </section>

      <aside className="controls-panel" aria-labelledby="controls-title">
        <p className="eyebrow">Antes de despegar</p>
        <h2 id="controls-title">Pilota con tu teclado</h2>
        <p>GitGalaxy es una experiencia de escritorio con teclado.</p>
        <dl>
          {controls.map(([key, action]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </main>
  )
}

const loadingMessages: Record<LoadingStage, string> = {
  profile: 'Consultando el perfil público',
  repositories: 'Recopilando los proyectos públicos',
  system: 'Generando una estrella estable',
}

function Loading({ username, stage }: { username: string; stage: LoadingStage }) {
  return (
    <main className="centered-layout" data-app-state="loading">
      <section className="glass-panel loading-panel" role="status" aria-live="polite">
        <Brand />
        <div className="loader" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">Trazando órbitas</p>
        <h1>Preparando el sistema de {username}</h1>
        <p>
          {loadingMessages[stage]} de {username}…
        </p>
      </section>
    </main>
  )
}

function Planet({ planet }: { planet: PlanetDescriptor }) {
  const { appearance, repository } = planet
  const appearanceDescription = [
    appearance.state === 'archived'
      ? 'archivado'
      : appearance.state === 'neutral'
        ? 'sin lenguaje'
        : appearance.biome,
    repository.size === 0 ? 'vacío' : null,
    appearance.hasRing ? 'plantilla con anillo' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className="planet-orbit"
      role="img"
      aria-label={`Planeta ${repository.name}, ${appearanceDescription}`}
      data-celestial-body="planet"
      data-repository-id={repository.id}
      data-orbit-radius={planet.orbitRadius}
      data-orbit-period={planet.orbitPeriodSeconds}
      data-planet-radius={planet.radius}
      data-body-radius={planet.radius}
      data-collision-radius={collisionRadius(planet.radius)}
      data-atmosphere-radius={atmosphereRadius(planet.radius)}
      data-information-radius={informationZoneRadius(planet.radius)}
    >
      <span
        className={`procedural-planet procedural-planet--${appearance.surfaceFeature}`}
        data-appearance-state={appearance.state}
        data-biome={appearance.biome}
        data-language-family={appearance.languageFamily ?? 'none'}
        data-size-state={repository.size === 0 ? 'empty' : 'populated'}
        data-surface-feature={appearance.surfaceFeature}
        data-template={appearance.hasRing}
      >
        {appearance.hasRing ? <span className="planet-ring" /> : null}
      </span>
    </div>
  )
}

function CelestialCard({
  activeBody,
  system,
}: {
  activeBody: ActiveCelestialBody
  system: GitHubSystem
}) {
  if (activeBody.kind === 'star') {
    const { profile } = system
    const displayName = profile.name ?? profile.login

    return (
      <aside
        className="celestial-card"
        aria-label={`Ficha de ${displayName}`}
        aria-live="polite"
        data-active-body="star"
      >
        <div className="celestial-card__heading">
          <img src={profile.avatar_url} alt={`Avatar de ${displayName}`} />
          <div>
            <p className="eyebrow">Estrella próxima</p>
            <h2>{displayName}</h2>
            <p className="celestial-card__handle">@{profile.login}</p>
          </div>
        </div>
        <p className="celestial-card__description">
          {profile.bio ?? 'Sin biografía pública.'}
        </p>
        <dl className="celestial-card__metrics">
          <div>
            <dt>Seguidores</dt>
            <dd>{profile.followers.toLocaleString('es-ES')} seguidores</dd>
          </div>
        </dl>
        <a href={profile.html_url} target="_blank" rel="noreferrer noopener">
          Ver perfil en GitHub
        </a>
        <p className="celestial-card__hint">Pulsa E para abrir en una pestaña nueva</p>
      </aside>
    )
  }

  const { repository } = activeBody.planet
  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(repository.updated_at))

  return (
    <aside
      className="celestial-card"
      aria-label={`Ficha de ${repository.name}`}
      aria-live="polite"
      data-active-body={`planet:${repository.id}`}
    >
      <p className="eyebrow">Planeta próximo</p>
      <h2>{repository.name}</h2>
      <p className="celestial-card__description">
        {repository.description ?? 'Sin descripción pública.'}
      </p>
      <dl className="celestial-card__metrics celestial-card__metrics--planet">
        <div>
          <dt>Lenguaje</dt>
          <dd>{repository.language ?? 'Sin lenguaje'}</dd>
        </div>
        <div>
          <dt>Estrellas</dt>
          <dd>{repository.stargazers_count.toLocaleString('es-ES')} estrellas</dd>
        </div>
        <div>
          <dt>Forks</dt>
          <dd>{repository.forks_count.toLocaleString('es-ES')} forks</dd>
        </div>
        <div>
          <dt>Tamaño</dt>
          <dd>{repository.size.toLocaleString('es-ES')} KB</dd>
        </div>
        <div>
          <dt>Actualización</dt>
          <dd>
            <time dateTime={repository.updated_at}>{formattedDate}</time>
          </dd>
        </div>
      </dl>
      <a href={repository.html_url} target="_blank" rel="noreferrer noopener">
        Ver repositorio en GitHub
      </a>
      <p className="celestial-card__hint">Pulsa E para abrir en una pestaña nueva</p>
    </aside>
  )
}

type GuideDirection =
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left'
  | 'up'
  | 'up-right'

const guideDirectionLabel: Record<GuideDirection, string> = {
  right: 'a la derecha',
  'down-right': 'abajo a la derecha',
  down: 'abajo',
  'down-left': 'abajo a la izquierda',
  left: 'a la izquierda',
  'up-left': 'arriba a la izquierda',
  up: 'arriba',
  'up-right': 'arriba a la derecha',
}

function directionName(angleDegrees: number): GuideDirection {
  const normalized = (angleDegrees + 360) % 360
  if (normalized < 22.5 || normalized >= 337.5) return 'right'
  if (normalized < 67.5) return 'down-right'
  if (normalized < 112.5) return 'down'
  if (normalized < 157.5) return 'down-left'
  if (normalized < 202.5) return 'left'
  if (normalized < 247.5) return 'up-left'
  if (normalized < 292.5) return 'up'
  return 'up-right'
}

function placeStarGuide(
  marker: CelestialMarkerState | undefined,
  viewportAspectRatio: number,
) {
  if (!marker || marker.status === 'visible' || !marker.direction) return null
  let directionX = marker.direction.x
  let directionY = marker.direction.y
  if (Math.hypot(directionX, directionY) < 0.001) {
    directionX = 0
    directionY = 1
  }
  const scale = Math.min(
    directionX === 0 ? Number.POSITIVE_INFINITY : 44 / Math.abs(directionX),
    directionY === 0 ? Number.POSITIVE_INFINITY : 42 / Math.abs(directionY),
  )
  const angleDegrees =
    (Math.atan2(directionY, directionX * viewportAspectRatio) * 180) / Math.PI

  return {
    angleDegrees,
    direction: directionName(angleDegrees),
    screenX: 50 + directionX * scale,
    screenY: 50 + directionY * scale,
  }
}

function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const actions = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
  )
  if (actions.length === 0) return

  const activeIndex = actions.indexOf(document.activeElement as HTMLButtonElement)
  const shouldWrapBackward = event.shiftKey && activeIndex <= 0
  const shouldWrapForward = !event.shiftKey && activeIndex === actions.length - 1
  if (!shouldWrapBackward && !shouldWrapForward) return

  event.preventDefault()
  actions[shouldWrapBackward ? actions.length - 1 : 0].focus()
}

const audioPresentation: Record<
  AudioExperienceState,
  { action: string; icon: string; status: string }
> = {
  waiting: { action: 'Activar audio', icon: '◖×', status: 'Activar audio' },
  active: { action: 'Silenciar audio', icon: '◖))', status: 'Audio activo' },
  muted: { action: 'Activar audio', icon: '◖×', status: 'Audio silenciado' },
  unavailable: { action: 'Audio no disponible', icon: '◖×', status: 'Audio no disponible' },
}

function Exploration({
  system,
  paused,
  recentLogins,
  audioState,
  onAudioToggle,
  onAudioUpdate,
  onTogglePause,
  onReturnToMenu,
  onSystemArrival,
}: {
  system: GitHubSystem
  paused: boolean
  recentLogins: string[]
  audioState: AudioExperienceState
  onAudioToggle: () => void
  onAudioUpdate: (state: ReactiveAudioState) => void
  onTogglePause: () => void
  onReturnToMenu: () => void
  onSystemArrival: (destination: GitHubSystem) => void
}) {
  const { profile, ownRepositoryCount, planets, starAppearance, starSeed } = system
  const [visualSettings] = useState(readVisualSettings)
  const orbitalVisual = useMemo(
    () => generateSystemOrbitalVisual(system, visualSettings.quality, STAR_RADIUS),
    [system, visualSettings.quality],
  )
  const systemExitRadius = calculateSystemExitRadius(orbitalVisual.asteroidBelt.outerRadius)
  const {
    experienceRef,
    flight,
    flightState,
    advanceFlightFrame,
    initialFlight,
    activeBody,
    atmosphereContact,
    simulationElapsedSeconds,
    teleportPhase,
    wormhole,
    destinationLogin,
    controlsBlocked,
    audioPhase: wormholeAudioPhase,
    startWormholeTravel,
    stayInSystem,
  } = useWormholeTravel({
    system,
    paused,
    recentLogins,
    reducedMotion: visualSettings.reducedMotion,
    systemExitRadius,
    onSystemArrival,
  })
  const shipAppearance = describeShipAppearance(system)
  const [orientationMarkers, setOrientationMarkers] = useState<CelestialMarkerState[]>([])
  const starMarker = orientationMarkers.find((marker) => marker.key === 'star')
  const starGuide = placeStarGuide(starMarker, window.innerWidth / window.innerHeight)

  useEffect(() => {
    onAudioUpdate({
      speed: flight.speed,
      turbo: flight.turbo,
      proximity: Boolean(activeBody),
      paused,
      teleportPhase: wormholeAudioPhase,
    })
  }, [activeBody, audioState, flight.speed, flight.turbo, onAudioUpdate, paused, wormholeAudioPhase])

  const currentAudioPresentation = audioPresentation[audioState]

  return (
    <main
      ref={experienceRef}
      className="system-layout"
      data-app-state={paused ? 'pause' : 'exploration'}
      data-wormhole-phase={wormhole.phase}
      data-controls-locked={controlsBlocked}
      data-system-exit-radius={systemExitRadius}
      data-origin-user={profile.login}
      data-destination-user={destinationLogin ?? 'none'}
      aria-label="Experiencia de vuelo"
      tabIndex={0}
      autoFocus
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.repeat) return
        event.preventDefault()
        if (wormhole.phase === 'idle') onTogglePause()
      }}
    >
      <section className="system-summary">
        <p className="eyebrow">Sistema listo para explorar</p>
        <h1>Sistema de {profile.login}</h1>
        {planets.length > 0 ? <p>{planets.length} planetas seleccionados</p> : null}
        {ownRepositoryCount === 0 ? <p>Una estrella solitaria espera tu visita.</p> : null}
      </section>

      <GalaxyScene
        system={system}
        initialFlight={initialFlight.state}
        flightRef={flightState}
        advanceFlightFrame={advanceFlightFrame}
        simulationElapsedSeconds={simulationElapsedSeconds}
        onMarkersChange={setOrientationMarkers}
        paused={controlsBlocked}
        settings={visualSettings}
        orbitalVisual={orbitalVisual}
      />

      <div className="celestial-markers" aria-label="Marcadores de cuerpos celestes">
        {orientationMarkers.map((marker) => (
          <span
            key={marker.key}
            className="celestial-marker"
            hidden={marker.status !== 'visible'}
            style={{
              left: `${marker.screenPosition.x}%`,
              top: `${marker.screenPosition.y}%`,
            }}
            data-marker-body={marker.key}
            data-marker-status={marker.status}
            data-screen-x={marker.screenPosition.x.toFixed(3)}
            data-screen-y={marker.screenPosition.y.toFixed(3)}
          >
            <span className="celestial-marker__reticle" aria-hidden="true" />
            {marker.label}
          </span>
        ))}
      </div>

      <aside
        className="star-guide"
        role="status"
        aria-label={
          starGuide
            ? `La estrella está ${guideDirectionLabel[starGuide.direction]}`
            : 'Dirección hacia la estrella'
        }
        hidden={!starGuide}
        style={
          starGuide
            ? { left: `${starGuide.screenX}%`, top: `${starGuide.screenY}%` }
            : undefined
        }
        data-star-guide
        data-guide-status={starGuide ? 'visible' : 'hidden'}
        data-guide-direction={starGuide?.direction ?? 'none'}
        data-guide-angle={starGuide?.angleDegrees.toFixed(2) ?? 'none'}
        data-screen-x={starGuide?.screenX.toFixed(3) ?? 'none'}
        data-screen-y={starGuide?.screenY.toFixed(3) ?? 'none'}
        data-star-status={starMarker?.status ?? 'unknown'}
      >
        <span
          className="star-guide__arrow"
          style={{ transform: `rotate(${starGuide?.angleDegrees ?? 0}deg)` }}
          aria-hidden="true"
        >
          ➤
        </span>
        <span>Estrella</span>
      </aside>

      <div className="scene-observability" aria-label={`Sistema planetario de ${profile.login}`}>
        {planets.map((planet) => (
          <Planet key={planet.repository.id} planet={planet} />
        ))}
        <div
          className="procedural-star"
          role="img"
          aria-label={`Estrella de ${profile.login}`}
          data-star-seed={starSeed}
          data-primary-hue={starAppearance.primaryHue}
          data-language-families={starAppearance.languageFamilies.join(',')}
          data-stellar-palette="solar"
          data-visual-atmosphere="none"
          data-luminosity={starAppearance.luminosity}
          data-body-radius={STAR_RADIUS}
          data-collision-radius={collisionRadius(STAR_RADIUS)}
          data-atmosphere-radius={atmosphereRadius(STAR_RADIUS)}
          data-information-radius={informationZoneRadius(STAR_RADIUS)}
        />
        <div
          className="procedural-ship"
          role="img"
          aria-label="Nave procedural del perfil con luz y estela tecnológicas"
          data-testid="player-ship"
          data-primary-hue={shipAppearance.primaryHue}
          data-accent-hue={shipAppearance.accentHue}
          data-world-scale={SHIP_WORLD_SCALE}
          data-initial-destination={initialFlight.destinationRepositoryId ?? 'star'}
        >
          Nave low-poly con luz y estela tecnológicas
        </div>
      </div>

      {activeBody && wormhole.phase === 'idle'
        ? <CelestialCard activeBody={activeBody} system={system} />
        : null}

      {atmosphereContact ? (
        <aside
          className="atmosphere-warning"
          role="alert"
          aria-label="Peligro atmosférico"
          data-contact-body={atmosphereContact.key}
        >
          <strong>Peligro atmosférico</strong>
          <span>La nave no está preparada para atravesar la atmósfera.</span>
        </aside>
      ) : null}

      <button
        type="button"
        className="audio-control"
        data-testid="audio-control"
        data-audio-state={audioState}
        aria-label={currentAudioPresentation.action}
        aria-pressed={audioState === 'muted'}
        disabled={audioState === 'unavailable'}
        hidden={controlsBlocked}
        onClick={onAudioToggle}
      >
        <span aria-hidden="true">{currentAudioPresentation.icon}</span>
        {currentAudioPresentation.status}
      </button>

      <output
        className="scene-observability"
        data-testid="audio-reactivity"
        data-engine-state={Math.abs(flight.speed) > 0.05 && !controlsBlocked && teleportPhase === 'idle' ? 'active' : 'idle'}
        data-turbo-state={flight.turbo && !controlsBlocked && teleportPhase === 'idle' ? 'active' : 'idle'}
        data-proximity-state={activeBody && !controlsBlocked && teleportPhase === 'idle' ? 'active' : 'idle'}
        data-audio-cue={
          audioState === 'muted'
            ? 'muted'
            : audioState !== 'active'
              ? 'silent'
              : isWormholeTravelPhase(wormhole.phase)
                ? 'wormhole'
                : teleportPhase === 'charging'
                ? 'teleport-charge'
                : teleportPhase === 'jump'
                  ? 'teleport-jump'
                  : flight.turbo
                    ? 'turbo'
                    : activeBody
                      ? 'proximity'
                      : Math.abs(flight.speed) > 0.05
                        ? 'engine'
                        : 'ambient'
        }
        aria-label="Estado del paisaje sonoro"
      >
        Audio procedural reactivo
      </output>

      <output
        className="flight-hud"
        data-testid="flight-state"
        data-x={flight.x.toFixed(3)}
        data-z={flight.z.toFixed(3)}
        data-altitude={flight.altitude.toFixed(3)}
        data-heading={flight.heading.toFixed(3)}
        data-bank={flight.bank.toFixed(3)}
        data-pitch={flight.pitch.toFixed(3)}
        data-speed={flight.speed.toFixed(3)}
        data-turbo={flight.turbo}
        data-atmosphere-contact={atmosphereContact?.key ?? 'none'}
        aria-label="Estado de navegación"
      >
        <span>Velocidad {flight.speed.toFixed(1)}</span>
        <span>Altitud {Math.round(flight.altitude)}</span>
        <strong>{flight.turbo ? 'Turbo activo' : 'Impulso normal'}</strong>
      </output>

      {teleportPhase !== 'idle' ? (
        <aside
          className={`teleport-overlay teleport-overlay--${teleportPhase}`}
          role="status"
          aria-label="Secuencia de teletransporte"
          aria-live="polite"
          data-teleport-phase={teleportPhase}
        >
          <span className="teleport-overlay__rings" aria-hidden="true" />
          <p className="eyebrow">
            {teleportPhase === 'charging' ? 'Carga de teletransporte' : 'Salto en curso'}
          </p>
          <strong>
            {teleportPhase === 'charging'
              ? 'Estabilizando coordenadas de regreso…'
              : 'Atravesando el corredor estelar…'}
          </strong>
        </aside>
      ) : null}

      {wormhole.phase === 'decision' ? (
        <aside
          className="celestial-card system-exit-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-exit-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
            }
            trapDialogFocus(event)
          }}
        >
          <p className="eyebrow">Límite del sistema</p>
          <h2 id="system-exit-title">Estás saliendo del sistema solar</h2>
          <p>¿Quieres atravesar el agujero de gusano para visitar una nueva galaxia?</p>
          <div className="system-exit-dialog__actions">
            <button type="button" onClick={startWormholeTravel} autoFocus>
              Atravesar el agujero de gusano
            </button>
            <button type="button" onClick={stayInSystem}>
              Quedarme en este sistema
            </button>
          </div>
        </aside>
      ) : null}

      {isWormholeTravelPhase(wormhole.phase) ? (
        <aside
          className={`wormhole-overlay wormhole-overlay--${wormhole.phase}${visualSettings.reducedMotion ? ' wormhole-overlay--reduced-motion' : ''}`}
          role="status"
          aria-label="Viaje por el agujero de gusano"
          aria-live="polite"
          data-wormhole-phase={wormhole.phase}
          data-origin-user={profile.login}
          data-destination-user={destinationLogin ?? 'seleccionando'}
        >
          <div className="wormhole-overlay__tunnel" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => (
              <span key={index} style={{ '--ray': index } as CSSProperties} />
            ))}
          </div>
          <div
            className="wormhole-overlay__ship"
            role="img"
            aria-label="Nave centrada atravesando el túnel espacial"
            data-testid="wormhole-ship"
          >
            <span />
          </div>
          <div className="wormhole-overlay__status">
            <p className="eyebrow">
              {wormhole.phase === 'arriving' ? 'Coordenadas estabilizadas' : 'Agujero de gusano'}
            </p>
            <strong>
              {wormhole.phase === 'selecting'
                ? 'Buscando una nueva galaxia…'
                : wormhole.phase === 'entering'
                  ? 'Entrando en el corredor espacial…'
                  : wormhole.phase === 'arriving'
                    ? `Llegando al sistema de ${destinationLogin}…`
                    : destinationLogin
                      ? `Destino confirmado: ${destinationLogin}`
                      : 'Atravesando el túnel mientras GitHub prepara el destino…'}
            </strong>
          </div>
        </aside>
      ) : null}

      {wormhole.phase === 'failed' ? (
        <aside
          className="celestial-card system-exit-dialog system-exit-dialog--error"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wormhole-error-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
            }
            trapDialogFocus(event)
          }}
        >
          <p className="eyebrow">Viaje interrumpido</p>
          <h2 id="wormhole-error-title">{wormhole.error.title}</h2>
          <p>{wormhole.error.message}</p>
          <div className="system-exit-dialog__actions">
            <button type="button" onClick={startWormholeTravel} autoFocus>
              Reintentar el viaje
            </button>
            <button type="button" onClick={stayInSystem}>
              Quedarme en este sistema
            </button>
          </div>
        </aside>
      ) : null}

      <details className="flight-help" open>
        <summary>Guía de vuelo</summary>
        <dl>
          {controls.map(([key, action]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </details>

      {paused ? (
        <section
          className="pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          onKeyDown={trapDialogFocus}
        >
          <div className="glass-panel pause-panel">
            <p className="eyebrow">Sistema en pausa</p>
            <h1 id="pause-title">Exploración de {profile.login}</h1>
            <p>La nave y el sistema permanecerán detenidos hasta que continúes.</p>
            <div className="pause-actions">
              <button type="button" onClick={onTogglePause} autoFocus>
                Continuar explorando
              </button>
              <button
                type="button"
                onClick={onAudioToggle}
                disabled={audioState === 'unavailable'}
                aria-pressed={audioState === 'muted'}
              >
                {currentAudioPresentation.action}
              </button>
              <button type="button" onClick={onReturnToMenu}>
                Volver al menú principal
              </button>
            </div>
            <p className="pause-panel__hint">También puedes pulsar Esc para continuar.</p>
          </div>
        </section>
      ) : null}
    </main>
  )
}

function ErrorState({
  error,
  onRetry,
  onReturnToMenu,
}: {
  error: AppError
  onRetry: () => void
  onReturnToMenu: () => void
}) {
  return (
    <main className="centered-layout" data-app-state="error">
      <section className="glass-panel error-panel" role="alert">
        <p className="eyebrow">No hemos podido despegar</p>
        <h1>{error.title}</h1>
        <p>{error.message}</p>
        <div className="error-actions">
          {error.retryable === false ? null : (
            <button type="button" onClick={onRetry}>
              Reintentar
            </button>
          )}
          <button type="button" onClick={onReturnToMenu}>
            Volver al menú
          </button>
        </div>
      </section>
    </main>
  )
}

function describeLoadError(username: string, error: unknown): AppError {
  if (error instanceof GitHubRequestError) {
    if (error.kind === 'not-found') {
      return {
        username,
        title: `No existe el usuario “${username}”`,
        message: 'Comprueba el nombre de usuario y vuelve a intentarlo.',
      }
    }

    if (error.kind === 'rate-limit') {
      const remainingMinutes = error.retryAt
        ? Math.max(1, Math.ceil((error.retryAt - Date.now()) / 60_000))
        : null
      const retryContext = remainingMinutes
        ? ` Podrás volver a intentarlo ${
            remainingMinutes === 1 ? 'en aproximadamente 1 minuto' : `en unos ${remainingMinutes} minutos`
          }.`
        : ' Espera unos minutos antes de volver a intentarlo.'

      return {
        username,
        title: 'GitHub ha limitado temporalmente las solicitudes',
        message: `GitGalaxy usa la API pública de GitHub sin autenticación, que tiene un límite temporal.${retryContext} Nunca te pediremos un token.`,
      }
    }

    if (error.kind === 'network') {
      return {
        username,
        title: 'No hemos podido conectar con GitHub',
        message: 'Revisa tu conexión de red y vuelve a intentarlo cuando estés en línea.',
      }
    }

    return {
      username,
      title: 'GitHub ha devuelto un error',
      message: 'Puede ser un problema temporal de la API. Reintenta la operación en unos instantes.',
    }
  }

  return {
    username,
    title: 'GitHub no ha podido preparar este sistema',
    message: 'Puedes reintentar la operación o volver al menú.',
  }
}

function updateUserQuery(username: string, mode: 'push' | 'replace' = 'push') {
  const url = new URL(window.location.href)
  url.searchParams.set('user', username)
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url)
}

function clearUserQuery() {
  const url = new URL(window.location.href)
  url.searchParams.delete('user')
  window.history.pushState({}, '', url)
}

function initialAppState(): AppState {
  const username = new URL(window.location.href).searchParams.get('user')?.trim()
  if (!username) return { name: 'menu' }

  const validationError = validateGitHubUsername(username)
  return validationError
    ? {
        name: 'error',
        error: {
          username,
          title: 'El nombre de usuario no es válido',
          message: validationError,
          retryable: false,
        },
      }
    : { name: 'loading', username, stage: 'profile' }
}

function AppView({
  initialState = initialAppState(),
  audioState,
  onAudioActivation,
  onAudioToggle,
  onAudioUpdate,
}: {
  initialState?: AppState
  audioState: AudioExperienceState
  onAudioActivation: () => void
  onAudioToggle: () => void
  onAudioUpdate: (state: ReactiveAudioState) => void
}) {
  const [state, dispatch] = useReducer(transitionAppState, initialState)
  const [recentLogins, setRecentLogins] = useState<string[]>([])
  const loadingUsername = state.name === 'loading' ? state.username : null

  useEffect(() => {
    if (!loadingUsername) return

    let isActive = true
    void loadGitHubSystem(loadingUsername, {
      onStage: (stage) => {
        if (isActive) dispatch({ type: 'LOAD_PROGRESS', stage })
      },
    })
      .then((system) => {
        if (!isActive) return
        updateUserQuery(system.profile.login, 'replace')
        dispatch({ type: 'SYSTEM_READY', system })
      })
      .catch((error: unknown) => {
        if (isActive) {
          dispatch({ type: 'FAIL', error: describeLoadError(loadingUsername, error) })
        }
      })

    return () => {
      isActive = false
    }
  }, [loadingUsername])

  const returnToMenu = () => {
    clearUserQuery()
    dispatch({ type: 'RETURN_TO_MENU' })
  }

  switch (state.name) {
    case 'menu':
      return (
        <Menu
          onExplore={(username) => {
            onAudioActivation()
            updateUserQuery(username)
            dispatch({ type: 'SUBMIT_USER', username })
          }}
        />
      )
    case 'loading':
      return <Loading username={state.username} stage={state.stage} />
    case 'exploration':
    case 'pause':
      return (
        <Exploration
          key={state.system.profile.id}
          system={state.system}
          paused={state.name === 'pause'}
          recentLogins={recentLogins}
          audioState={audioState}
          onAudioToggle={onAudioToggle}
          onAudioUpdate={onAudioUpdate}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onReturnToMenu={returnToMenu}
          onSystemArrival={(destination) => {
            if (state.name !== 'exploration') return
            const visited = [
              state.system.profile.login,
              ...recentLogins,
            ].filter((login, index, logins) =>
              logins.findIndex((candidate) =>
                candidate.toLowerCase() === login.toLowerCase(),
              ) === index,
            )
            setRecentLogins(visited.slice(0, 8))
            updateUserQuery(destination.profile.login, 'push')
            dispatch({ type: 'REPLACE_SYSTEM', system: destination })
          }}
        />
      )
    case 'error':
      return (
        <ErrorState
          error={state.error}
          onRetry={() => dispatch({ type: 'SUBMIT_USER', username: state.error.username })}
          onReturnToMenu={returnToMenu}
        />
      )
  }
}

export default function App() {
  const [compatibility] = useState<Compatibility>(() =>
    evaluateCompatibility(readBrowserCapabilities()),
  )
  const audio = useProceduralAudio()

  return (
    <div className="app-shell">
      <div className="stars stars--near" aria-hidden="true" />
      <div className="stars stars--far" aria-hidden="true" />
      {compatibility.status === 'unsupported' ? (
        <CompatibilityNotice reason={compatibility.reason} />
      ) : (
        <AppView
          audioState={audio.state}
          onAudioActivation={() => void audio.activate()}
          onAudioToggle={audio.toggleMuted}
          onAudioUpdate={audio.update}
        />
      )}
    </div>
  )
}
