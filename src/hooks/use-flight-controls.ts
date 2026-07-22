import { useCallback, useEffect, useRef, useState } from 'react'
import {
  detectAtmosphereContact,
  resolveAtmosphereCollision,
  selectActiveCelestialBody,
  type ActiveCelestialBody,
  type AtmosphereContact,
} from '../domain/celestial-interaction'
import {
  advanceFlight,
  createInitialFlight,
  idleFlightInput,
  type FlightInput,
  type FlightState,
} from '../domain/flight'
import type { GitHubSystem } from '../domain/github-system'

const flightKeyByKeyboardKey: Record<string, keyof FlightInput> = {
  w: 'forward',
  s: 'reverse',
  a: 'left',
  d: 'right',
  j: 'descend',
  k: 'ascend',
  ' ': 'turbo',
}

function updateFlightInput(
  input: FlightInput,
  event: Pick<globalThis.KeyboardEvent, 'key' | 'preventDefault'>,
  pressed: boolean,
) {
  const flightKey = flightKeyByKeyboardKey[event.key.toLowerCase()]
  if (!flightKey) return
  if (flightKey === 'turbo') event.preventDefault()
  input[flightKey] = pressed
}

export function useFlightControls(system: GitHubSystem) {
  const initialFlight = useState(() => createInitialFlight(system))[0]
  const simulationStartedAt = useState(() => performance.now())[0]
  const [flight, setFlight] = useState(initialFlight.state)
  const flightState = useRef<FlightState>(initialFlight.state)
  const previousFrameTime = useRef(simulationStartedAt)
  const initialActiveBody = useState(() =>
    selectActiveCelestialBody(system, initialFlight.state, 0),
  )[0]
  const [activeBody, setActiveBody] = useState<ActiveCelestialBody | null>(initialActiveBody)
  const activeBodyRef = useRef<ActiveCelestialBody | null>(initialActiveBody)
  const [atmosphereContact, setAtmosphereContact] = useState<AtmosphereContact | null>(null)
  const atmosphereContactRef = useRef<AtmosphereContact | null>(null)
  const flightInput = useRef<FlightInput>({ ...idleFlightInput })
  const experienceRef = useRef<HTMLElement>(null)

  useEffect(() => {
    experienceRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!experienceRef.current?.contains(document.activeElement)) return
      if (event.key.toLowerCase() === 'e' && !event.repeat) {
        const destination =
          activeBodyRef.current?.kind === 'planet'
            ? activeBodyRef.current.planet.repository.html_url
            : activeBodyRef.current?.kind === 'star'
              ? system.profile.html_url
              : null
        if (destination) {
          event.preventDefault()
          window.open(destination, '_blank', 'noopener,noreferrer')
        }
        return
      }
      updateFlightInput(flightInput.current, event, true)
    }
    const handleKeyUp = (event: globalThis.KeyboardEvent) =>
      updateFlightInput(flightInput.current, event, false)
    const handleWindowBlur = () => {
      flightInput.current = { ...idleFlightInput }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [system])

  const advanceFlightFrame = useCallback((time: number) => {
    const previousTime = previousFrameTime.current
    const frameSeconds = (time - previousTime) / 1_000
    const previousElapsedSeconds = (previousTime - simulationStartedAt) / 1_000
    previousFrameTime.current = time
    const current = flightState.current
    const input = flightInput.current
    const hasInput = Object.values(input).some(Boolean)
    const elapsedSeconds = (time - simulationStartedAt) / 1_000
    const proposedFlight =
      !hasInput &&
      current.speed === 0 &&
      current.bank === 0 &&
      current.pitch === 0 &&
      !current.turbo
        ? current
        : advanceFlight(current, input, frameSeconds)
    const collision = resolveAtmosphereCollision(
      system,
      current,
      proposedFlight,
      previousElapsedSeconds,
      elapsedSeconds,
    )
    const nextFlight = collision.flight

    if (nextFlight !== current) {
      flightState.current = nextFlight
      setFlight(nextFlight)
    }

    const nextContact =
      collision.contact ?? detectAtmosphereContact(system, nextFlight, elapsedSeconds)
    if (nextContact?.key !== atmosphereContactRef.current?.key) {
      atmosphereContactRef.current = nextContact
      setAtmosphereContact(nextContact)
    }

    const nextActiveBody = selectActiveCelestialBody(system, nextFlight, elapsedSeconds)
    if (nextActiveBody?.key !== activeBodyRef.current?.key) {
      activeBodyRef.current = nextActiveBody
      setActiveBody(nextActiveBody)
    }
  }, [simulationStartedAt, system])

  return {
    experienceRef,
    flight,
    flightState,
    advanceFlightFrame,
    initialFlight,
    activeBody,
    atmosphereContact,
    simulationStartedAt,
  }
}
