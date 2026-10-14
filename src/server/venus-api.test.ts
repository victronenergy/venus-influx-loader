import express from "express"
import http from "node:http"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import configureVenusRoutes from "./venus-api.js"
import { Server } from "./server.js"
import { requestVenusPairingToken } from "./venus-pairing.js"

vi.mock("./venus-pairing.js", () => ({
  requestVenusPairingToken: vi.fn(),
}))

const pairing = vi.mocked(requestVenusPairingToken)

describe("venus-api routes", () => {
  const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
  const server = {
    getLogger: () => logger,
    emit: vi.fn(),
    saveSecrets: vi.fn(),
    secrets: {},
    config: { marker: true },
    upnpDevices: { abc: { portalId: "abc", address: "10.0.0.2", name: "cerbo" } },
  } as unknown as Server
  let httpServer: http.Server
  let baseUrl: string

  beforeAll(async () => {
    const app = express()
    app.use(express.json())
    app.use("/admin-api", configureVenusRoutes(server))
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
    pairing.mockResolvedValue({ tokenName: "token/venusinfluxloader/vil1", password: "s3cr4t" })
  })

  const post = (path: string, body: unknown) =>
    fetch(baseUrl + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

  describe("POST /venusPair", () => {
    it("pairs a manual host and stores the token in the secrets", async () => {
      const res = await post("/venusPair", { type: "IP", key: "venus.local" })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.tokenName).toBe("token/venusinfluxloader/vil1")
      expect(typeof body.pairedAt).toBe("number")
      expect(body.password).toBeUndefined()
      expect(pairing).toHaveBeenCalledWith("venus.local", logger)
      expect(server.secrets.venusTokens?.["IP:venus.local"]).toMatchObject({
        tokenName: "token/venusinfluxloader/vil1",
        password: "s3cr4t",
      })
      expect(server.saveSecrets).toHaveBeenCalledTimes(1)
    })

    it("rolls the token back when the secrets can not be saved", async () => {
      server.secrets.venusTokens = { "IP:other": { tokenName: "t", password: "p", pairedAt: 1 } }
      vi.mocked(server.saveSecrets).mockRejectedValueOnce(new Error("disk full"))
      const res = await post("/venusPair", { type: "IP", key: "venus.local" })
      expect(res.status).toBe(500)
      expect(Object.keys(server.secrets.venusTokens!!)).toEqual(["IP:other"])
    })

    it("pairs a discovered device using its discovered address", async () => {
      const res = await post("/venusPair", { type: "UPNP", key: "abc" })
      expect(res.status).toBe(200)
      expect(pairing).toHaveBeenCalledWith("10.0.0.2", logger)
      expect(server.secrets.venusTokens?.["UPNP:abc"]).toBeDefined()
    })

    it("keeps tokens of other devices", async () => {
      server.secrets.venusTokens = { "IP:other": { tokenName: "t", password: "p", pairedAt: 1 } }
      await post("/venusPair", { type: "IP", key: "venus.local" })
      expect(Object.keys(server.secrets.venusTokens!!)).toEqual(["IP:other", "IP:venus.local"])
    })

    it("rejects an unknown discovered device", async () => {
      const res = await post("/venusPair", { type: "UPNP", key: "nope" })
      expect(res.status).toBe(404)
      expect(pairing).not.toHaveBeenCalled()
    })

    it("rejects a malformed request", async () => {
      expect((await post("/venusPair", {})).status).toBe(400)
      expect((await post("/venusPair", { type: "VRM", key: "x" })).status).toBe(400)
      expect((await post("/venusPair", { type: "IP", key: "" })).status).toBe(400)
      expect(pairing).not.toHaveBeenCalled()
    })

    it("reports a failed pairing as plain text and does not save", async () => {
      pairing.mockRejectedValue(new Error("1.2.3.4 refused pairing (403)"))
      const res = await post("/venusPair", { type: "IP", key: "1.2.3.4" })
      expect(res.status).toBe(400)
      expect(await res.text()).toBe("1.2.3.4 refused pairing (403)")
      expect(server.saveSecrets).not.toHaveBeenCalled()
    })
  })

  describe("POST /venusUnpair", () => {
    it("forgets the token", async () => {
      server.secrets.venusTokens = {
        "IP:a": { tokenName: "t", password: "p", pairedAt: 1 },
        "UPNP:b": { tokenName: "t", password: "p", pairedAt: 1 },
      }
      const res = await post("/venusUnpair", { type: "IP", key: "a" })
      expect(res.status).toBe(200)
      expect(Object.keys(server.secrets.venusTokens!!)).toEqual(["UPNP:b"])
      expect(server.saveSecrets).toHaveBeenCalledTimes(1)
    })

    it("keeps the token when the secrets can not be saved", async () => {
      server.secrets.venusTokens = { "IP:a": { tokenName: "t", password: "p", pairedAt: 1 } }
      vi.mocked(server.saveSecrets).mockRejectedValueOnce(new Error("disk full"))
      const res = await post("/venusUnpair", { type: "IP", key: "a" })
      expect(res.status).toBe(500)
      expect(Object.keys(server.secrets.venusTokens!!)).toEqual(["IP:a"])
    })

    it("succeeds for a device that was never paired", async () => {
      const res = await post("/venusUnpair", { type: "IP", key: "a" })
      expect(res.status).toBe(200)
    })

    it("rejects a malformed request", async () => {
      expect((await post("/venusUnpair", { key: "a" })).status).toBe(400)
    })
  })

  describe("GET /venusTokens", () => {
    it("never exposes the password", async () => {
      server.secrets.venusTokens = { "IP:a": { tokenName: "token/x/y", password: "p", pairedAt: 42 } }
      const res = await fetch(baseUrl + "/venusTokens")
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ "IP:a": { tokenName: "token/x/y", pairedAt: 42 } })
    })

    it("returns an empty object without tokens", async () => {
      const res = await fetch(baseUrl + "/venusTokens")
      expect(await res.json()).toEqual({})
    })
  })
})
