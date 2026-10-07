import axios from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InfluxDBBackend, normalizeConnection } from "./influxdb.js"
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

describe("InfluxDBBackend.store", () => {
  describe("with immediate writes", () => {
    let backend: InfluxDBBackend
    let write: ReturnType<typeof vi.fn>
    let logger: ReturnType<typeof createLogger>

    beforeEach(() => {
      ;({ backend, write, logger } = createBackend())
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

    it("drops the batch, logs and reconnects without rethrowing when the write fails", async () => {
      write.mockRejectedValueOnce(new Error("boom"))
      backend.start = vi.fn().mockResolvedValue(undefined)
      await expect(backend.store("portal", "name", "0", "system/Serial", 1)).resolves.toBeUndefined()
      expect(backend.accumulatedPoints).toEqual([])
      expect(backend.start).toHaveBeenCalledOnce()
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("boom"))
    })

    it("writes immediately when the configured batch interval is 0", () => {
      const { backend } = createBackend({ batchWriteInterval: 0 })
      expect(backend.batchWriteInterval).toBe(0)
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

  describe("invalid configuration", () => {
    it.each<[Partial<AppInfluxDBConfig>, string]>([
      [{ version: "1.8" as any }, "Version must be one of 1, 2, 3"],
      [{ version: "2", org: "", token: "t" }, "Organization is required"],
      [{ retention: "30dd" }, "Invalid retention"],
    ])("refuses to connect with %j and does not retry", async (influxdb, message) => {
      vi.useFakeTimers()
      const get = vi.spyOn(axios, "get")
      const post = vi.spyOn(axios, "post")
      const { backend, logger } = createDisconnectedBackend(influxdb)
      await backend.start()

      expect(backend.isConnected).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(message))
      expect(get).not.toHaveBeenCalled()
      expect(post).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
      vi.useRealTimers()
    })

    it("throws instead of writing when the version is not supported", () => {
      const { backend } = createDisconnectedBackend({})
      backend.version = "4" as any
      expect(() => backend._writeRequest()).toThrow("Unsupported InfluxDB version: 4")
    })
  })

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

    it("escapes quotes and backslashes in the database name", async () => {
      const post = vi.spyOn(axios, "post").mockResolvedValueOnce(showDatabases([])).mockResolvedValue(ok)
      const { backend } = createDisconnectedBackend({ version: "1", database: 'a"b\\' })
      await backend.start()

      expect(post.mock.calls.map((call) => (call[2] as any).params.q)).toEqual([
        "SHOW DATABASES",
        'CREATE DATABASE "a\\"b\\\\"',
        'CREATE RETENTION POLICY "venus_default" ON "a\\"b\\\\" DURATION 2592000s REPLICATION 1 DEFAULT',
      ])
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
      // the bucket was created with the retention rule, no need to patch it again
      expect(patch).not.toHaveBeenCalled()
      expect(backend.retention).toBe("30d")
    })

    it("reuses an existing bucket and applies the retention to it", async () => {
      vi.spyOn(axios, "get")
        .mockResolvedValueOnce(axiosResponse({ orgs: [{ id: "org1" }] }))
        .mockResolvedValueOnce(axiosResponse({ buckets: [{ id: "existing" }] }))
      const post = vi.spyOn(axios, "post")
      const patch = vi.spyOn(axios, "patch").mockResolvedValue(axiosResponse({}))
      const { backend } = createDisconnectedBackend({ version: "2", org: "venus", token: "t" })
      await backend.start()

      expect(backend.bucketId).toBe("existing")
      expect(post).not.toHaveBeenCalled()
      expect(patch.mock.calls[0][0]).toBe("http://influx:8086/api/v2/buckets/existing")
      expect(patch.mock.calls[0][1]).toEqual({ retentionRules: [{ type: "expire", everySeconds: 2592000 }] })
      expect(backend.retention).toBe("30d")
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
      const { backend, logger } = createDisconnectedBackend({ version: "3", token: "t", port: "8181" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(calls(get)).toEqual(["http://influx:8181/health"])
      expect((get.mock.calls[0][1] as any).headers).toEqual({ Authorization: "Bearer t" })
      expect(post.mock.calls[0][0]).toBe("http://influx:8181/api/v3/configure/database")
      expect(post.mock.calls[0][1]).toEqual({ db: "venus", retention_period: "720h" })
      expect(backend.retention).toBe("30d")
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it("maps infinite retention to none and warns when the database already exists", async () => {
      vi.spyOn(axios, "get").mockResolvedValue(axiosResponse({ status: "pass" }))
      const post = vi.spyOn(axios, "post").mockRejectedValue(axiosError(409))
      const { backend, logger } = createDisconnectedBackend({ version: "3", token: "t", retention: "0" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(post.mock.calls[0][1]).toEqual({ db: "venus", retention_period: "none" })
      expect(logger.error).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("keeps its current retention (configured: 0)"))
      expect(backend.retention).toBe("0")
    })

    it("does not warn about an existing database when the retention is left unmanaged", async () => {
      vi.spyOn(axios, "get").mockResolvedValue(axiosResponse({ status: "pass" }))
      vi.spyOn(axios, "post").mockRejectedValue(axiosError(409))
      const { backend, logger } = createDisconnectedBackend({ version: "3", token: "t", retention: "" })
      await backend.start()

      expect(backend.isConnected).toBe(true)
      expect(logger.warn).not.toHaveBeenCalled()
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
  // a connected backend whose fields hold the normalised form of `influxdb`, the way _connect leaves them
  function createConnectedBackend(influxdb: Partial<AppInfluxDBConfig>) {
    const { backend } = createBackend({ ...baseConfig, ...influxdb })
    Object.assign(backend, normalizeConnection(backend.server.config.influxdb))
    backend.retention = backend.server.config.influxdb.retention
    backend.start = vi.fn().mockResolvedValue(undefined)
    const setRetentionPolicy = vi.spyOn(backend as any, "_setRetentionPolicy").mockResolvedValue(undefined)
    return { backend, setRetentionPolicy }
  }

  it("reconnects when version, org or token change", () => {
    const { backend } = createConnectedBackend({ version: "2", org: "a", token: "t" })
    backend.server.config.influxdb.token = "other"
    backend.settingsChanged()
    expect(backend.start).toHaveBeenCalledOnce()
  })

  it.each<Partial<AppInfluxDBConfig>>([
    { version: "2", org: "a", token: "t" },
    { version: "3", token: "" },
    { version: "1", path: undefined, username: undefined, password: undefined },
    { version: "1", path: "/influx", username: "u", password: "p" },
  ])("does not reconnect when nothing changed for %j", (influxdb) => {
    const { backend, setRetentionPolicy } = createConnectedBackend(influxdb)
    backend.server.config.influxdb = { ...backend.server.config.influxdb }
    backend.settingsChanged()
    expect(backend.start).not.toHaveBeenCalled()
    expect(setRetentionPolicy).not.toHaveBeenCalled()
  })

  it("only updates the retention policy when just the retention changed", () => {
    const { backend, setRetentionPolicy } = createConnectedBackend({ version: "2", org: "a", token: "t" })
    backend.server.config.influxdb.retention = "7d"
    backend.settingsChanged()
    expect(backend.start).not.toHaveBeenCalled()
    expect(setRetentionPolicy).toHaveBeenCalledWith("7d")
  })

  it("reconnects immediately while disconnected", () => {
    const { backend } = createConnectedBackend({})
    backend.isConnected = false
    backend.settingsChanged()
    expect(backend.start).toHaveBeenCalledOnce()
  })

  it("leaves the retry backoff alone while disconnected when the settings did not change", async () => {
    vi.useFakeTimers()
    const { backend } = createBackend(baseConfig)
    backend.isConnected = false
    delete (backend as any)._write
    // the real _connect records the settings it used, the mock has to do the same
    const connect = vi.spyOn(backend as any, "_connect").mockImplementation(() => {
      ;(backend as any).attemptedSettings = JSON.stringify(backend.server.config.influxdb)
      return Promise.reject(new Error("down"))
    })
    await backend.start()
    expect(connect).toHaveBeenCalledOnce()
    backend.settingsChanged()
    expect(connect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    backend.server.config.influxdb = { ...backend.server.config.influxdb, host: "elsewhere" }
    backend.settingsChanged()
    expect(connect).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe("InfluxDBBackend reconnect loop", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function createFailingBackend() {
    const { backend, logger } = createBackend(baseConfig)
    backend.isConnected = false
    delete (backend as any)._write
    const connect = vi.spyOn(backend as any, "_connect").mockRejectedValue(new Error("down"))
    return { backend, logger, connect }
  }

  it("shares one connection attempt between concurrent start() calls", async () => {
    vi.useFakeTimers()
    const { backend, connect } = createFailingBackend()
    await Promise.all([backend.start(), backend.start(), backend.start()])
    expect(connect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
  })

  it("schedules a single retry when several writes fail at once", async () => {
    vi.useFakeTimers()
    const { backend, connect } = createFailingBackend()
    backend.isConnected = true
    backend.batchWriteInterval = 0
    backend._write = vi.fn().mockRejectedValue(new Error("boom"))
    await Promise.all([1, 2, 3].map((v) => backend.store("portal", "name", "0", "m", v)))
    await vi.runOnlyPendingTimersAsync()
    // one attempt from the failed writes, one from the single retry timer
    expect(connect).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)
  })

  it("cancels the pending retry when start() is called explicitly", async () => {
    vi.useFakeTimers()
    const { backend, connect } = createFailingBackend()
    await backend.start()
    expect(vi.getTimerCount()).toBe(1)
    connect.mockResolvedValueOnce(undefined)
    await backend.start()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("re-evaluates settings that changed during a connection attempt", async () => {
    const { backend, connect } = createFailingBackend()
    let resolveConnect!: () => void
    connect.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveConnect = resolve)))
    const started = backend.start()
    backend.server.config.influxdb = { ...backend.server.config.influxdb, host: "elsewhere" }
    backend.settingsChanged()
    expect(connect).toHaveBeenCalledOnce()
    resolveConnect()
    await started
    // the connect mock did not set isConnected, so settingsChanged starts over with the new settings
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it("does not start over when settings emitted during the attempt are unchanged", async () => {
    vi.useFakeTimers()
    const { backend, connect } = createFailingBackend()
    // the real _connect records the settings it used, the mock has to do the same
    connect.mockImplementationOnce(() => {
      ;(backend as any).attemptedSettings = JSON.stringify(backend.server.config.influxdb)
      return Promise.reject(new Error("down"))
    })
    const started = backend.start()
    backend.settingsChanged() // Server.start emits settingsChanged right after the first start()
    await started
    expect(connect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
  })
})

describe("normalizeConnection", () => {
  it("fills in defaults and normalises the path", () => {
    expect(normalizeConnection({ ...baseConfig, path: undefined, version: undefined as any })).toMatchObject({
      version: "1",
      path: "/",
      username: "root",
      password: "root",
      org: "",
      token: "",
    })
    expect(normalizeConnection({ ...baseConfig, path: "influx//db" }).path).toBe("/influx/db/")
  })
})
