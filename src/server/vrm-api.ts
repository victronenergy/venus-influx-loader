import express from "express"
import { Server } from "./server"
import {
  API_VRM_LOGIN,
  API_VRM_LOGOUT,
  API_VRM_REFRESH,
  VRMLoginRequest,
  VRMLogoutRequest,
  VRMRefreshRequest,
} from "../shared/api"

export default function (server: Server) {
  const router = express.Router()

  router.post(`/${API_VRM_LOGIN}`, async (req, res, _next) => {
    // TODO: validate with zod against schema
    const loginRequest: VRMLoginRequest = req.body
    try {
      if (loginRequest.method === "token") {
        await server.vrm.loginWithToken(loginRequest.token)
      }
      if (loginRequest.method === "credentials") {
        await server.vrm.loginWithCredentials(loginRequest.username, loginRequest.password, loginRequest.tokenName)
      }
      await server.vrm.refresh()
      res.send()
    } catch (error) {
      res.status(401).send(error)
    }
  })

  router.post(`/${API_VRM_LOGOUT}`, async (req, res, _next) => {
    // TODO: validate with zod against schema
    const _logoutRequest: VRMLogoutRequest = req.body
    try {
      await server.vrm.logout()
      res.send()
    } catch (error) {
      res.status(401).send(error)
    }
  })

  router.put(`/${API_VRM_REFRESH}`, async (req, res, _next) => {
    // TODO: validate with zod against schema
    const _refreshRequest: VRMRefreshRequest = req.body
    try {
      await server.vrm.refresh()
      res.send()
    } catch (error) {
      res.status(401).send(error)
    }
  })

  return router
}
