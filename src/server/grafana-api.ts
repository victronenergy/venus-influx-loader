import express from "express"
import { Server } from "./server.js"
import { DeviceStatisticsDetails } from "../shared/state.js"

// Grafana JSON datasource (simpod-json-datasource 0.6.x) backend:
// exposes the list of Venus devices being watched, and when they last sent data
// https://github.com/simPod/GrafanaJsonDatasource/blob/0.6.x/openapi.yaml

export const portalsMetric = "portals"

export interface GrafanaMetric {
  value: string
  label: string
  payloads: unknown[]
}

export interface GrafanaTable {
  columns: { text: string; type: "string" | "time" | "number" }[]
  rows: (string | number | null)[][]
  type: "table"
}

export const portalsTableColumns: GrafanaTable["columns"] = [
  { text: "Name", type: "string" },
  { text: "Last Measurement Timestamp", type: "time" },
]

export function portalsTable(devices: DeviceStatisticsDetails[]): GrafanaTable {
  return {
    columns: portalsTableColumns,
    rows: devices.map((stats) => [stats.name, stats.lastMeasurement ? stats.lastMeasurement.getTime() : null]),
    type: "table",
  }
}

export default function (server: Server) {
  const router = express.Router()

  // used by "Save & test" in datasource settings
  router.get("/", (_req, res) => {
    res.send("ok")
  })

  // metrics offered in the panel query editor
  router.post("/metrics", (_req, res) => {
    const metrics: GrafanaMetric[] = [{ value: portalsMetric, label: "Venus Devices", payloads: [] }]
    res.json(metrics)
  })

  router.post("/query", (req, res) => {
    const targets: { target?: string }[] = req.body?.targets ?? []
    const results = targets
      .filter((target) => target.target === portalsMetric)
      .map(() => portalsTable(Object.values(server.loader.loaderStatistics.deviceStatistics)))
    res.json(results)
  })

  return router
}
