// Runs the InfluxDB backend against real InfluxDB 1.x, 2.x and 3 containers.
// Needs a running Docker daemon, run with `npm run test:integration`.
// Set VIL_TEST_INFLUX=1.8,3-core to run a subset of the targets.
import axios from "axios"
import { GenericContainer, StartedTestContainer, Wait, WaitStrategy } from "testcontainers"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { InfluxDBBackend } from "./influxdb.js"
import { Server } from "./server.js"
import { AppInfluxDBConfig, AppInfluxDBVersion } from "../shared/types.js"

interface Target {
  image: string
  version: AppInfluxDBVersion
  port: number
  env: Record<string, string>
  wait: WaitStrategy
  credentials: (_container: StartedTestContainer) => Promise<Partial<AppInfluxDBConfig>>
  // retention currently applied to the `venus` database/bucket, in seconds, undefined when not observable
  retention: (_ctx: Context) => Promise<number | undefined>
}

interface Context {
  url: string
  config: AppInfluxDBConfig
}

const v1Env = { INFLUXDB_HTTP_AUTH_ENABLED: "true", INFLUXDB_ADMIN_USER: "admin", INFLUXDB_ADMIN_PASSWORD: "s3cr4t" }
const v1Credentials = async () => ({ username: "admin", password: "s3cr4t" })
const v1Retention = async ({ url, config }: Context) => {
  const response = await axios.get(`${url}/query`, {
    params: { q: 'SHOW RETENTION POLICIES ON "venus"' },
    auth: { username: config.username!!, password: config.password!! },
  })
  const series = response.data.results[0].series[0]
  const row = series.values.find((values: string[]) => values[series.columns.indexOf("name")] === "venus_default")
  expect(row[series.columns.indexOf("default")]).toBe(true)
  return durationSeconds(row[series.columns.indexOf("duration")])
}

const targets: Target[] = [
  {
    image: "influxdb:1.8",
    version: "1",
    port: 8086,
    env: v1Env,
    wait: Wait.forHttp("/ping", 8086).forStatusCode(204),
    credentials: v1Credentials,
    retention: v1Retention,
  },
  {
    image: "influxdb:1.12",
    version: "1",
    port: 8086,
    env: v1Env,
    wait: Wait.forHttp("/ping", 8086).forStatusCode(204),
    credentials: v1Credentials,
    retention: v1Retention,
  },
  {
    image: "influxdb:2.9",
    version: "2",
    port: 8086,
    env: {
      DOCKER_INFLUXDB_INIT_MODE: "setup",
      DOCKER_INFLUXDB_INIT_USERNAME: "admin",
      DOCKER_INFLUXDB_INIT_PASSWORD: "s3cr4ts3cr4t",
      DOCKER_INFLUXDB_INIT_ORG: "venus",
      DOCKER_INFLUXDB_INIT_BUCKET: "init", // not `venus`, so that the loader has to create its bucket
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: "s3cr4t-token",
    },
    wait: Wait.forAll([Wait.forHttp("/health", 8086).forStatusCode(200), Wait.forLogMessage(/Listening/)]),
    credentials: async () => ({ org: "venus", token: "s3cr4t-token" }),
    retention: async ({ url, config }) => {
      const response = await axios.get(`${url}/api/v2/buckets`, {
        params: { name: "venus" },
        headers: { Authorization: `Token ${config.token}` },
      })
      return response.data.buckets[0].retentionRules[0].everySeconds
    },
  },
  {
    image: "influxdb:3-core",
    version: "3",
    port: 8181,
    env: { INFLUXDB3_NODE_ID: "node0", INFLUXDB3_OBJECT_STORE: "memory" },
    // /health answers 401 without a token, which still means the server is up
    wait: Wait.forHttp("/health", 8181).forStatusCodeMatching((code) => code === 200 || code === 401),
    credentials: async (container) => {
      const result = await container.exec(["influxdb3", "create", "token", "--admin", "--format", "json"])
      return { token: JSON.parse(result.output).token }
    },
    // InfluxDB 3 Core exposes no API to read a database's retention period back, so only
    // verify that the database exists
    retention: async ({ url, config }) => {
      const response = await axios.get(`${url}/api/v3/configure/database`, {
        params: { format: "json" },
        headers: { Authorization: `Bearer ${config.token}` },
      })
      expect(response.data.map((db: Record<string, string>) => db["iox::database"])).toContain("venus")
      return undefined
    },
  },
]

// "720h0m0s" -> 2592000
function durationSeconds(duration: string): number {
  const [, h = "0", m = "0", s = "0"] = duration.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/) ?? []
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}

function createBackend(config: AppInfluxDBConfig) {
  const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
  const server = { getLogger: () => logger, on: vi.fn(), config: { influxdb: config } } as unknown as Server
  return { backend: new InfluxDBBackend(server), logger, config }
}

// InfluxQL works on every version (through the Grafana-compatible /query endpoint) and returns
// tags and fields as columns, which makes the read-back uniform across targets
async function selectAll({ url, config }: Context, measurement: string): Promise<Record<string, unknown>[]> {
  const auth =
    config.version === "1"
      ? { auth: { username: config.username!!, password: config.password!! } }
      : config.version === "2"
        ? { headers: { Authorization: `Token ${config.token}` } }
        : { auth: { username: "any", password: config.token!! } }
  const response = await axios.get(`${url}/query`, {
    ...auth,
    // InfluxDB 3 rejects the multi-valued Accept header axios sends by default
    headers: { ...auth.headers, Accept: "application/json" },
    params: { db: "venus", q: `SELECT * FROM "${measurement}"` },
    // axios encodes spaces as "+", which InfluxDB 3 does not decode inside the query
    paramsSerializer: (params) =>
      Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join("&"),
    validateStatus: () => true,
  })
  if (response.status !== 200) {
    throw new Error(`query failed: ${response.status} ${JSON.stringify(response.data)} url=${response.request?.path}`)
  }
  const series = response.data.results[0].series?.[0]
  if (!series) {
    return []
  }
  return series.values.map((values: unknown[]) =>
    Object.fromEntries(series.columns.map((c: string, i: number) => [c, values[i]])),
  )
}

async function waitFor(condition: () => boolean, timeout = 10_000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error("timed out")
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const selected = process.env.VIL_TEST_INFLUX?.split(",").map((s) => s.trim())
const enabledTargets = targets.filter((t) => !selected || selected.some((s) => t.image.endsWith(s)))

describe.each(enabledTargets)("InfluxDBBackend against $image", (target) => {
  let container: StartedTestContainer
  let ctx: Context
  let backend: InfluxDBBackend
  let logger: ReturnType<typeof createBackend>["logger"]

  beforeAll(async () => {
    container = await new GenericContainer(target.image)
      .withExposedPorts(target.port)
      .withEnvironment(target.env)
      .withWaitStrategy(target.wait)
      .start()
    const url = `http://${container.getHost()}:${container.getMappedPort(target.port)}`
    const config: AppInfluxDBConfig = {
      version: target.version,
      protocol: "http",
      host: container.getHost(),
      port: String(container.getMappedPort(target.port)),
      path: "",
      database: "venus",
      retention: "30d",
      batchWriteInterval: 0,
      ...(await target.credentials(container)),
    }
    ctx = { url, config }
    ;({ backend, logger } = createBackend(config))
    backend.batchWriteInterval = 0
    await backend.start()
  })

  afterAll(async () => {
    backend.isConnected = false
    await container?.stop()
  })

  it("connects and provisions the database with the configured retention", async () => {
    expect(backend.isConnected).toBe(true)
    expect(backend.retention).toBe("30d")
    const retention = await target.retention(ctx)
    if (retention !== undefined) {
      expect(retention).toBe(30 * 24 * 3600)
    }
  })

  it("writes numeric and string points that survive line protocol escaping", async () => {
    await backend.store("portal 1", "My Boat, v=2", "288", "solarcharger/Dc/0/Voltage", 12.5)
    await backend.store("portal 1", "My Boat, v=2", "0", "system/Serial", 'HQ "1234"\\x')
    expect(backend.accumulatedPoints).toEqual([])

    const numbers = await selectAll(ctx, "solarcharger/Dc/0/Voltage")
    expect(numbers).toHaveLength(1)
    expect(numbers[0]).toMatchObject({ portalId: "portal 1", instanceNumber: "288", name: "My Boat, v=2", value: 12.5 })

    const strings = await selectAll(ctx, "system/Serial")
    expect(strings).toHaveLength(1)
    expect(strings[0]).toMatchObject({ portalId: "portal 1", instanceNumber: "0", stringValue: 'HQ "1234"\\x' })
  })

  it("applies a retention change made in the settings", async () => {
    ctx.config.retention = "7d"
    backend.settingsChanged()
    await waitFor(() => backend.retention === "7d")

    const retention = await target.retention(ctx)
    if (retention !== undefined) {
      expect(retention).toBe(7 * 24 * 3600)
    } else {
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("keeps its current retention"))
    }
  })

  it("does not connect with wrong credentials", async () => {
    // keep the reconnect loop from scheduling itself for the rest of the run
    const timeout = vi.spyOn(globalThis, "setTimeout").mockImplementation((() => 0) as any)
    try {
      const wrong = createBackend({ ...ctx.config, password: "wrong", token: "wrong" })
      wrong.backend.batchWriteInterval = 0
      await wrong.backend.start()
      expect(wrong.backend.isConnected).toBe(false)
      expect(wrong.logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Unable to connect: .*(401|403|authorization|unauthorized)/i),
      )
    } finally {
      timeout.mockRestore()
    }
  })
})
