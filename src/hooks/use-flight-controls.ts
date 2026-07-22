import { useEffect, useRef, useState } from 'react'
import {
  selectActiveCelestialBody,
  type ActiveCelestialBody,
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
  const initialActiveBody = useState(() =>
    selectActiveCelestialBody(system, initialFlight.state, 0),
  )[0]
  const [activeBody, setActiveBody] = useState<ActiveCelestialBody | null>(initialActiveBody)
  const activeBodyRef = useRef<ActiveCelestialBody | null>(initialActiveBody)
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

    let animationFrame = 0
    let previousTime = performance.now()
    const update = (time: number) => {
      const frameSeconds = (time - previousTime) / 1_000
      previousTime = time
      const current = flightState.current
      const input = flightInput.current
      const hasInput = Object.values(input).some(Boolean)
      const nextFlight =
        !hasInput && current.speed === 0 && !current.turbo
          ? current
          : advanceFlight(current, input, frameSeconds)

      if (nextFlight !== current) {
        flightState.current = nextFlight
        setFlight(nextFlight)
      }

      const elapsedSeconds = (time - simulationStartedAt) / 1_000
      const nextActiveBody = selectActiveCelestialBody(system, nextFlight, elapsedSeconds)
      if (nextActiveBody?.key !== activeBodyRef.current?.key) {
        activeBodyRef.current = nextActiveBody
        setActiveBody(nextActiveBody)
      }
      animationFrame = requestAnimationFrame(update)
    }

    animationFrame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [simulationStartedAt, system])

  return { experienceRef, flight, initialFlight, activeBody, simulationStartedAt }
}
