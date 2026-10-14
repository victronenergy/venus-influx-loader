import express from "express"
import http from "node:http"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import configureAdminRoutes from "./admin-api.js"
import { Server } from "./server.js"
import { createAppConfig } from "../shared/types.js"

describe("admin-api PUT /config", () => {
  const server = {
    getLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
    emit: vi.fn(),
    saveConfig: vi.fn(),
    saveSecrets: vi.fn(),
    config: createAppConfig(),
    secrets: {},
    logEntries: [],
  } as unknown as Server
  let httpServer: http.Server
  let baseUrl: string

  beforeAll(async () => {
    const app = express()
    app.use(express.json())
    app.use("/admin-api", configureAdminRoutes(server))
    httpServer = app.listen(0)
    await new Promise((resolve) => httpServer.once("listening", resolve))
    const { port } = httpServer.address() as { port: number }
    baseUrl = `http://127.0.0.1:${port}/admin-api`
  })

  afterAll(async () => {
    await new Promise((resolve) => httpServer.close(resolve))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    server.secrets = {}
  })

  const put = (body: unknown) =>
    fetch(baseUrl + "/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

  it("fills in securePortalIds when an older client omits it", async () => {
    const config = createAppConfig() as any
    delete config.upnp.securePortalIds
    expect((await put(config)).status).toBe(200)
    expect(server.config.upnp.securePortalIds).toEqual([])
    expect(server.saveConfig).toHaveBeenCalledTimes(1)
    expect(server.saveSecrets).not.toHaveBeenCalled()
  })

  it("forgets pairing tokens of devices that are no longer configured as Secured", async () => {
    server.secrets.venusTokens = {
      "IP:kept": { tokenName: "t", password: "p", pairedAt: 1 },
      "IP:renamed": { tokenName: "t", password: "p", pairedAt: 1 },
      "IP:plain": { tokenName: "t", password: "p", pairedAt: 1 },
      "UPNP:abc": { tokenName: "t", password: "p", pairedAt: 1 },
      "UPNP:unticked": { tokenName: "t", password: "p", pairedAt: 1 },
    }
    const config = createAppConfig()
    config.manual.hosts = [
      { hostName: "kept", enabled: false, secure: true },
      { hostName: "plain", enabled: true },
    ]
    config.upnp.securePortalIds = ["abc"]
    expect((await put(config)).status).toBe(200)
    expect(Object.keys(server.secrets.venusTokens!!)).toEqual(["IP:kept", "UPNP:abc"])
    expect(server.saveSecrets).toHaveBeenCalledTimes(1)
  })

  it("keeps the secrets untouched when nothing is orphaned", async () => {
    server.secrets.venusTokens = { "UPNP:abc": { tokenName: "t", password: "p", pairedAt: 1 } }
    const config = createAppConfig()
    config.upnp.securePortalIds = ["abc"]
    expect((await put(config)).status).toBe(200)
    expect(server.saveSecrets).not.toHaveBeenCalled()
  })
})
