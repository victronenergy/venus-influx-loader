import useAxios from "axios-hooks"
import {
  ADMIN_API_CONFIG,
  ADMIN_API_DEBUG,
  ADMIN_API_LOG,
  ADMIN_API_SECURITY,
  ADMIN_API_VRM_LOGIN,
  ADMIN_API_VRM_LOGOUT,
  ADMIN_API_VRM_REFRESH,
  ADMIN_API_VENUS_PAIR,
  ADMIN_API_VENUS_TOKENS,
  ADMIN_API_VENUS_UNPAIR,
  GetConfigRequest,
  GetConfigResponse,
  GetDebugRequest,
  GetDebugResponse,
  GetLogRequest,
  GetLogResponse,
  PostSecurityRequest,
  PostSecurityResponse,
  PutConfigRequest,
  PutConfigResponse,
  PutDebugRequest,
  PutDebugResponse,
  VRMLoginRequest,
  VRMLoginResponse,
  VRMLogoutRequest,
  VRMLogoutResponse,
  VRMRefreshRequest,
  VRMRefreshResponse,
  GetVenusTokensRequest,
  GetVenusTokensResponse,
  VenusPairRequest,
  VenusPairResponse,
  VenusUnpairRequest,
  VenusUnpairResponse,
} from "../../shared/api"

export function useGetConfig() {
  return useAxios<GetConfigResponse, GetConfigRequest>({
    url: ADMIN_API_CONFIG,
    method: "GET",
  })
}

export function usePutConfig() {
  return useAxios<PutConfigResponse, PutConfigRequest>({ url: ADMIN_API_CONFIG, method: "PUT" }, { manual: true })
}

export function usePostSecurity() {
  return useAxios<PostSecurityResponse, PostSecurityRequest>(
    { url: ADMIN_API_SECURITY, method: "POST" },
    { manual: true },
  )
}

export function useGetLog() {
  return useAxios<GetLogResponse, GetLogRequest>({
    url: ADMIN_API_LOG,
    method: "GET",
  })
}

export function useGetDebug() {
  return useAxios<GetDebugResponse, GetDebugRequest>({
    url: ADMIN_API_DEBUG,
    method: "GET",
  })
}

export function usePutDebug() {
  return useAxios<PutDebugResponse, PutDebugRequest>({ url: ADMIN_API_DEBUG, method: "PUT" }, { manual: true })
}

export function useVRMLogin() {
  return useAxios<VRMLoginResponse, VRMLoginRequest>({ url: ADMIN_API_VRM_LOGIN, method: "POST" }, { manual: true })
}

export function useVRMLogout() {
  return useAxios<VRMLogoutResponse, VRMLogoutRequest>({ url: ADMIN_API_VRM_LOGOUT, method: "POST" }, { manual: true })
}

export function useVRMRefresh() {
  return useAxios<VRMRefreshResponse, VRMRefreshRequest>(
    { url: ADMIN_API_VRM_REFRESH, method: "PUT" },
    { manual: true },
  )
}

export function useGetVenusTokens() {
  return useAxios<GetVenusTokensResponse, GetVenusTokensRequest>(
    { url: ADMIN_API_VENUS_TOKENS, method: "GET" },
    { manual: true },
  )
}

export function useVenusPair() {
  return useAxios<VenusPairResponse, VenusPairRequest>({ url: ADMIN_API_VENUS_PAIR, method: "POST" }, { manual: true })
}

export function useVenusUnpair() {
  return useAxios<VenusUnpairResponse, VenusUnpairRequest>(
    { url: ADMIN_API_VENUS_UNPAIR, method: "POST" },
    { manual: true },
  )
}
