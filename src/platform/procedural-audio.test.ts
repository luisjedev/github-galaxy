import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ProceduralAudioEngine,
  selectAudioPresentation,
} from './procedural-audio'

class FakeAudioParam {
  value = 0
  events: Array<{ kind: string; value?: number; time: number }> = []
  cancelScheduledValues(time: number) { this.events.push({ kind: 'cancel', time }) }
  setValueAtTime(value: number, time: number) { this.events.push({ kind: 'set', value, time }) }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'linear', value, time }) }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'exponential', value, time }) }
  setTargetAtTime(value: number, time: number) { this.events.push({ kind: 'target', value, time }) }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  currentTime = 2
  sampleRate = 100
  destination = {}
  oscillators: Array<{ frequency: FakeAudioParam; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = []
  close = vi.fn(async () => undefined)
  resume = vi.fn(async () => undefined)

  constructor() { FakeAudioContext.instances.push(this) }
  createGain() { return { gain: new FakeAudioParam(), connect() {}, disconnect() {} } }
  createOscillator() {
    const oscillator = { type: 'sine', frequency: new FakeAudioParam(), detune: { value: 0 }, connect() {}, disconnect() {}, start: vi.fn(), stop: vi.fn() }
    this.oscillators.push(oscillator)
    return oscillator
  }
  createBiquadFilter() { return { type: 'lowpass', frequency: { value: 0 }, Q: { value: 0 }, connect() {}, disconnect() {} } }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
  createBufferSource() { return { buffer: null, loop: false, connect() {}, disconnect() {}, start: vi.fn(), stop: vi.fn() } }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeAudioContext.instances = []
})

function installAudioContext(AudioContext: typeof FakeAudioContext | undefined) {
  vi.stubGlobal('window', { AudioContext })
  vi.stubGlobal('AudioContext', AudioContext)
}

describe('observable audio presentation', () => {
  const exteriorFlight = {
    speed: 2,
    turbo: false,
    proximity: false,
    paused: false,
    teleportPhase: 'idle' as const,
    cameraMode: 'third-person' as const,
  }

  it('selects a muffled cockpit mix and electronic signals from real flight state', () => {
    expect(selectAudioPresentation({ ...exteriorFlight, cameraMode: 'first-person' })).toEqual({
      mix: 'cockpit',
      cockpitSignal: 'engine',
    })
    expect(selectAudioPresentation({
      ...exteriorFlight,
      cameraMode: 'first-person',
      turbo: true,
    })).toEqual({ mix: 'cockpit', cockpitSignal: 'turbo' })
  })

  it('restores the exterior mix and suspends cockpit signals when flight audio is blocked', () => {
    expect(selectAudioPresentation(exteriorFlight)).toEqual({
      mix: 'exterior',
      cockpitSignal: 'off',
    })
    expect(selectAudioPresentation({
      ...exteriorFlight,
      cameraMode: 'first-person',
      paused: true,
    })).toEqual({ mix: 'suspended', cockpitSignal: 'off' })
    expect(selectAudioPresentation({
      ...exteriorFlight,
      cameraMode: 'first-person',
      teleportPhase: 'wormhole-tunnel',
    })).toEqual({ mix: 'travel', cockpitSignal: 'off' })
  })
})

describe('ProceduralAudioEngine favorite signals', () => {
  it('activates lazily and schedules a short ascending one-shot', async () => {
    installAudioContext(FakeAudioContext)
    const engine = new ProceduralAudioEngine()

    await engine.activate()
    expect(engine.playFavoriteCue('added')).toBe(true)

    const context = FakeAudioContext.instances[0]
    expect(context.resume).toHaveBeenCalledOnce()
    const cue = context.oscillators.at(-1)!
    expect(cue.frequency.events[0]).toEqual({ kind: 'set', value: 440, time: 2 })
    expect(cue.frequency.events[1]).toMatchObject({ kind: 'exponential', value: 880 })
    expect(cue.frequency.events[1].time).toBeCloseTo(2.28)
    expect(cue.stop.mock.calls[0][0]).toBeCloseTo(2.36)
  })

  it('suppresses favorite signals while muted', async () => {
    installAudioContext(FakeAudioContext)
    const engine = new ProceduralAudioEngine()
    await engine.activate()
    const context = FakeAudioContext.instances[0]
    const baseline = context.oscillators.length

    engine.setMuted(true)

    expect(engine.playFavoriteCue('removed')).toBe(false)
    expect(context.oscillators).toHaveLength(baseline)
  })

  it('rejects activation when Web Audio is unavailable without making cues throw', async () => {
    installAudioContext(undefined)
    const engine = new ProceduralAudioEngine()

    await expect(engine.activate()).rejects.toThrow('Web Audio is unavailable')
    expect(engine.playFavoriteCue('added')).toBe(false)
  })

  it('cancels pending one-shots and closes the context on disposal', async () => {
    installAudioContext(FakeAudioContext)
    const engine = new ProceduralAudioEngine()
    await engine.activate()
    engine.playFavoriteCue('removed')
    const context = FakeAudioContext.instances[0]
    const cue = context.oscillators.at(-1)!

    await engine.dispose()

    expect(cue.stop).toHaveBeenLastCalledWith()
    expect(context.close).toHaveBeenCalledOnce()
  })
})
