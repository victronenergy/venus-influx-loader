export interface AppConfigFiles {
  configLocation: string
  secretsLocation: string
}

export interface AppConfig {
  upnp: AppUPNPConfig
  vrm: AppVRMConfig
  manual: AppManualConfig
  influxdb: AppInfluxDBConfig
  debug?: boolean
}

export type AppConfigKey = keyof AppConfig

export interface AppUPNPConfig {
  enabled: boolean
  enabledPortalIds: string[]
  expiry: AppDataCollectionExpiryConfig
  subscriptions: AppDeviceSubscriptionsConfig
}

export type AppUPNPConfigKey = keyof AppUPNPConfig

export interface AppVRMConfig {
  enabled: boolean
  enabledPortalIds: string[]
  manualPortalIds: AppInstallationConfig[]
  expiry: AppDataCollectionExpiryConfig
  subscriptions: AppDeviceSubscriptionsConfig
  hasToken: boolean
}

export type AppVRMConfigKey = keyof AppVRMConfig

export interface AppDeviceConfig {
  hostName: string
  enabled: boolean
}

export type AppDeviceConfigKey = keyof AppDeviceConfig

export interface AppInstallationConfig {
  portalId: string
  enabled: boolean
}

export type AppInstallationConfigKey = keyof AppInstallationConfig

export interface AppManualConfig {
  enabled: boolean
  hosts: AppDeviceConfig[]
  expiry: AppDataCollectionExpiryConfig
  subscriptions: AppDeviceSubscriptionsConfig
}

export type AppManualConfigKey = keyof AppManualConfig

// Taken from https://github.com/victronenergy/dbus_modbustcp/blob/master/attributes.csv
// Using: `cut -d',' -f 1 attributes.csv | sort |  uniq | cut -d '.' -f 3`
// `/system/#` and `/settings/#` removed as we always subscribe to them
export const VenusMQTTTopics = [
  `/#`,
  `/acload/#`,
  `/acsystem/#`,
  `/alternator/#`,
  `/battery/#`,
  `/charger/#`,
  `/dcdc/#`,
  `/dcgenset/#`,
  `/dcload/#`,
  `/dcsource/#`,
  `/dcsystem/#`,
  `/digitalinput/#`,
  `/evcharger/#`,
  `/fuelcell/#`,
  `/generator/#`,
  `/genset/#`,
  `/gps/#`,
  `/grid/#`,
  `/hub4/#`,
  `/inverter/#`,
  `/meteo/#`,
  `/motordrive/#`,
  `/multi/#`,
  `/pulsemeter/#`,
  `/pump/#`,
  `/pvinverter/#`,
  `/solarcharger/#`,
  `/tank/#`,
  `/temperature/#`,
  `/vebus/#`,
] as const

export type VenusMQTTTopic = (typeof VenusMQTTTopics)[number] | "/system/#" | "/settings/#"

export default interface AppDeviceSubscriptionsConfig {
  [portalId: string]: VenusMQTTTopic[] // MQTT topics to subscribe to
}

export interface AppDataCollectionExpiryConfig {
  [portalId: string]: number | undefined // absolute time in millis when data collection will expire
}

export type AppInfluxDBProtocol = "http" | "https"

export interface AppInfluxDBConfig {
  protocol: AppInfluxDBProtocol
  host: string
  port: string
  path?: string
  username?: string
  password?: string
  database: string
  retention: string
  batchWriteInterval?: number
}

export type AppInfluxDBConfigKey = keyof AppInfluxDBConfig

export type AppConfigNestedKey = AppUPNPConfigKey | AppVRMConfigKey | AppManualConfigKey | AppInfluxDBConfigKey

export interface AppSecrets {
  vrmToken?: string
  vrmTokenId?: string
  vrmUserId?: number
  vrmUsername?: string
  login?: {
    username: string
    password: string
  }
}

export interface AppUISettings {
  grafanaUrl: string
  showEditDiscoverySettings: boolean
  showEditVRMSettings: boolean
  showEditManualSettings: boolean
  showEditSecuritySettings: boolean
  showEditInfluxDBSettings: boolean
  showAutomaticExpirySettings?: number
}

export type AppUISettingsKey = keyof AppUISettings

export type LogLevel = "error" | "warn" | "info" | "debug"
export interface LogEntry {
  timestamp: string
  level: LogLevel
  label: string
  message: string
}

const defaultAppConfigValues: AppConfig = {
  upnp: {
    enabled: true,
    enabledPortalIds: [],
    expiry: {},
    subscriptions: {},
  },
  manual: {
    enabled: true,
    hosts: [],
    expiry: {},
    subscriptions: {},
  },
  vrm: {
    enabled: true,
    enabledPortalIds: [],
    manualPortalIds: [],
    hasToken: false,
    expiry: {},
    subscriptions: {},
  },
  influxdb: {
    protocol: "http",
    host: "localhost",
    port: "8086",
    database: "venus",
    retention: "30d",
  },
}

function createDefaultWithAllProps<T>(defaultValues: Required<T>) {
  return (overrides: Partial<T> = {}): Required<T> => ({
    ...defaultValues,
    ...overrides,
  })
}
// @ts-expect-error, TODO: fix this
export const createAppConfig = createDefaultWithAllProps(defaultAppConfigValues)
export const createAppSecrets = createDefaultWithAllProps({})
