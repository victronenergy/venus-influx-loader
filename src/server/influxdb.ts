import axios, { AxiosError, AxiosRequestConfig } from "axios"
import ms, { StringValue } from "ms"
import { Server } from "./server.js"
import { Logger } from "winston"
import { AppInfluxDBProtocol, AppInfluxDBVersion } from "../shared/types.js"
import { posix } from "node:path"
import { Point, toLineProtocolBatch } from "./lineProtocol.js"

const retentionPolicyName = "venus_default"
const requestTimeout = 30_000

// "30d" -> 2592000, "" / "0" / unparsable -> undefined (infinite)
export function retentionSeconds(retention: string): number | undefined {
  if (!retention) {
    return undefined
  }
  try {
    const millis = ms(retention as StringValue)
    return millis && millis > 0 ? Math.round(millis / 1000) : undefined
  } catch {
    return undefined
  }
}

function describeError(error: unknown): string {
  if (error instanceof AxiosError && error.response) {
    return `${error.response.status} ${JSON.stringify(error.response.data)}`
  }
  return `${error}`
}

function isStatus(error: unknown, ...statuses: number[]): boolean {
  return error instanceof AxiosError && error.response !== undefined && statuses.includes(error.response.status)
}

// Stores points into InfluxDB 1.x, 2.x or 3 over plain HTTP. All versions accept the same
// line protocol write; only authentication and database/bucket provisioning differ.
export class InfluxDBBackend {
  server: Server
  logger: Logger
  isConnected: boolean = false

  version: AppInfluxDBVersion = "1"
  host: string = ""
  port: string = ""
  path: string = ""
  protocol: AppInfluxDBProtocol = "http"
  database: string = ""
  username?: string
  password?: string
  org: string = ""
  token: string = ""
  retention: string = ""

  base: string = ""
  bucketId?: string // v2 only

  lastWriteTime: number
  batchWriteInterval: number = 10
  accumulatedPoints: Point[] = []

  constructor(server: Server) {
    this.server = server
    this.logger = server.getLogger("influxdb")
    this.lastWriteTime = Date.now()
    this.server.on("settingsChanged", () => {
      this.settingsChanged()
    })

    this.settingsChanged()
  }

  settingsChanged() {
    this.logger.debug("settingsChanged")
    this.batchWriteInterval = (this.server.config.influxdb.batchWriteInterval || 10) * 1000
    if (!this.isConnected) {
      return
    }

    const { version, host, port, protocol, path, username, password, org, token, database, retention } =
      this.server.config.influxdb

    if (
      (version || "1") !== this.version ||
      this.host !== host ||
      this.port !== port ||
      this.path !== path ||
      this.protocol !== protocol ||
      this.database !== database ||
      this.username !== username ||
      this.password !== password ||
      this.org !== (org || "") ||
      this.token !== (token || "")
    ) {
      this.start()
    } else if (this.retention !== undefined && retention !== this.retention) {
      this._setRetentionPolicy(retention)
    }
  }

  async start() {
    this.isConnected = false
    try {
      await this._connect()
    } catch {
      setTimeout(async () => {
        this.start()
      }, 5000)
    }
  }

  async store(portalId: string, name: string, instanceNumber: string, measurement: string, value: unknown) {
    if (!this.isConnected || value === undefined || value === null) {
      return
    }

    let valueKey = "value"
    if (typeof value === "string") {
      if ((value as string).length === 0) {
        // skip empty strings
        return
      }
      valueKey = "stringValue"
    } else if (typeof value !== "number" || !Number.isFinite(value)) {
      // skip non-numeric payload (for example JSON) and NaN/Infinity
      return
    }

    // prepare InfluxDB point
    const point: Point = {
      timestamp: new Date(),
      measurement: measurement,
      tags: {
        portalId: portalId,
        instanceNumber: instanceNumber,
        name: name || portalId,
      },
      fields: {
        [valueKey]: value,
      },
    }

    this.accumulatedPoints.push(point)
    const now = Date.now()

    if (this.batchWriteInterval === 0 || now - this.lastWriteTime > this.batchWriteInterval) {
      this.lastWriteTime = now

      try {
        await this._write(this.accumulatedPoints)
        this.accumulatedPoints = []
      } catch (error) {
        this.accumulatedPoints = []
        this.logger.debug(describeError(error))
        this.start()
        throw error
      }
    }
  }

  // Writes a batch of points using line protocol. Not private so that tests can stub it.
  async _write(points: Point[]) {
    const { url, params } = this._writeRequest()
    await axios.post(url, toLineProtocolBatch(points), {
      ...this._requestConfig(params),
      headers: { "Content-Type": "text/plain; charset=utf-8", ...this._authHeaders() },
    })
  }

  _writeRequest(): { url: string; params: Record<string, string> } {
    switch (this.version) {
      case "1":
        return { url: `${this.base}write`, params: { db: this.database, precision: "ms" } }
      case "2":
        return { url: `${this.base}api/v2/write`, params: { org: this.org, bucket: this.database, precision: "ms" } }
      case "3":
        // InfluxDB 3 accepts the v2 write endpoint, `bucket` is simply the database name, `org` is ignored
        return { url: `${this.base}api/v2/write`, params: { bucket: this.database, precision: "ms" } }
    }
  }

  private _authHeaders(): Record<string, string> {
    switch (this.version) {
      case "1":
        return {}
      case "2":
        return { Authorization: `Token ${this.token}` }
      case "3":
        // no header when running against a server started with --without-auth
        return this.token ? { Authorization: `Bearer ${this.token}` } : {}
    }
  }

  private _requestConfig(params?: Record<string, string>): AxiosRequestConfig {
    return {
      timeout: requestTimeout,
      params,
      headers: this._authHeaders(),
      auth: this.version === "1" ? { username: this.username!!, password: this.password!! } : undefined,
    }
  }

  private async _connect() {
    const { version, host, port, protocol, path, username, password, org, token, database, retention } =
      this.server.config.influxdb

    this.version = version || "1"
    this.protocol = protocol
    this.host = host
    this.port = port
    this.database = database
    this.username = username || "root"
    this.password = password || "root"
    this.org = org || ""
    this.token = token || ""
    this.bucketId = undefined
    this.path = posix.normalize(path || "/")
    // ensure path starts, and ends with "/" when set
    if (!this.path.startsWith("/")) {
      this.path = "/" + this.path
    }
    if (!this.path.endsWith("/")) {
      this.path = this.path + "/"
    }
    this.base = `${this.protocol}://${this.host}:${this.port}${this.path}`

    const credentials =
      this.version === "1"
        ? `${this.username}:*****`
        : this.version === "2"
          ? `org ${this.org}, token *****`
          : "token *****"
    this.logger.info(
      `Attempting connection to InfluxDB ${this.version} at ${this.base}${this.database} using ${credentials}`,
    )

    try {
      switch (this.version) {
        case "1":
          await this._connectV1()
          break
        case "2":
          await this._connectV2()
          break
        case "3":
          await this._connectV3()
          break
      }
      this.logger.info(`Connected to ${this.host}:${this.port}/${this.database}`)
      this.isConnected = true
      await this._setRetentionPolicy(retention)
    } catch (error) {
      this.logger.error(`Unable to connect: ${describeError(error)}`)
      throw error
    }
  }

  // InfluxQL errors are reported inside a HTTP 200 body, so inspect it
  private async _query(q: string): Promise<any> {
    const response = await axios.post(`${this.base}query`, null, this._requestConfig({ q }))
    const error = response.data?.error ?? response.data?.results?.find((result: any) => result.error)?.error
    if (error) {
      throw new Error(error)
    }
    return response.data
  }

  private async _connectV1() {
    const data = await this._query("SHOW DATABASES")
    const databaseNames: string[] = (data?.results?.[0]?.series?.[0]?.values ?? []).flat()
    if (!databaseNames.includes(this.database)) {
      this.logger.info(`Creating database: ${this.database}`)
      await this._query(`CREATE DATABASE "${this.database}"`)
    }
  }

  private async _connectV2() {
    const orgs = (await axios.get(`${this.base}api/v2/orgs`, this._requestConfig({ org: this.org }))).data?.orgs
    if (!orgs?.length) {
      throw new Error(`Organization not found: ${this.org}`)
    }
    const orgID: string = orgs[0].id

    let buckets: any[] = []
    try {
      const response = await axios.get(
        `${this.base}api/v2/buckets`,
        this._requestConfig({ name: this.database, orgID }),
      )
      buckets = response.data?.buckets ?? []
    } catch (error) {
      if (!isStatus(error, 404)) {
        throw error
      }
    }

    if (buckets.length > 0) {
      this.bucketId = buckets[0].id
    } else {
      this.logger.info(`Creating bucket: ${this.database}`)
      const response = await axios.post(
        `${this.base}api/v2/buckets`,
        { orgID, name: this.database, retentionRules: this._v2RetentionRules(this.server.config.influxdb.retention) },
        this._requestConfig(),
      )
      this.bucketId = response.data.id
    }
  }

  private _v2RetentionRules(retention: string) {
    return [{ type: "expire", everySeconds: retentionSeconds(retention) ?? 0 }]
  }

  private async _connectV3() {
    await axios.get(`${this.base}health`, this._requestConfig())
    // The database is created on first write anyway, but creating it explicitly is the only
    // way to set its retention period on InfluxDB 3 Core.
    const body: Record<string, string> = { db: this.database }
    const retention = this.server.config.influxdb.retention
    if (retention) {
      body.retention_period = this._v3RetentionPeriod(retention)
    }
    try {
      await axios.post(`${this.base}api/v3/configure/database`, body, this._requestConfig())
      this.logger.info(`Created database: ${this.database}`)
    } catch (error) {
      if (isStatus(error, 409)) {
        this.logger.debug(`Database exists: ${this.database}`)
      } else if (isStatus(error, 401, 403)) {
        throw error
      } else {
        this.logger.warn(`Unable to create database ${this.database}: ${describeError(error)}`)
      }
    }
  }

  // InfluxDB 3 accepts hours/days/weeks, and treats "0d" as delete everything, so never send it
  private _v3RetentionPeriod(retention: string): string {
    const seconds = retentionSeconds(retention)
    return seconds === undefined ? "none" : `${Math.max(1, Math.round(seconds / 3600))}h`
  }

  private async _setRetentionPolicy(retention: string) {
    if (!this.isConnected || !retention) {
      return
    }

    this.logger.info(`Setting retention policy: ${retention}`)

    try {
      switch (this.version) {
        case "1":
          await this._setRetentionPolicyV1(retention)
          break
        case "2":
          await axios.patch(
            `${this.base}api/v2/buckets/${this.bucketId}`,
            { retentionRules: this._v2RetentionRules(retention) },
            this._requestConfig(),
          )
          break
        case "3":
          if (this.retention && this.retention !== retention) {
            this.logger.warn(
              `InfluxDB 3 applies the retention period only when the database is created, ${this.database} keeps its current retention`,
            )
          }
          break
      }
      this.logger.debug(`Retention policy set: ${retention}`)
      this.retention = retention
    } catch (error) {
      this.logger.error(`Error setting retention policy: ${retention}, ${describeError(error)}`)
    }
  }

  private async _setRetentionPolicyV1(retention: string) {
    const seconds = retentionSeconds(retention)
    const duration = seconds === undefined ? "INF" : `${seconds}s`
    const policy = `RETENTION POLICY "${retentionPolicyName}" ON "${this.database}" DURATION ${duration} REPLICATION 1 DEFAULT`
    try {
      await this._query(`CREATE ${policy}`)
    } catch {
      await this._query(`ALTER ${policy}`)
    }
  }
}
