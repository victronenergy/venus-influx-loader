import { createStore } from "redux"
import { openServerEventsConnection } from "./actions"
import { AppConfig, LogEntry } from "../shared/types"
import { AppStateAction, LoaderStatistics, VRMStatus } from "../shared/state"

// TODO: migrate store.js to redux toolkit
// TODO: specify slices with concrete state + actions
// TODO: figure out where to handle live server connection
// TODO: initial connect and reconnect

export interface AppState {
  websocketStatus: "initial" | "open" | "connected" | "error" | "closed"
  webSocket?: WebSocket
  webSocketTimer?: any // TODO: what is the proper type in browser context
  restarting: boolean

  settings?: AppConfig
  loaderStatistics: LoaderStatistics

  vrmStatus: VRMStatus
  vrmDiscovered: { portalId: string; name: string }[]

  upnpDiscovered: string[]

  debug: boolean
  log: {
    entries: LogEntry[]
  }

  sidebarShow: boolean
  editSettings: {
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

  loaderStatistics: { measurementCount: 0, measurementRate: 0, deviceStatistics: {} },

  vrmStatus: { status: "success", message: "" },

  vrmDiscovered: [],
  upnpDiscovered: [],

  debug: false,
  log: {
    entries: [] as LogEntry[],
  },
  sidebarShow: true,

  editSettings: {
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
  if (action.type === "LOADERSTATISTICS") {
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
  if (action.type === "SETTINGSCHANGED") {
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
  if (action.type === "EDIT_SECURITY_SETTINGS_ENABLED") {
    return {
      ...state,
      editSettings: {
        ...state.editSettings,
        showEditSecuritySettings: action.data,
      },
    }
  }
  if (action.type === "EDIT_INFLUXDB_SETTINGS_ENABLED") {
    return {
      ...state,
      editSettings: {
        ...state.editSettings,
        showEditInfluxDBSettings: action.data,
      },
    }
  }
  if (action.type === "EDIT_DISCOVERY_SETTINGS_ENABLED") {
    return {
      ...state,
      editSettings: {
        ...state.editSettings,
        showEditDiscoverySettings: action.data,
      },
    }
  }
  if (action.type === "EDIT_MANUAL_SETTINGS_ENABLED") {
    return {
      ...state,
      editSettings: {
        ...state.editSettings,
        showEditManualSettings: action.data,
      },
    }
  }
  if (action.type === "EDIT_VRM_SETTINGS_ENABLED") {
    return {
      ...state,
      editSettings: {
        ...state.editSettings,
        showEditVRMSettings: action.data,
      },
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
  if (action.type === "WEBSOCKET_CONNECTED") {
    return {
      ...state,
      websocketStatus: "connected",
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
