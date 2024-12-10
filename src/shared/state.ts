import { AppConfig, AppUISettings, LogEntry, VenusMQTTTopic } from "./types"

export type WebSocketActions = "WEBSOCKET_OPEN" | "WEBSOCKET_CLOSE" | "WEBSOCKET_ERROR"
export type DiscoveryActions = "UPNPDISCOVERY" | "VRMDISCOVERY"
export type VRMActions = "VRMSTATUS"
export type DebugActions = "DEBUG" | "LOG"
export type SettingsActions = "LOADER_SETTINGS" | "UI_SETTINGS"
export type MiscActions = "set" | "LOADER_STATISTICS"

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
  type: "WEBSOCKET_CLOSE" | "WEBSOCKET_ERROR"
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
  subscriptions: VenusMQTTTopic[]
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
  tokenInfo?: string
}

export interface AppStateVRMStatusAction extends AppStateBaseAction {
  type: "VRMSTATUS"
  data: VRMStatus
}

export interface DeviceStatisticsDetails {
  type: "UPNP" | "VRM" | "IP"
  address: string
  name: string
  portalId?: string
  isConnected: boolean
  expiry?: number
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
  type: "LOADER_STATISTICS"
  data: LoaderStatistics
}

export interface AppStateLoaderSettingsAction extends AppStateBaseAction {
  type: "LOADER_SETTINGS"
  data: AppConfig
}

export interface AppStateUISettingsAction extends AppStateBaseAction {
  type: "UI_SETTINGS"
  data: AppUISettings
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
  | AppStateUISettingsAction
  | AppStateLoaderSettingsAction
  | AppStateDebugAction
  | AppStateLogAction
  | AppStateSetAction
