import { AppConfig, LogEntry } from "./types.js"
import { VenusDeviceType } from "./venusConfig.js"

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

// pairing with local Venus OS 3.80+ devices, the obtained MQTT token is stored in secrets.json

export const API_VENUS_PAIR = "venusPair"
export const ADMIN_API_VENUS_PAIR = `${ADMIN_API}/${API_VENUS_PAIR}`

// IP: key is the hostName, UPNP: key is the portalId (the address is taken from the discovered device)
export type VenusDeviceRequest = { type: VenusDeviceType; key: string }

// what the Admin UI is allowed to see about a stored token, never the password
export type VenusTokenInfo = { tokenName: string; pairedAt: number }

export type VenusPairRequest = VenusDeviceRequest
export type VenusPairResponse = VenusTokenInfo

export const API_VENUS_UNPAIR = "venusUnpair"
export const ADMIN_API_VENUS_UNPAIR = `${ADMIN_API}/${API_VENUS_UNPAIR}`

export type VenusUnpairRequest = VenusDeviceRequest
export type VenusUnpairResponse = {}

export const API_VENUS_TOKENS = "venusTokens"
export const ADMIN_API_VENUS_TOKENS = `${ADMIN_API}/${API_VENUS_TOKENS}`

export type GetVenusTokensRequest = {}
export type GetVenusTokensResponse = { [key: string]: VenusTokenInfo }
