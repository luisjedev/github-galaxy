import {
  useEffect,
  useReducer,
  useState,
  type FormEvent,
} from 'react'
import {
  transitionAppState,
  type AppError,
  type AppState,
  type LoadingStage,
} from './domain/app-state'
import {
  atmosphereRadius,
  informationZoneRadius,
  STAR_RADIUS,
  type ActiveCelestialBody,
} from './domain/celestial-interaction'
import { evaluateCompatibility, type Compatibility } from './domain/compatibility'
import { describeShipAppearance } from './domain/flight'
import { type GitHubSystem, type PlanetDescriptor } from './domain/github-system'
import { GalaxyScene } from './components/GalaxyScene'
import { useFlightControls } from './hooks/use-flight-controls'
import { validateGitHubUsername } from './domain/github-username'
import { readBrowserCapabilities } from './platform/browser-capabilities'
import { GitHubRequestError, loadGitHubSystem } from './platform/github-client'

const controls = [
  ['W / S', 'Avanzar · frenar / reversa'],
  ['A / D', 'Girar a la izquierda · derecha'],
  ['J / K', 'Descender · subir'],
  ['Espacio', 'Turbo'],
  ['E', 'Abrir destino'],
  ['R', 'Volver a la estrella'],
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

function Exploration({ system }: { system: GitHubSystem }) {
  const { profile, ownRepositoryCount, planets, starAppearance, starSeed } = system
  const { experienceRef, flight, initialFlight, activeBody, simulationStartedAt } =
    useFlightControls(system)
  const shipAppearance = describeShipAppearance(system)

  return (
    <main
      ref={experienceRef}
      className="system-layout"
      data-app-state="exploration"
      aria-label="Experiencia de vuelo"
      tabIndex={0}
      autoFocus
    >
      <section className="system-summary">
        <p className="eyebrow">Sistema listo para explorar</p>
        <h1>Sistema de {profile.login}</h1>
        <p>{ownRepositoryCount} proyectos públicos encontrados</p>
        {planets.length > 0 ? <p>{planets.length} planetas seleccionados</p> : null}
        {ownRepositoryCount === 0 ? <p>Una estrella solitaria espera tu visita.</p> : null}
      </section>

      <GalaxyScene
        system={system}
        flight={flight}
        simulationStartedAt={simulationStartedAt}
      />

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
          data-initial-destination={initialFlight.destinationRepositoryId ?? 'star'}
        >
          Nave low-poly con luz y estela tecnológicas
        </div>
      </div>

      {activeBody ? <CelestialCard activeBody={activeBody} system={system} /> : null}

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
        aria-label="Estado de navegación"
      >
        <span>Velocidad {Math.round(flight.speed)}</span>
        <span>Altitud {Math.round(flight.altitude)}</span>
        <strong>{flight.turbo ? 'Turbo activo' : 'Impulso normal'}</strong>
      </output>

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
    </main>
  )
}

function Pause({ username }: { username: string }) {
  return (
    <main className="centered-layout" data-app-state="pause">
      <section className="glass-panel">
        <p className="eyebrow">Sistema en pausa</p>
        <h1>{username}</h1>
      </section>
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

function AppView({ initialState = initialAppState() }: { initialState?: AppState }) {
  const [state, dispatch] = useReducer(transitionAppState, initialState)
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

  switch (state.name) {
    case 'menu':
      return (
        <Menu
          onExplore={(username) => {
            updateUserQuery(username)
            dispatch({ type: 'SUBMIT_USER', username })
          }}
        />
      )
    case 'loading':
      return <Loading username={state.username} stage={state.stage} />
    case 'exploration':
      return <Exploration system={state.system} />
    case 'pause':
      return <Pause username={state.username} />
    case 'error':
      return (
        <ErrorState
          error={state.error}
          onRetry={() => dispatch({ type: 'SUBMIT_USER', username: state.error.username })}
          onReturnToMenu={() => {
            clearUserQuery()
            dispatch({ type: 'RETURN_TO_MENU' })
          }}
        />
      )
  }
}

export default function App() {
  const [compatibility] = useState<Compatibility>(() =>
    evaluateCompatibility(readBrowserCapabilities()),
  )

  return (
    <div className="app-shell">
      <div className="stars stars--near" aria-hidden="true" />
      <div className="stars stars--far" aria-hidden="true" />
      {compatibility.status === 'unsupported' ? (
        <CompatibilityNotice reason={compatibility.reason} />
      ) : (
        <AppView />
      )}
    </div>
  )
}
