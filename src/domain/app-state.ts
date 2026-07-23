import type { GitHubSystem } from './github-system'

export type LoadingStage = 'profile' | 'repositories' | 'system'

export interface AppError {
  username: string
  title: string
  message: string
  retryable?: boolean
  request?: 'random'
}

export type AppState =
  | { name: 'menu' }
  | { name: 'loading'; username: string; stage: LoadingStage; random?: boolean }
  | { name: 'exploration'; username: string; system: GitHubSystem }
  | { name: 'pause'; username: string; system: GitHubSystem }
  | { name: 'error'; error: AppError }

export type AppEvent =
  | { type: 'SUBMIT_USER'; username: string }
  | { type: 'SUBMIT_RANDOM' }
  | { type: 'LOAD_PROGRESS'; stage: LoadingStage }
  | { type: 'SYSTEM_READY'; system: GitHubSystem }
  | { type: 'REPLACE_SYSTEM'; system: GitHubSystem }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'FAIL'; error: AppError }
  | { type: 'RETURN_TO_MENU' }

export function transitionAppState(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'SUBMIT_USER':
      return { name: 'loading', username: event.username, stage: 'profile' }
    case 'SUBMIT_RANDOM':
      return { name: 'loading', username: '', stage: 'profile', random: true }
    case 'LOAD_PROGRESS':
      return state.name === 'loading' ? { ...state, stage: event.stage } : state
    case 'SYSTEM_READY':
      return state.name === 'loading'
        ? { name: 'exploration', username: event.system.profile.login, system: event.system }
        : state
    case 'REPLACE_SYSTEM':
      return state.name === 'exploration' || state.name === 'pause'
        ? {
            name: 'exploration',
            username: event.system.profile.login,
            system: event.system,
          }
        : state
    case 'TOGGLE_PAUSE':
      if (state.name === 'exploration') {
        return { name: 'pause', username: state.username, system: state.system }
      }
      if (state.name === 'pause') {
        return { name: 'exploration', username: state.username, system: state.system }
      }
      return state
    case 'FAIL':
      return { name: 'error', error: event.error }
    case 'RETURN_TO_MENU':
      return { name: 'menu' }
  }
}
