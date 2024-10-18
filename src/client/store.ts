import { createStore } from "redux"
import { openServerEventsConnection } from "./actions"
import { AppConfig, LogEntry } from "../shared/types"
import { AppStateAction, DiscoveredDevice, LoaderStatistics, VRMStatus } from "../shared/state"

// TODO: migrate store.js to redux toolkit
// TODO: specify slices with concrete state + actions
// TODO: figure out where to handle live server connection
// TODO: initial connect and reconnect

export type AppWebSocketStatus = "initial" | "open" | "connected" | "error" | "closed"
export interface AppState {
  websocketStatus: AppWebSocketStatus
  webSocket?: WebSocket
  webSocketTimer?: any // TODO: what is the proper type in browser context
  restarting: boolean

  settings?: AppConfig
  loaderStatistics: LoaderStatistics

  vrmStatus: VRMStatus
  vrmDiscovered: DiscoveredDevice[]

  upnpDiscovered: DiscoveredDevice[]

  debug: boolean
  log: {
    entries: LogEntry[]
  }

  showSidebar: boolean
  uiSettings: {
    grafanaUrl: string
    showEditDiscoverySettings: boolean
    showEditVRMSettings: boolean
    showEditManualSettings: boolean
    showEditSecuritySettings: boolean
    showEditInfluxDBSettings: boolean
  }
}

const initialState: AppState = {
  websocketStatus: "initial",
  webSocket: undefined,
  restarting: false,

  loaderStatistics: { distinctMeasurementsCount: 0, measurementRate: 0, deviceStatistics: {} },

  vrmStatus: { status: "success", message: "" },

  vrmDiscovered: [],
  upnpDiscovered: [],

  debug: false,
  log: {
    entries: [] as LogEntry[],
  },
  showSidebar: true,

  uiSettings: {
    grafanaUrl: "${window.location.protocol}//${window.location.hostname}:3000",
    showEditDiscoverySettings: true,
    showEditVRMSettings: true,
    showEditManualSettings: true,
    showEditSecuritySettings: true,
    showEditInfluxDBSettings: true,
  },
}

const changeState = (state = initialState, action: AppStateAction): AppState => {
  if (action.type === "set") {
    return {
      ...state,
      ...action,
    }
  }
  if (action.type === "LOADER_STATISTICS") {
    return {
      ...state,
      loaderStatistics: action.data,
    }
  }
  if (action.type === "UPNPDISCOVERY") {
    return {
      ...state,
      upnpDiscovered: action.data,
    }
  }
  if (action.type === "VRMDISCOVERY") {
    return {
      ...state,
      vrmDiscovered: action.data,
    }
  }
  if (action.type === "VRMSTATUS") {
    return {
      ...state,
      vrmStatus: action.data,
    }
  }
  if (action.type === "LOADER_SETTINGS") {
    return {
      ...state,
      settings: action.data,
    }
  }
  if (action.type === "DEBUG") {
    return {
      ...state,
      debug: action.data,
    }
  }
  if (action.type === "UI_SETTINGS") {
    return {
      ...state,
      uiSettings: action.data,
    }
  }
  if (action.type === "LOG") {
    state.log.entries.push(action.data)
    if (state.log.entries.length > 100) {
      state.log.entries.splice(0, state.log.entries.length - 100)
    }
    return {
      ...state,
      log: {
        entries: state.log.entries,
      },
    }
  }
  if (action.type === "WEBSOCKET_OPEN") {
    if (state.webSocketTimer) {
      clearInterval(state.webSocketTimer)
      delete state.webSocketTimer
    }
    if (state.restarting) {
      state.restarting = false
    }
    return {
      ...state,
      websocketStatus: "open",
      webSocket: action.data,
    }
  }
  if (action.type === "WEBSOCKET_ERROR") {
    return {
      ...state,
      websocketStatus: "error",
    }
  }
  if (action.type === "WEBSOCKET_CLOSE") {
    if (!state.webSocketTimer) {
      state.webSocketTimer = setInterval(() => {
        console.log("retry...")
        openServerEventsConnection(store.dispatch)
      }, 5 * 1000)
    }
    return {
      ...state,
      websocketStatus: "closed",
      webSocket: undefined,
    }
  }
  return state
}

const store = createStore(changeState)
export default store
