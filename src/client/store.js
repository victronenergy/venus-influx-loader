import { createStore } from 'redux'
import { openServerEventsConnection } from './actions'

// TODO: migrate store.js to redux toolkit
// TODO: specify slices with concrete state + actions
// TODO: figure out where to handle live server connection
// TODO: initial connect and reconnect

const initialState = {
  websocketStatus: 'initial',
  webSocket: null,
  debug: false,
  log: {
    entries: [],
  },
  sidebarShow: true,
}

const changeState = (state = initialState, action) => {
  if (action.type === 'set') {
    return {
      ...state,
      ...action,
    }
  }
  if (action.type === 'SERVERSTATISTICS') {
    return {
      ...state,
      serverStatistics: action.data,
    }
  }
  if (action.type === 'UPNPDISCOVERY') {
    return {
      ...state,
      upnpDiscovered: action.data,
    }
  }
  if (action.type === 'VRMDISCOVERY') {
    return {
      ...state,
      vrmDiscovered: action.data,
    }
  }
  if (action.type === 'VRMSTATUS') {
    return {
      ...state,
      vrmStatus: action.data,
    }
  }
  if (action.type === 'SETTINGSCHANGED') {
    return {
      ...state,
      settings: action.data,
    }
  }
  if (action.type === 'DEBUG') {
    return {
      ...state,
      debug: action.data,
    }
  }
  if (action.type === 'LOG') {
    state.log.entries.push(action.data)
    if (state.log.length > 100) {
      state.log.splice(0, state.log.length - 100)
    }
    return {
      ...state,
      log: {
        entries: state.log.entries,
      },
    }
  }
  if (action.type === 'WEBSOCKET_CONNECTED') {
    return {
      ...state,
      websocketStatus: 'connected',
    }
  }
  if (action.type === 'WEBSOCKET_OPEN') {
    if (state.webSocketTimer) {
      clearInterval(state.webSocketTimer)
      delete state.webSocketTimer
    }
    if (state.restarting) {
      state.restarting = false
    }
    return {
      ...state,
      websocketStatus: 'open',
      webSocket: action.data,
    }
  }
  if (action.type === 'WEBSOCKET_ERROR') {
    return {
      ...state,
      websocketStatus: 'error',
    }
  }
  if (action.type === 'WEBSOCKET_CLOSE') {
    if (!state.webSocketTimer) {
      state.webSocketTimer = setInterval(() => {
        console.log('retry...')
        openServerEventsConnection(store.dispatch)
      }, 5 * 1000)
    }
    return {
      ...state,
      websocketStatus: 'closed',
      webSocket: null,
    }
  }
  return state
}

const store = createStore(changeState)
export default store
