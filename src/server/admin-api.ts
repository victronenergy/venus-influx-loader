import express from "express"
import { Server } from "./server"
import { AppConfig, AppSecrets } from "../shared/types"
import { API_CONFIG, API_DEBUG, API_LOG, API_SECURITY } from "../shared/api"

// TODO: add TS API request/response interfaces
// TODO: refactor out hardcoded API endpoints
export default (server: Server) => {
  const router = express.Router()

  // TODO: annotate req/res
  router.get(`/${API_CONFIG}`, (_req, res: express.Response<AppConfig>, _next) => {
    server.config.vrm.hasToken = server.secrets.vrmToken !== undefined
    res.json(server.config)
  })

  // TODO: annotate req/res
  router.put(`/${API_CONFIG}`, async (req: express.Request<AppConfig>, res, _next) => {
    // TODO: validate JSON payload
    server.config = req.body as AppConfig
    try {
      await server.saveConfig()
      res.status(200).send("Configuration Saved")
      res.send()
    } catch (error) {
      res.status(500).send(error)
    }
  })

  // TODO: annotate req/res
  router.post(`/${API_SECURITY}`, async (req: express.Request<AppSecrets>, res, _next) => {
    // TODO: validate JSON payload
    if (req.body.username && req.body.username.length > 0 && req.body.password && req.body.password.length > 0) {
      server.secrets.login = req.body
      try {
        await server.saveSecrets()
      } catch (error) {
        res.status(500).send(error)
      }
    } else {
      res.status(400).send("Please enter a Username and Password")
    }
  })

  // TODO: annotate req/res
  router.get(`/${API_LOG}`, (_req, res, _next) => {
    res.json({ entries: server.logEntries })
  })

  // TODO: annotate req/res
  router.get(`/${API_DEBUG}`, (_req, res, _next) => {
    const value = server.isDebugEnabled
    res.send(JSON.stringify({ debug: value }))
  })

  // TODO: annotate req/res
  router.put(`/${API_DEBUG}`, (req, res, _next) => {
    // TODO: validate JSON payload
    server.isDebugEnabled = req.body.debug
    const value = server.isDebugEnabled
    server.emit("loaderevent", { type: "DEBUG", data: value })
    res.send(JSON.stringify({ debug: value }))
  })

  return router
}
