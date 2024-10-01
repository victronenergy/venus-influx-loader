import { useState, useEffect } from "react";
import useAxios from "axios-hooks";

const ADMIN_API_CONFIG = "/admin-api/config";
const ADMIN_API_SECURITY = "/admin-api/security";
const ADMIN_API_LOG = "/admin-api/log";
const ADMIN_API_DEBUG = "/admin-api/debug";

function useGetConfig() {
  const [{ data, loading, error }, execute, cancel] = useAxios({
    url: ADMIN_API_CONFIG,
    method: "GET",
  });

  const [config, setConfig] = useState();
  useEffect(() => {
    setConfig(data);
  }, [data]);

  return [
    { data: config, setData: setConfig, loading, error },
    execute,
    cancel,
  ];
}

function usePutConfig() {
  const [{ data, loading, error }, execute, cancel] = useAxios(
    { url: ADMIN_API_CONFIG, method: "PUT" },
    { manual: true },
  );

  return [{ data, loading, error }, execute, cancel];
}

export { useGetConfig, usePutConfig };

function usePostSecurity() {
  const [{ data, loading, error }, execute, cancel] = useAxios(
    { url: ADMIN_API_SECURITY, method: "POST" },
    { manual: true },
  );

  return [{ data, loading, error }, execute, cancel];
}

export { usePostSecurity };

function useGetLog() {
  const [{ data, loading, error }, execute, cancel] = useAxios({
    url: ADMIN_API_LOG,
    method: "GET",
  });

  return [{ data, loading, error }, execute, cancel];
}

export { useGetLog };

function useGetDebug() {
  const [{ data, loading, error }, execute, cancel] = useAxios({
    url: ADMIN_API_DEBUG,
    method: "GET",
  });

  return [{ data, loading, error }, execute, cancel];
}

function usePutDebug() {
  const [{ data, loading, error }, execute, cancel] = useAxios(
    { url: ADMIN_API_DEBUG, method: "PUT" },
    { manual: true },
  );

  return [{ data, loading, error }, execute, cancel];
}

export { useGetDebug, usePutDebug };

const ADMIN_API_VRM_LOGIN = "/admin-api/vrmLogin";
const ADMIN_API_VRM_LOGOUT = "/admin-api/vrmLogout";
const ADMIN_API_VRM_REFRESH = "/admin-api/vrmRefresh";

function useVRMLogin() {
  const [{ data, loading, error }, execute, cancel] = useAxios(
    { url: ADMIN_API_VRM_LOGIN, method: "POST" },
    { manual: true },
  );

  return [{ data, loading, error }, execute, cancel];
}

function useVRMLogout() {
  const [{ data, loading, error }, execute, cancel] = useAxios(
    { url: ADMIN_API_VRM_LOGOUT, method: "POST" },
    { manual: true },
  );

  return [{ data, loading, error }, execute, cancel];
}

function useVRMRefresh() {
  const [{ data, loading, error }, execute, cancel] = useAxios(
    { url: ADMIN_API_VRM_REFRESH, method: "PUT" },
    { manual: true },
  );

  return [{ data, loading, error }, execute, cancel];
}

export { useVRMLogin, useVRMLogout, useVRMRefresh };
