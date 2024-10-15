export interface AppConfig {
  upnp: AppUPNPConfig
  vrm: AppVRMConfig
  manual: AppManualConfig
  influxdb: AppInfluxDBConfig
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
  hasToken: boolean
}

export type AppVRMConfigKey = keyof AppVRMConfig

export interface AppHostConfig {
  hostName: string
  enabled: boolean
}

export type AppHostConfigKey = keyof AppHostConfig

export interface AppManualConfig {
  enabled: boolean
  hosts: AppHostConfig[]
}

export type AppManualConfigKey = keyof AppManualConfig

export interface AppInfluxDBConfig {
  host: string
  port: string
  username?: string
  password?: string
  database: string
  retention: string
}

export type AppInfluxDBConfigKey = keyof AppInfluxDBConfig

export type AppConfigNestedKey = AppUPNPConfigKey | AppVRMConfigKey | AppManualConfigKey | AppInfluxDBConfigKey

export interface AppSecretsConfig {
  vrmToken: string
  vrmTokenId: string
  vrmUserId: number
  vrmUsername: string
  login: {
    username: string
    password: string
  }
}

export interface LogEntry {
  timestamp: string
  level: "error" | "warn" | "info" | "debug"
  label: string
  message: string
}