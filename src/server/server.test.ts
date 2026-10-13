import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Server } from "./server.js"

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
      expect(config.influxdb.version).toBe("1")
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

    describe("with VIL_INFLUXDB_* environment", () => {
      const env = {
        VIL_INFLUXDB_VERSION: "2",
        VIL_INFLUXDB_URL: "https://influx.example:8443/influx",
        VIL_INFLUXDB_ORG: "org",
        VIL_INFLUXDB_TOKEN: "token",
      }

      beforeEach(() => {
        Object.assign(process.env, env)
      })

      afterEach(() => {
        for (const key of Object.keys(env)) {
          delete process.env[key]
        }
      })

      it("uses the environment when the file is missing", async () => {
        const config = await server.loadConfig()
        expect(config.influxdb).toMatchObject({
          version: "2",
          protocol: "https",
          host: "influx.example",
          port: "8443",
          path: "/influx",
          org: "org",
          token: "token",
        })
      })

      it("ignores the environment when a file exists, missing keys get the neutral defaults", async () => {
        await fs.writeFile(
          path.join(configPath, "config.json"),
          JSON.stringify({ influxdb: { host: "old", port: "8086", database: "venus", retention: "30d" } }),
        )
        const config = await server.loadConfig()
        expect(config.influxdb.version).toBe("1")
        expect(config.influxdb.host).toBe("old")
        expect(config.influxdb.org).toBeUndefined()
        expect(config.influxdb.token).toBeUndefined()
      })

      it("falls back to version 1 when the environment version is not supported", async () => {
        process.env.VIL_INFLUXDB_VERSION = "1.8"
        const config = await server.loadConfig()
        expect(config.influxdb.version).toBe("1")
      })

      it("fills in the default port of the URL scheme", async () => {
        process.env.VIL_INFLUXDB_URL = "https://influx.example.com"
        const config = await server.loadConfig()
        expect(config.influxdb.port).toBe("443")
      })

      it("defaults to port 8181 for InfluxDB 3", async () => {
        process.env.VIL_INFLUXDB_VERSION = "3"
        delete process.env.VIL_INFLUXDB_URL
        const config = await server.loadConfig()
        expect(config.influxdb).toMatchObject({ version: "3", host: "influxdb", port: "8181" })
      })
    })

    describe("migrating a stored file", () => {
      async function load(influxdb: object) {
        await fs.writeFile(path.join(configPath, "config.json"), JSON.stringify({ influxdb }))
        return (await server.loadConfig()).influxdb
      }

      it("coerces a numeric version", async () => {
        expect((await load({ version: 2 })).version).toBe("2")
      })

      it("falls back to version 1 for an unsupported version", async () => {
        expect((await load({ version: "1.8" })).version).toBe("1")
      })

      it.each([
        ["INF", "0"],
        ["720h0m0s", "30d"],
        ["1h30m", "90m"],
        ["30d", "30d"],
        ["", ""],
      ])("migrates the legacy retention %j to %j", async (stored, expected) => {
        expect((await load({ retention: stored })).retention).toBe(expected)
      })

      it("leaves the retention unmanaged when it can not be migrated", async () => {
        expect((await load({ retention: "30dd" })).retention).toBe("")
      })
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
