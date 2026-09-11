import axios from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InfluxDBBackend, retentionSeconds } from "./influxdb.js"
import { Server } from "./server.js"
import { AppInfluxDBConfig } from "../shared/types.js"

function createLogger() {
  return { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}

function createBackend(influxdb: Partial<AppInfluxDBConfig> = {}) {
  const logger = createLogger()
  const server = {
    getLogger: () => logger,
    on: vi.fn(),
    config: { influxdb },
  } as unknown as Server
  const backend = new InfluxDBBackend(server)
  const write = vi.fn().mockResolvedValue(undefined)
  backend.isConnected = true
  backend._write = write
  return { backend, write, logger }
}

const baseConfig: AppInfluxDBConfig = {
  version: "1",
  protocol: "http",
  host: "influx",
  port: "8086",
  path: "",
  database: "venus",
  retention: "30d",
  batchWriteInterval: 0,
}

function axiosResponse(data: unknown, status = 200) {
  return { data, status, statusText: "OK", headers: {}, config: {} as any }
}

function axiosError(status: number, data: unknown = {}) {
  return new axios.AxiosError("request failed", undefined, undefined, undefined, axiosResponse(data, status) as any)
}

describe("retentionSeconds", () => {
  it.each([
    ["30d", 2592000],
    ["2w", 1209600],
    ["12h", 43200],
    ["0", undefined],
    ["", undefined],
    ["garbage", undefined],
  ])("converts %j to %j", (input, expected) => {
    expect(retentionSeconds(input)).toBe(expected)
  })
})

describe("InfluxDBBackend.store", () => {
  describe("with immediate writes", () => {
    let backend: InfluxDBBackend
    let write: ReturnType<typeof vi.fn>

    beforeEach(() => {
      ;({ backend, write } = createBackend())
      backend.batchWriteInterval = 0
    })

    it.each([undefined, null, ""])("skips %j", async (value) => {
      await backend.store("portal", "name", "0", "system/Serial", value)
      expect(write).not.toHaveBeenCalled()
    })

    it.each([{ a: 1 }, true, [1], NaN, Infinity])("skips non-numeric payload %j", async (value) => {
      await backend.store("portal", "name", "0", "system/Serial", value)
      expect(write).not.toHaveBeenCalled()
    })

    it("stores numbers in the value field", async () => {
      await backend.store("portal", "name", "288", "solarcharger/Dc/0/Voltage", 12.5)
      expect(write).toHaveBeenCalledOnce()
      expect(write.mock.calls[0][0]).toEqual([
        {
          timestamp: expect.any(Date),
          measurement: "solarcharger/Dc/0/Voltage",
          tags: { portalId: "portal", instanceNumber: "288", name: "name" },
          fields: { value: 12.5 },
        },
      ])
    })

    it("stores strings in the stringValue field", async () => {
      await backend.store("portal", "name", "0", "system/Serial", "abc")
      expect(write.mock.calls[0][0][0].fields).toEqual({ stringValue: "abc" })
    })

    it("falls back to the portalId when the name is empty", async () => {
      await backend.store("portal", "", "0", "system/Serial", 1)
      expect(write.mock.calls[0][0][0].tags.name).toBe("portal")
    })

    it("does nothing when not connected", async () => {
      backend.isConnected = false
      await backend.store("portal", "name", "0", "system/Serial", 1)
      expect(write).not.toHaveBeenCalled()
    })

    it("drops the batch, reconnects and rethrows when the write fails", async () => {
      write.mockRejectedValueOnce(new Error("boom"))
      backend.start = vi.fn().mockResolvedValue(undefined)
      await expect(backend.store("portal", "name", "0", "system/Serial", 1)).rejects.toThrow("boom")
      expect(backend.accumulatedPoints).toEqual([])
      expect(backend.start).toHaveBeenCalledOnce()
    })
  })

  describe("with batching", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("accumulates points and flushes once the interval has passed", async () => {
      const { backend, write } = createBackend({ batchWriteInterval: 10 })
      expect(backend.batchWriteInterval).toBe(10_000)

      for (let i = 0; i < 3; i++) {
        await backend.store("portal", "name", "0", "m", i)
      }
      expect(write).not.toHaveBeenCalled()
      expect(backend.accumulatedPoints).toHaveLength(3)

      vi.advanceTimersByTime(10_001)
      await backend.store("portal", "name", "0", "m", 3)
      expect(write).toHaveBeenCalledOnce()
      expect(write.mock.calls[0][0]).toHaveLength(4)
      expect(backend.accumulatedPoints).toEqual([])
    })
  })
})

describe("InfluxDBBackend._write", () => {
  const point = {
    timestamp: new Date("2026-01-01T00:00:00.123Z"),
    measurement: "m",
    tags: { portalId: "p", instanceNumber: "0", name: "n" },
    fields: { value: 1 },
  }
  const line = "m,portalId=p,instanceNumber=0,name=n value=1 1767225600123"

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function connectAndWrite(influxdb: Partial<AppInfluxDBConfig>) {
    const { backend } = createBackend({ ...baseConfig, ...influxdb })
    // fill in the connection fields the way _connect would, without talking to a server
    Object.assign(backend, {
      version: influxdb.version,
      base: "http://influx:8086/",
      database: "venus",
      username: influxdb.username ?? "root",
      password: influxdb.password ?? "root",
      org: influxdb.org ?? "",
      token: influxdb.token ?? "",
    })
    delete (backend as any)._write
    const post = vi.spyOn(axios, "post").mockResolvedValue(axiosResponse(null, 204))
    await backend._write([point])
    expect(post).toHaveBeenCalledOnce()
    const [url, body, config] = post.mock.calls[0]
    return { url, body, config: config!! }
  }

  it("posts line protocol to /write with basic auth on v1", async () => {
    const { url, body, config } = await connectAndWrite({ version: "1", username: "u", password: "p" })
    expect(url).toBe("http://influx:8086/write")
    expect(body).toBe(line)
    expect(config.params).toEqual({ db: "venus", precision: "ms" })
    expect(config.auth).toEqual({ username: "u", password: "p" })
    expect(config.headers).toEqual({ "Content-Type": "text/plain; charset=utf-8" })
  })

  it("posts to /api/v2/write with org, bucket and Token auth on v2", async () => {
    const { url, body, config } = await connectAndWrite({ version: "2", org: "o", token: "t" })
    expect(url).toBe("http://influx:8086/api/v2/write")
    expect(body).toBe(line)
    expect(config.params).toEqual({ org: "o", bucket: "venus", precision: "ms" })
    expect(config.auth).toBeUndefined()
    expect(config.headers).toEqual({ "Content-Type": "text/plain; charset=utf-8", Authorization: "Token t" })
  })

  it("posts to /api/v2/write with bucket and Bearer auth on v3", async () => {
    const { url, config } = await connectAndWrite({ version: "3", token: "t" })
    expect(url).toBe("http://influx:8086/api/v2/write")
    expect(config.params).toEqual({ bucket: "venus", precision: "ms" })
    expect(config.headers).toEqual({ "Content-Type": "text/plain; charset=utf-8", Authorization: "Bearer t" })
  })

  it("sends no Authorization header on v3 without a token", async () => {
    const { config } = await connectAndWrite({ version: "3", token: "" })
    expect(config.headers).toEqual({ "Content-Type": "text/plain; charset=utf-8" })
  })
})

describe("InfluxDBBackend.start", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createDisconnectedBackend(influxdb: Partial<AppInfluxDBConfig>) {
    const { backend, logger } = createBackend({ ...baseConfig, ...influxdb })
    backend.isConnected = false
    delete (backend as any)._write
    return { backend, logger }
  }

  function calls(spy: { mock: { calls: any[][] } }) {
    return spy.mock.calls.map((call) => call[0])
  }

  describe("v1", () => {
    const showDatabases = (names: string[]) =>
      axiosResponse({ results: [{ series: [{ values: names.map((n) => [n]) }] }] })
    const ok = axiosResponse({ results: [{}] })

    it("creates the database and retention policy when missing", async () => {
      const post = vi
        .spyOn(axios, "post")
        .mockResolvedValueOnce(showDatabases(["_internal"]))
        .mockResolvedValue(ok)
      const { backend } = createDisconnectedBackend({ version: "1", username: "u", password: "p" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(backend.retention).toBe("30d")
      expect(calls(post)).toEqual(["http://influx:8086/query", "http://influx:8086/query", "http://influx:8086/query"])
      expect(post.mock.calls.map((call) => (call[2] as any).params.q)).toEqual([
        "SHOW DATABASES",
        'CREATE DATABASE "venus"',
        'CREATE RETENTION POLICY "venus_default" ON "venus" DURATION 2592000s REPLICATION 1 DEFAULT',
      ])
      expect((post.mock.calls[0][2] as any).auth).toEqual({ username: "u", password: "p" })
    })

    it("skips creation when the database exists and alters an existing retention policy", async () => {
      const post = vi
        .spyOn(axios, "post")
        .mockResolvedValueOnce(showDatabases(["venus"]))
        .mockResolvedValueOnce(axiosResponse({ results: [{ error: "retention policy already exists" }] }))
        .mockResolvedValue(ok)
      const { backend } = createDisconnectedBackend({ version: "1", retention: "0" })
      await backend.start()

      expect(post.mock.calls.map((call) => (call[2] as any).params.q)).toEqual([
        "SHOW DATABASES",
        'CREATE RETENTION POLICY "venus_default" ON "venus" DURATION INF REPLICATION 1 DEFAULT',
        'ALTER RETENTION POLICY "venus_default" ON "venus" DURATION INF REPLICATION 1 DEFAULT',
      ])
      expect((post.mock.calls[0][2] as any).auth).toEqual({ username: "root", password: "root" })
    })

    it("treats an InfluxQL error inside a 200 response as a failed connection", async () => {
      vi.useFakeTimers()
      vi.spyOn(axios, "post").mockResolvedValue(axiosResponse({ error: "authorization failed" }))
      const { backend, logger } = createDisconnectedBackend({ version: "1" })
      await backend.start()

      expect(backend.isConnected).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("authorization failed"))
      expect(vi.getTimerCount()).toBe(1) // reconnect scheduled
      vi.useRealTimers()
    })
  })

  describe("v2", () => {
    it("looks up the org, creates the bucket and applies retention", async () => {
      const get = vi
        .spyOn(axios, "get")
        .mockResolvedValueOnce(axiosResponse({ orgs: [{ id: "org1" }] }))
        .mockRejectedValueOnce(axiosError(404, { code: "not found" }))
      const post = vi.spyOn(axios, "post").mockResolvedValue(axiosResponse({ id: "bucket1" }, 201))
      const patch = vi.spyOn(axios, "patch").mockResolvedValue(axiosResponse({}))
      const { backend } = createDisconnectedBackend({ version: "2", org: "venus", token: "t" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(backend.bucketId).toBe("bucket1")
      expect(calls(get)).toEqual(["http://influx:8086/api/v2/orgs", "http://influx:8086/api/v2/buckets"])
      expect((get.mock.calls[0][1] as any).params).toEqual({ org: "venus" })
      expect((get.mock.calls[0][1] as any).headers).toEqual({ Authorization: "Token t" })
      expect((get.mock.calls[1][1] as any).params).toEqual({ name: "venus", orgID: "org1" })
      expect(post.mock.calls[0][0]).toBe("http://influx:8086/api/v2/buckets")
      expect(post.mock.calls[0][1]).toEqual({
        orgID: "org1",
        name: "venus",
        retentionRules: [{ type: "expire", everySeconds: 2592000 }],
      })
      expect(patch.mock.calls[0][0]).toBe("http://influx:8086/api/v2/buckets/bucket1")
      expect(patch.mock.calls[0][1]).toEqual({ retentionRules: [{ type: "expire", everySeconds: 2592000 }] })
    })

    it("reuses an existing bucket", async () => {
      vi.spyOn(axios, "get")
        .mockResolvedValueOnce(axiosResponse({ orgs: [{ id: "org1" }] }))
        .mockResolvedValueOnce(axiosResponse({ buckets: [{ id: "existing" }] }))
      const post = vi.spyOn(axios, "post")
      vi.spyOn(axios, "patch").mockResolvedValue(axiosResponse({}))
      const { backend } = createDisconnectedBackend({ version: "2", org: "venus", token: "t" })
      await backend.start()

      expect(backend.bucketId).toBe("existing")
      expect(post).not.toHaveBeenCalled()
    })

    it("fails when the org does not exist", async () => {
      vi.useFakeTimers()
      vi.spyOn(axios, "get").mockResolvedValueOnce(axiosResponse({ orgs: [] }))
      const { backend, logger } = createDisconnectedBackend({ version: "2", org: "nope", token: "t" })
      await backend.start()

      expect(backend.isConnected).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Organization not found: nope"))
      vi.useRealTimers()
    })
  })

  describe("v3", () => {
    it("checks health and creates the database with a retention period", async () => {
      const get = vi.spyOn(axios, "get").mockResolvedValue(axiosResponse({ status: "pass" }))
      const post = vi.spyOn(axios, "post").mockResolvedValue(axiosResponse({}, 200))
      const { backend } = createDisconnectedBackend({ version: "3", token: "t", port: "8181" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(calls(get)).toEqual(["http://influx:8181/health"])
      expect((get.mock.calls[0][1] as any).headers).toEqual({ Authorization: "Bearer t" })
      expect(post.mock.calls[0][0]).toBe("http://influx:8181/api/v3/configure/database")
      expect(post.mock.calls[0][1]).toEqual({ db: "venus", retention_period: "720h" })
    })

    it("maps infinite retention to none and tolerates an existing database", async () => {
      vi.spyOn(axios, "get").mockResolvedValue(axiosResponse({ status: "pass" }))
      const post = vi.spyOn(axios, "post").mockRejectedValue(axiosError(409))
      const { backend, logger } = createDisconnectedBackend({ version: "3", token: "t", retention: "0" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(post.mock.calls[0][1]).toEqual({ db: "venus", retention_period: "none" })
      expect(logger.error).not.toHaveBeenCalled()
    })

    it("fails on an authorization error", async () => {
      vi.useFakeTimers()
      vi.spyOn(axios, "get").mockResolvedValue(axiosResponse({ status: "pass" }))
      vi.spyOn(axios, "post").mockRejectedValue(axiosError(401, { error: "unauthorized" }))
      const { backend, logger } = createDisconnectedBackend({ version: "3", token: "bad" })
      await backend.start()

      expect(backend.isConnected).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("401"))
      vi.useRealTimers()
    })
  })
})

describe("InfluxDBBackend.settingsChanged", () => {
  it("reconnects when version, org or token change", () => {
    const { backend } = createBackend({ ...baseConfig, version: "2", org: "a", token: "t" })
    Object.assign(backend, {
      version: "2",
      host: "influx",
      port: "8086",
      path: "",
      protocol: "http",
      database: "venus",
      org: "a",
      token: "t",
    })
    backend.start = vi.fn().mockResolvedValue(undefined)

    backend.server.config.influxdb.token = "other"
    backend.settingsChanged()
    expect(backend.start).toHaveBeenCalledOnce()
  })
})
