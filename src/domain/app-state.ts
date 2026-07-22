export type AppState =
  | { name: 'menu' }
  | { name: 'loading'; username: string }
  | { name: 'exploration'; username: string }
  | { name: 'pause'; username: string }
  | { name: 'error'; message: string }

export type AppEvent =
  | { type: 'SUBMIT_USER'; username: string }
  | { type: 'SYSTEM_READY' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'FAIL'; message: string }
  | { type: 'RETURN_TO_MENU' }

export function transitionAppState(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'SUBMIT_USER':
      return { name: 'loading', username: event.username }
    case 'SYSTEM_READY':
      return state.name === 'loading'
        ? { name: 'exploration', username: state.username }
        : state
    case 'TOGGLE_PAUSE':
      if (state.name === 'exploration') {
        return { name: 'pause', username: state.username }
      }
      if (state.name === 'pause') {
        return { name: 'exploration', username: state.username }
      }
      return state
    case 'FAIL':
      return { name: 'error', message: event.message }
    case 'RETURN_TO_MENU':
      return { name: 'menu' }
  }
}
