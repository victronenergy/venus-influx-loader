import express from "express"
import { Server } from "./server.js"
import { AppConfig, AppSecrets } from "../shared/types.js"
import { API_CONFIG, API_DEBUG, API_LOG, API_SECURITY } from "../shared/api.js"
import { parseInfluxDBVersion, validateInfluxDBConfig } from "../shared/influxdbConfig.js"
import { venusTokenKey } from "../shared/venusConfig.js"

// TODO: add TS API request/response interfaces
// TODO: refactor out hardcoded API endpoints
export default (server: Server) => {
  const router = express.Router()

  // TODO: annotate req/res
  router.get(`/${API_CONFIG}`, (_req, res: express.Response<AppConfig>, _next) => {
    res.json(server.config)
  })

  // TODO: annotate req/res
  router.put(`/${API_CONFIG}`, async (req: express.Request<AppConfig>, res, _next) => {
    // TODO: validate the rest of the JSON payload
    const config = req.body as AppConfig
    if (typeof config?.influxdb !== "object" || config.influxdb === null) {
      res.status(400).send("Missing InfluxDB configuration")
      return
    }
    const problems = validateInfluxDBConfig(config.influxdb)
    if (problems.length > 0) {
      res.status(400).send(problems.join("\n"))
      return
    }
    config.influxdb.version = parseInfluxDBVersion(config.influxdb.version)!!
    // older Admin UI bundles or scripts may not send the newer keys
    config.upnp.securePortalIds = Array.isArray(config.upnp?.securePortalIds) ? config.upnp.securePortalIds : []
    server.config = config
    try {
      await server.saveConfig()
      await forgetTokensOfRemovedHosts()
      res.status(200).send("Configuration Saved")
    } catch (error) {
      res.status(500).send(error)
    }
  })

  // pairing tokens only make sense for devices configured as Secured, a host that was renamed,
  // deleted or switched back to plain MQTT would otherwise leave a live token behind
  async function forgetTokensOfRemovedHosts() {
    const tokens = server.secrets.venusTokens ?? {}
    const secured = [
      ...server.config.manual.hosts
        .filter((host) => host.secure === true)
        .map((host) => venusTokenKey("IP", host.hostName)),
      ...server.config.upnp.securePortalIds.map((portalId) => venusTokenKey("UPNP", portalId)),
    ]
    const orphans = Object.keys(tokens).filter((key) => !secured.includes(key))
    if (orphans.length === 0) return
    const previous = server.secrets.venusTokens
    server.secrets.venusTokens = Object.fromEntries(Object.entries(tokens).filter(([key]) => !orphans.includes(key)))
    try {
      await server.saveSecrets()
    } catch (error) {
      server.secrets.venusTokens = previous
      throw error
    }
  }

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
