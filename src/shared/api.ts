import { AppConfig, LogEntry } from "./types"

export const ADMIN_API = "/admin-api"

export const API_CONFIG = "config"
export const ADMIN_API_CONFIG = `${ADMIN_API}/${API_CONFIG}`

export type GetConfigRequest = {}
export type GetConfigResponse = AppConfig

export type PutConfigRequest = AppConfig
export type PutConfigResponse = {}

export const API_SECURITY = "security"
export const ADMIN_API_SECURITY = `${ADMIN_API}/${API_SECURITY}`

export type PostSecurityRequest = { username: string; password: string }
export type PostSecurityResponse = {}

export const API_LOG = "log"
export const ADMIN_API_LOG = `${ADMIN_API}/${API_LOG}`

export type GetLogRequest = {}
export type GetLogResponse = { entries: LogEntry[] }

export const API_DEBUG = "debug"
export const ADMIN_API_DEBUG = `${ADMIN_API}/${API_DEBUG}`

export type GetDebugRequest = {}
export type GetDebugResponse = { debug: boolean }

export type PutDebugRequest = { debug: boolean }
export type PutDebugResponse = { debug: boolean }

export const API_VRM_LOGIN = "vrmLogin"
export const ADMIN_API_VRM_LOGIN = `${ADMIN_API}/${API_VRM_LOGIN}`

export type VRMLoginMethod = "credentials" | "token"

export type VRMDeviceType = "discovered" | "configured"

export interface VRMBaseLoginRequest {
  method: VRMLoginMethod
}

export interface VRMCredentialsLoginRequest extends VRMBaseLoginRequest {
  method: "credentials"
  username: string
  password: string
  tokenName: string
}

export interface VRMTokenLoginRequest extends VRMBaseLoginRequest {
  method: "token"
  token: string
}

export type VRMLoginRequest = VRMCredentialsLoginRequest | VRMTokenLoginRequest
export interface VRMLoginResponse {
  token: string
}

export const API_VRM_LOGOUT = "vrmLogout"
export const ADMIN_API_VRM_LOGOUT = `${ADMIN_API}/${API_VRM_LOGOUT}`

export type VRMLogoutRequest = {}
export type VRMLogoutResponse = {}

export const API_VRM_REFRESH = "vrmRefresh"
export const ADMIN_API_VRM_REFRESH = `${ADMIN_API}/${API_VRM_REFRESH}`

export type VRMRefreshRequest = {}
export type VRMRefreshResponse = {}
