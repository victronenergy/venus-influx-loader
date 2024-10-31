/* eslint-disable prettier/prettier */
import { InfluxDB } from "influx"
import { Server } from "./server"
import { Logger } from "winston"

export class InfluxDBBackend {
  server: Server
  logger: Logger
  isConnected: boolean = false

  host: string = ""
  port: string = ""
  database: string = ""
  username?: string
  password?: string
  retention: string = ""

  influxClient?: InfluxDB

  lastWriteTime: number
  batchWriteInterval: number = 10
  accumulatedPoints: any[] = []

  constructor(server: Server) {
    this.server = server
    this.logger = server.getLogger("influxdb")
    this.lastWriteTime = Date.now()
    this.server.on("settingsChanged", () => { this.settingsChanged() })

    this.settingsChanged()
  }

  settingsChanged() {
    this.logger.debug("settingsChanged")
    this.batchWriteInterval = (this.server.config.influxdb.batchWriteInterval || 10) * 1000
    if (!this.isConnected) {
      return
    }

    const { host, port, database, retention, username, password } = this.server.config.influxdb

    if (
      this.host !== host ||
      this.port !== port ||
      this.database !== database ||
      this.username !== username ||
      this.password !== password
    ) {
      this.start()
    } else if (this.retention !== undefined && retention !== this.retention) {
      this._setRetentionPolicy(retention)
    }
  }

  async start() {
    this.isConnected = false
    this.influxClient = undefined
    try {
      await this._connect()
    } catch {
      setTimeout(async () => {
        this.start()
      }, 5000)
    }
  }

  async store(portalId: string, name: string, instanceNumber: string, measurement: string, value: number) {
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
    } else if (typeof value !== "number") {
        // skip non-numeric payload (for example JSON)
        return
    }

    // prepare InfluxDB point
    const point = {
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
        await this.influxClient!!.writePoints(this.accumulatedPoints)
        this.accumulatedPoints = []
      } catch (error) {
        this.accumulatedPoints = []
        this.logger.debug(error)
        this.start()
        throw error
      }
    }
  }

  private async _connect() {
    const { host, port, database, retention, username, password } = this.server.config.influxdb

    this.host = host
    this.port = port
    this.database = database
    this.username = username !== "" ? username : "root"
    this.password = password !== "" ? password : "root"

    this.logger.info(`Attempting connection to ${this.host}:${this.port}/${this.database} using ${this.username}:*****`)

    try {

      this.influxClient = new InfluxDB({
        host: this.host,
        port: Number(this.port),
        protocol: "http",
        database: this.database,
        username: this.username,
        password: this.password,
      })

      const databaseNames = await this.influxClient.getDatabaseNames()
      this.logger.info(`Connected to ${this.host}:${this.port}/${this.database}`)
      if (!databaseNames.includes(this.database)) {
        this.logger.info(`Creating database: ${this.database}`)
        await this.influxClient.createDatabase(this.database)
      }
      this.isConnected = true
      await this._setRetentionPolicy(retention)
    } catch (error) {
      this.logger.error(`Unable to connect: ${error}`)
      throw error
    }
  }

  private async _setRetentionPolicy(retention: string) {
    if (!this.isConnected || !retention) {
      return
    }
    const opts = {
      duration: retention,
      replication: 1,
      isDefault: true,
    }

    this.logger.info(`Setting retention policy: ${retention}`)

    try {
      await this.influxClient!!.createRetentionPolicy("venus_default", opts)
      this.logger.debug(`Retention policy set: ${retention}`)
      this.retention = retention
    } catch {
      try {
        await this.influxClient!!.alterRetentionPolicy("venus_default", opts)
        this.logger.debug(`Retention policy set: ${retention}`)
        this.retention = retention
      } catch (error) {
        this.logger.error(`Error setting retention policy: ${retention}, ${error}`)
      }
    }
  }
}
