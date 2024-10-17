import express from "express"
import { Server } from "./server"
import { DeviceStatistics } from "../shared/state"

// TODO: add TS API request/response interfaces
// TODO: refactor out hardcoded API endpoints
export default function (server: Server) {
  const router = express.Router()

  router.get("/", (_req, res, _next) => {
    res.send("ok")
  })

  router.post("search", (_req, res, _next) => {
    res.json(["portals"])
  })

  router.post("/query", (req, res, _next) => {
    const request = req.body

    if (server.loader.lastStats && request.targets) {
      if (request.targets.length > 0 && request.targets[0].type === "table") {
        if (request.targets[0].target === "portals") {
          const json = {
            columns: [
              { text: "Name", type: "string" },
              { text: "Last Measurement", type: "string" },
            ],
            type: "table",
          }

          const rows = Object.values(server.loader.lastStats.deviceStatistics as DeviceStatistics[]).map(
            (stats: DeviceStatistics) => {
              return [stats.name, stats.lastMeasurement.toString()]
            },
          )
          // TODO: verify it sends correct payload
          res.json([{ ...json, rows: rows }])
          return
        }
      }
    }
    res.json([])
  })

  return router
}
