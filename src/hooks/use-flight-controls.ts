import { useEffect, useRef, useState } from 'react'
import {
  advanceFlight,
  createInitialFlight,
  idleFlightInput,
  type FlightInput,
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
  const [flight, setFlight] = useState(initialFlight.state)
  const flightInput = useRef<FlightInput>({ ...idleFlightInput })
  const experienceRef = useRef<HTMLElement>(null)

  useEffect(() => {
    experienceRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!experienceRef.current?.contains(document.activeElement)) return
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
      const elapsedSeconds = (time - previousTime) / 1_000
      previousTime = time
      setFlight((current) => {
        const input = flightInput.current
        const hasInput = Object.values(input).some(Boolean)
        if (!hasInput && current.speed === 0 && !current.turbo) return current
        return advanceFlight(current, input, elapsedSeconds)
      })
      animationFrame = requestAnimationFrame(update)
    }

    animationFrame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  return { experienceRef, flight, initialFlight }
}
