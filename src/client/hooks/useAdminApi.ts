import useAxios from "axios-hooks"
import {
  ADMIN_API_CONFIG,
  ADMIN_API_DEBUG,
  ADMIN_API_LOG,
  ADMIN_API_SECURITY,
  ADMIN_API_VRM_LOGOUT,
  ADMIN_API_VRM_REFRESH,
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
  return useAxios<VRMLoginResponse, VRMLoginRequest>({ url: ADMIN_API_LOG, method: "POST" }, { manual: true })
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
