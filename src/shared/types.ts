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
}

export type AppUPNPConfigKey = keyof AppUPNPConfig

export interface AppVRMConfig {
  enabled: boolean
  enabledPortalIds: string[]
  manualPortalIds: AppInstallationConfig[]
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
}

export type AppManualConfigKey = keyof AppManualConfig

export interface AppInfluxDBConfig {
  host: string
  port: string
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

export type LogLevel = "error" | "warn" | "info" | "debug"
export interface LogEntry {
  timestamp: string
  level: LogLevel
  label: string
  message: string
}

const defaultAppConfigValues: AppConfig = {
  upnp: {
    enabled: false,
    enabledPortalIds: [],
  },
  manual: {
    enabled: false,
    hosts: [],
  },
  vrm: {
    enabled: false,
    enabledPortalIds: [],
    manualPortalIds: [],
    hasToken: false,
  },
  influxdb: {
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
