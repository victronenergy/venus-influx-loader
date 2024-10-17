import { AppConfig, LogEntry } from "./types"

export type WebSocketActions = "WEBSOCKET_CONNECTED" | "WEBSOCKET_OPEN" | "WEBSOCKET_ERROR" | "WEBSOCKET_CLOSE"
export type DiscoveryActions = "UPNPDISCOVERY" | "VRMDISCOVERY"
export type VRMActions = "VRMSTATUS"
export type DebugActions = "DEBUG" | "LOG"
export type SettingsActions =
  | "SETTINGSCHANGED"
  | "EDIT_SECURITY_SETTINGS_ENABLED"
  | "EDIT_INFLUXDB_SETTINGS_ENABLED"
  | "EDIT_DISCOVERY_SETTINGS_ENABLED"
  | "EDIT_MANUAL_SETTINGS_ENABLED"
  | "EDIT_VRM_SETTINGS_ENABLED"
export type MiscActions = "set" | "LOADERSTATISTICS" | "GRAFANA_URL"

export type AppStateActionType =
  | MiscActions
  | WebSocketActions
  | DiscoveryActions
  | VRMActions
  | SettingsActions
  | DebugActions

export interface AppStateBaseAction {
  type: AppStateActionType
}

export interface AppStateWebSocketAction extends AppStateBaseAction {
  type: "WEBSOCKET_CONNECTED" | "WEBSOCKET_ERROR" | "WEBSOCKET_CLOSE"
}

export interface AppStateWebSocketOpenAction extends AppStateBaseAction {
  type: "WEBSOCKET_OPEN"
  data: WebSocket
}

// for discovered device we always know portalId and address, and derive name from MQTT
export type DiscoveredDevice = { portalId: string; name?: string; address: string }
// for manually configured device we know address, and derive name and portalId from MQTT
export type ConfiguredDevice = {
  type: "UPNP" | "VRM" | "IP"
  portalId?: string
  name?: string
  address: string
}

export interface AppStateUPNPDiscoveryAction extends AppStateBaseAction {
  type: "UPNPDISCOVERY"
  data: DiscoveredDevice[]
}

export interface AppStateVRMDiscoveryAction extends AppStateBaseAction {
  type: "VRMDISCOVERY"
  data: DiscoveredDevice[]
}

export interface VRMStatus {
  status: "success" | "failure"
  message: string
}

export interface AppStateVRMStatusAction extends AppStateBaseAction {
  type: "VRMSTATUS"
  data: VRMStatus
}

export interface DeviceStatisticsDetails {
  type: "UPNP" | "VRM" | "IP"
  address: string
  name: string
  isConnected: boolean
  measurementRate: number
  totalMeasurementsCount: number
  lastIntervalCount: number
  distinctMeasurementsCount: number
  lastMeasurement?: Date
}

export interface DeviceStatistics {
  [key: string]: DeviceStatisticsDetails
}

export interface LoaderStatistics {
  measurementRate: number
  distinctMeasurementsCount: number
  deviceStatistics: DeviceStatistics
}

export interface AppStateLoaderStatisticsAction extends AppStateBaseAction {
  type: "LOADERSTATISTICS"
  data: LoaderStatistics
}

export interface AppStateSettingsChangedAction extends AppStateBaseAction {
  type: "SETTINGSCHANGED"
  data: AppConfig
}

export interface AppStateGrafanaUrlAction extends AppStateBaseAction {
  type: "GRAFANA_URL"
  data: string
}

export interface AppStateSettingsEnabledAction extends AppStateBaseAction {
  type:
    | "EDIT_SECURITY_SETTINGS_ENABLED"
    | "EDIT_INFLUXDB_SETTINGS_ENABLED"
    | "EDIT_DISCOVERY_SETTINGS_ENABLED"
    | "EDIT_MANUAL_SETTINGS_ENABLED"
    | "EDIT_VRM_SETTINGS_ENABLED"
  data: boolean
}

export interface AppStateDebugAction extends AppStateBaseAction {
  type: "DEBUG"
  data: boolean
}

export interface AppStateLogAction extends AppStateBaseAction {
  type: "LOG"
  data: LogEntry
}

export interface AppStateSetAction extends AppStateBaseAction {
  type: "set"
  // TODO: used to hide/show sidebar, refactor
  data: any
}

export type AppStateAction =
  | AppStateWebSocketAction
  | AppStateWebSocketOpenAction
  | AppStateUPNPDiscoveryAction
  | AppStateVRMDiscoveryAction
  | AppStateVRMStatusAction
  | AppStateLoaderStatisticsAction
  | AppStateGrafanaUrlAction
  | AppStateSettingsEnabledAction
  | AppStateSettingsChangedAction
  | AppStateDebugAction
  | AppStateLogAction
  | AppStateSetAction
