import { useEffect, useReducer, useState, type CSSProperties, type FormEvent } from 'react'
import { transitionAppState, type AppState, type LoadingStage } from './domain/app-state'
import { evaluateCompatibility, type Compatibility } from './domain/compatibility'
import type { GitHubSystem } from './domain/github-system'
import { readBrowserCapabilities } from './platform/browser-capabilities'
import { loadGitHubSystem } from './platform/github-client'

const controls = [
  ['W / S', 'Avanzar · frenar'],
  ['A / D', 'Girar'],
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedUsername = username.trim()
    if (normalizedUsername) onExplore(normalizedUsername)
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
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <button type="submit">
              Explorar sistema <span aria-hidden="true">→</span>
            </button>
          </div>
          <p className="form-hint">Pulsa Enter para despegar</p>
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

function Exploration({ system }: { system: GitHubSystem }) {
  const { profile, repositories, starSeed } = system
  const ownRepositories = repositories.filter((repository) => !repository.fork)
  const starStyle = {
    '--star-hue': `${starSeed % 360}`,
    '--star-flare': `${36 + (starSeed % 24)}%`,
  } as CSSProperties

  return (
    <main className="system-layout" data-app-state="exploration">
      <section className="system-summary">
        <p className="eyebrow">Sistema listo para explorar</p>
        <h1>Sistema de {profile.login}</h1>
        <p>{ownRepositories.length} proyectos públicos encontrados</p>
        {ownRepositories.length === 0 ? <p>Una estrella solitaria espera tu visita.</p> : null}
      </section>
      <div
        className="procedural-star"
        style={starStyle}
        role="img"
        aria-label={`Estrella de ${profile.login}`}
        data-star-seed={starSeed}
      >
        <span aria-hidden="true" />
      </div>
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

function ErrorState({ message }: { message: string }) {
  return (
    <main className="centered-layout" data-app-state="error">
      <section className="glass-panel" role="alert">
        <p className="eyebrow">No hemos podido despegar</p>
        <h1>{message}</h1>
      </section>
    </main>
  )
}

function updateUserQuery(username: string, mode: 'push' | 'replace' = 'push') {
  const url = new URL(window.location.href)
  url.searchParams.set('user', username)
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url)
}

function initialAppState(): AppState {
  const username = new URL(window.location.href).searchParams.get('user')?.trim()
  return username ? { name: 'loading', username, stage: 'profile' } : { name: 'menu' }
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
      .catch(() => {
        if (isActive) {
          dispatch({ type: 'FAIL', message: 'GitHub no ha podido preparar este sistema' })
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
      return <ErrorState message={state.message} />
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
