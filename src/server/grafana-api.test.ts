import express from "express"
import http from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import configureGrafanaApiRoutes, { portalsTable } from "./grafana-api"
import { Server } from "./server"
import { DeviceStatisticsDetails } from "../shared/state"

const device = (name: string, lastMeasurement?: Date): DeviceStatisticsDetails => ({
  type: "UPNP",
  address: "1.2.3.4",
  name,
  isReceivingData: true,
  hasReceivedKeepAliveConfirmation: true,
  measurementRate: 0,
  totalMeasurementsCount: 0,
  lastIntervalCount: 0,
  distinctMeasurementsCount: 0,
  lastMeasurement,
})

describe("portalsTable", () => {
  it("maps device statistics to a Grafana table", () => {
    const table = portalsTable([device("cerbo", new Date(1_700_000_000_000)), device("never")])
    expect(table.type).toBe("table")
    expect(table.columns.map((c) => c.text)).toEqual(["Name", "Last Measurement Timestamp"])
    expect(table.columns[1].type).toBe("time")
    expect(table.rows).toEqual([
      ["cerbo", 1_700_000_000_000],
      ["never", null],
    ])
  })
})

describe("grafana-api routes", () => {
  const deviceStatistics = { "UPNP:1.2.3.4:abc": device("cerbo", new Date(1_700_000_000_000)) }
  const server = { loader: { loaderStatistics: { deviceStatistics } } } as unknown as Server
  let httpServer: http.Server
  let baseUrl: string

  beforeAll(async () => {
    const app = express()
    app.use(express.json())
    app.use("/grafana-api", configureGrafanaApiRoutes(server))
    httpServer = app.listen(0)
    await new Promise((resolve) => httpServer.once("listening", resolve))
    const { port } = httpServer.address() as { port: number }
    baseUrl = `http://127.0.0.1:${port}/grafana-api`
  })

  afterAll(async () => {
    await new Promise((resolve) => httpServer.close(resolve))
  })

  const post = (path: string, body: unknown) =>
    fetch(baseUrl + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

  it("answers the datasource health check", async () => {
    const res = await fetch(baseUrl + "/")
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
  })

  it("lists the portals metric", async () => {
    const res = await post("/metrics", { metric: "", payload: {} })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ value: "portals", label: "Venus Devices", payloads: [] }])
  })

  it("returns the portals table for a matching query target", async () => {
    const res = await post("/query", { targets: [{ target: "portals", refId: "A", type: "table", data: "" }] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        columns: [
          { text: "Name", type: "string" },
          { text: "Last Measurement Timestamp", type: "time" },
        ],
        rows: [["cerbo", 1_700_000_000_000]],
        type: "table",
      },
    ])
  })

  it("returns nothing for unknown targets or empty requests", async () => {
    expect(await (await post("/query", { targets: [{ target: "other" }] })).json()).toEqual([])
    expect(await (await post("/query", {})).json()).toEqual([])
  })

  it("no longer serves the legacy /search endpoint", async () => {
    expect((await post("/search", {})).status).toBe(404)
  })
})
