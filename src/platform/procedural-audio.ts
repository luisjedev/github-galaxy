export type TeleportAudioPhase = 'idle' | 'charging' | 'jump'

export interface ReactiveAudioState {
  speed: number
  turbo: boolean
  proximity: boolean
  paused: boolean
  teleportPhase: TeleportAudioPhase
}

type AudioContextConstructor = new () => AudioContext

function audioContextConstructor(): AudioContextConstructor | null {
  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor
  }
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function smoothlySet(parameter: AudioParam, value: number, time: number) {
  parameter.cancelScheduledValues(time)
  // A relaxed fade avoids clicks and makes throttle changes feel less abrasive.
  parameter.setTargetAtTime(value, time, 0.12)
}

function connectOscillator(
  context: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  frequency: number,
) {
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.value = frequency
  oscillator.connect(destination)
  oscillator.start()
  return oscillator
}

function connectLoopingNoise(context: AudioContext, destination: AudioNode) {
  const sampleRate = context.sampleRate || 44_100
  const frameCount = sampleRate * 2
  const buffer = context.createBuffer(1, frameCount, sampleRate)
  const samples = buffer.getChannelData(0)
  let previousSample = 0
  let seed = 0x8f7011ee

  // Deterministic, lightly smoothed noise produces a soft rush instead of a
  // piercing pitched tone when turbo is held down.
  for (let index = 0; index < samples.length; index += 1) {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    const whiteNoise = (((seed ^ (seed >>> 14)) >>> 0) / 4_294_967_296) * 2 - 1
    previousSample = previousSample * 0.82 + whiteNoise * 0.18
    samples[index] = previousSample
  }

  const source = context.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.connect(destination)
  source.start()
}

/**
 * A small, entirely synthesized soundtrack. The graph is created lazily so merely
 * loading a shared URL never attempts playback before a visitor interaction.
 */
export class ProceduralAudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineOscillator: OscillatorNode | null = null
  private turboGain: GainNode | null = null
  private proximityGain: GainNode | null = null
  private teleportGain: GainNode | null = null
  private teleportOscillator: OscillatorNode | null = null
  private muted = false
  private proximityActive = false
  private teleportPhase: TeleportAudioPhase = 'idle'

  async activate(): Promise<void> {
    if (!this.context) this.createGraph()
    if (!this.context) throw new Error('Web Audio is unavailable')
    await this.context.resume()
    this.applyMasterLevel()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.applyMasterLevel()
  }

  update(state: ReactiveAudioState) {
    const context = this.context
    if (!context || !this.engineGain || !this.engineOscillator || !this.turboGain || !this.proximityGain) {
      return
    }

    const now = context.currentTime
    const movement = Math.min(1, Math.abs(state.speed) / 4)
    const shouldPlayReactiveAudio = !state.paused && state.teleportPhase === 'idle'
    const engineLevel = movement > 0.01 ? 0.004 + movement * 0.026 : 0.001
    smoothlySet(this.engineGain.gain, shouldPlayReactiveAudio ? engineLevel : 0, now)
    smoothlySet(this.engineOscillator.frequency, 46 + movement * 42, now)
    smoothlySet(this.turboGain.gain, shouldPlayReactiveAudio && state.turbo ? 0.026 : 0, now)

    const proximityActive = shouldPlayReactiveAudio && state.proximity
    if (proximityActive !== this.proximityActive) {
      this.setProximityActive(proximityActive)
    }

    if (state.teleportPhase !== this.teleportPhase) {
      this.setTeleportPhase(state.teleportPhase)
    }
  }

  private createGraph() {
    const AudioContextClass = audioContextConstructor()
    if (!AudioContextClass) throw new Error('Web Audio is unavailable')

    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = 0
    master.connect(context.destination)

    const ambientGain = context.createGain()
    ambientGain.gain.value = 0.007
    ambientGain.connect(master)
    connectOscillator(context, ambientGain, 'sine', 43.65)
    const ambientFifth = connectOscillator(context, ambientGain, 'sine', 65.41)
    ambientFifth.detune.value = -5

    const engineGain = context.createGain()
    engineGain.gain.value = 0
    const engineFilter = context.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 210
    engineFilter.Q.value = 0.45
    engineGain.connect(engineFilter)
    engineFilter.connect(master)
    const engineOscillator = connectOscillator(context, engineGain, 'triangle', 46)

    const turboGain = context.createGain()
    turboGain.gain.value = 0
    const turboFilter = context.createBiquadFilter()
    turboFilter.type = 'bandpass'
    turboFilter.frequency.value = 240
    turboFilter.Q.value = 0.55
    turboGain.connect(turboFilter)
    turboFilter.connect(master)
    connectLoopingNoise(context, turboGain)

    const proximityGain = context.createGain()
    proximityGain.gain.value = 0
    proximityGain.connect(master)
    // A single soft cue on arrival replaces the former continuous proximity alarm.
    connectOscillator(context, proximityGain, 'sine', 220)

    const teleportGain = context.createGain()
    teleportGain.gain.value = 0
    teleportGain.connect(master)
    const teleportOscillator = connectOscillator(context, teleportGain, 'sine', 90)

    this.context = context
    this.masterGain = master
    this.engineGain = engineGain
    this.engineOscillator = engineOscillator
    this.turboGain = turboGain
    this.proximityGain = proximityGain
    this.teleportGain = teleportGain
    this.teleportOscillator = teleportOscillator
  }

  private applyMasterLevel() {
    if (!this.context || !this.masterGain) return
    smoothlySet(this.masterGain.gain, this.muted ? 0 : 0.46, this.context.currentTime)
  }

  private setProximityActive(active: boolean) {
    const context = this.context
    const gain = this.proximityGain
    this.proximityActive = active
    if (!context || !gain) return

    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)

    if (active) {
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.006, now + 0.08)
      gain.gain.linearRampToValueAtTime(0, now + 0.7)
      return
    }

    smoothlySet(gain.gain, 0, now)
  }

  private setTeleportPhase(phase: TeleportAudioPhase) {
    const context = this.context
    const gain = this.teleportGain
    const oscillator = this.teleportOscillator
    this.teleportPhase = phase
    if (!context || !gain || !oscillator) return

    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)
    oscillator.frequency.cancelScheduledValues(now)

    if (phase === 'charging') {
      gain.gain.setValueAtTime(0.01, now)
      gain.gain.linearRampToValueAtTime(0.075, now + 0.9)
      oscillator.frequency.setValueAtTime(90, now)
      oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.9)
      return
    }

    if (phase === 'jump') {
      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
      oscillator.frequency.setValueAtTime(520, now)
      oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.42)
      this.playProceduralJumpNoise(now)
      return
    }

    smoothlySet(gain.gain, 0, now)
  }

  private playProceduralJumpNoise(time: number) {
    if (!this.context || !this.masterGain) return
    const sampleRate = this.context.sampleRate || 44_100
    const frameCount = Math.floor(sampleRate * 0.36)
    const buffer = this.context.createBuffer(1, frameCount, sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 0x6d2b79f5
    for (let index = 0; index < samples.length; index += 1) {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      const noise = (((seed ^ (seed >>> 14)) >>> 0) / 4_294_967_296) * 2 - 1
      samples[index] = noise * (1 - index / samples.length)
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    gain.gain.value = 0.065
    source.buffer = buffer
    source.connect(gain)
    gain.connect(this.masterGain)
    source.start(time)
  }
}
