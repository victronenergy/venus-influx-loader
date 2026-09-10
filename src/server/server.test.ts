import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Server } from "./server"

describe("Server config files", () => {
  let configPath: string
  let server: Server

  beforeEach(async () => {
    configPath = await fs.mkdtemp(path.join(os.tmpdir(), "vil-"))
    server = new Server({
      configPath,
      port: 0,
      adminApiEndpointAuthEnabled: true,
      uiSettings: {
        grafanaUrl: "",
        showEditDiscoverySettings: true,
        showEditVRMSettings: true,
        showEditManualSettings: true,
        showEditSecuritySettings: true,
        showEditInfluxDBSettings: true,
      },
    })
  })

  afterEach(async () => {
    await fs.rm(configPath, { recursive: true, force: true })
  })

  describe("loadConfig", () => {
    it("merges a stored config one level deep over the defaults", async () => {
      await fs.writeFile(
        path.join(configPath, "config.json"),
        JSON.stringify({ influxdb: { host: "custom" }, upnp: { enabled: false } }),
      )
      const config = await server.loadConfig()
      expect(config.influxdb.host).toBe("custom")
      expect(config.influxdb.database).toBe("venus")
      expect(config.influxdb.retention).toBe("30d")
      expect(config.upnp.enabled).toBe(false)
      expect(config.upnp.enabledPortalIds).toEqual([])
      expect(config.vrm.enabled).toBe(true)
      expect(config.manual.hosts).toEqual([])
    })

    it("returns the defaults when the file is missing", async () => {
      const config = await server.loadConfig()
      expect(config.upnp.enabled).toBe(true)
      expect(config.influxdb.database).toBe("venus")
    })
  })

  describe("loadSecrets", () => {
    it("returns the stored secrets", async () => {
      await fs.writeFile(path.join(configPath, "secrets.json"), JSON.stringify({ vrmToken: "t" }))
      expect(await server.loadSecrets()).toEqual({ vrmToken: "t" })
    })

    it("falls back to the default admin login when the file is missing", async () => {
      expect(await server.loadSecrets()).toEqual({ login: { username: "admin", password: "admin" } })
    })
  })
})
