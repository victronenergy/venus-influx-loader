import express from "express"
import path from "node:path"
import http from "node:http"
import { EventEmitter } from "node:events"
import fs from "node:fs/promises"
import { createRootLogger, LogStorageTransport } from "./logger.js"
import { InfluxDBBackend } from "./influxdb.js"
import { WebSocketChannel } from "./websocket.js"
import bodyParser from "body-parser"
import { createBasicAuthMiddleware, defaultAdminPassword, defaultAdminUsername } from "./auth.js"
import {
  AppConfig,
  AppConfigFiles,
  AppInfluxDBConfig,
  AppInfluxDBProtocol,
  AppSecrets,
  AppUISettings,
  createAppConfig,
  createAppSecrets,
  LogLevel,
} from "../shared/types.js"
import { migrateLegacyRetention, parseInfluxDBVersion, validateInfluxDBConfig } from "../shared/influxdbConfig.js"
import { LogEntry, Logger } from "winston"
import { UPNP } from "./upnp.js"
import { VRM } from "./vrm.js"
import { AppStateActionType, DiscoveredDevice, VRMStatus } from "../shared/state.js"
import { Loader } from "./loader.js"

const defaultInfluxDBDatabase = "venus"
const defaultInfluxDBRetention = "30d"

export interface ServerOptions {
  configPath: string
  port: number
  adminApiEndpoint?: string
  adminApiEndpointAuthEnabled: boolean
  grafanaApiEndpoint?: string
  discoveryApiEndpoint?: string
  uiSettings: AppUISettings
}

export class Server {
  private app: express.Express
  httpServer!: http.Server
  private websocket!: WebSocketChannel
  isRunning: boolean = false
  private options: ServerOptions

  private configFiles: AppConfigFiles
  config!: AppConfig
  secrets!: AppSecrets

  private rootLogger: Logger
  private logTransport: LogStorageTransport
  logger: Logger

  influxdb!: InfluxDBBackend
  loader!: Loader
  upnp!: UPNP
  vrm!: VRM

  constructor(options: ServerOptions) {
    const app = express()
    this.app = app

    this.options = options

    this.configFiles = {
      configLocation: path.join(options.configPath, "config.json"),
      secretsLocation: path.join(options.configPath, "secrets.json"),
    }

    const x = createRootLogger(this, "info")
    this.rootLogger = x.rootLogger
    this.logTransport = x.logTransport

    this.logger = this.getLogger("server")
  }

  async start() {
    const self = this
    const app = this.app

    // TODO: we should probably exit when we can not read secrets/config
    // TODO: or shall we create a default config and try starting?
    this.secrets = await this.loadSecrets()
    this.config = await this.loadConfig()

    if (this.config.debug) {
      this.rootLogger.level = "debug"
    }

    this.logger.debug("Starting server...")

    // setup listeners
    this.setupEventListeners()

    // start influxdb writer
    this.influxdb = new InfluxDBBackend(this)
    this.influxdb.start()

    // prepare upnp browser
    this.upnp = new UPNP(this as ServerMock)

    // prepare VRM helper
    this.vrm = new VRM(this)

    // start loader
    this.loader = new Loader(this)
    this.loader.start()

    // emit initial server state
    this.emitInitialServerState()

    // create http server
    this.httpServer = http.createServer(app)

    app.use(bodyParser.json())

    // basic auth
    const adminCredentials = createBasicAuthMiddleware(() => this.secrets.login)

    // setup /admin-api routes and authentication, if enabled
    if (this.options.adminApiEndpoint) {
      this.logger.info(`Setting up ${this.options.adminApiEndpoint} routes`)

      // setup /admin-api basic auth, if enabled
      if (this.options.adminApiEndpointAuthEnabled) {
        app.use("/admin", adminCredentials)
      }
      app.use("/admin", express.static(path.join(import.meta.dirname, "../client")))
      app.get("/", (req, res) => {
        res.redirect("/admin")
      })

      // setup /admin-api basic auth, if enabled
      if (this.options.adminApiEndpointAuthEnabled) {
        app.use(this.options.adminApiEndpoint, adminCredentials)
      }

      const configureAdminRoutes = (await import("./admin-api.js")).default
      app.use(this.options.adminApiEndpoint, configureAdminRoutes(this))

      const configureVRMRoutes = (await import("./vrm-api.js")).default
      app.use(this.options.adminApiEndpoint, configureVRMRoutes(this))

      // prepare websocket channel for communication with Admin UI
      this.websocket = new WebSocketChannel(this)
      this.websocket.start()
    }

    // setup /discovery-api routes, if enabled
    if (this.options.discoveryApiEndpoint) {
      this.logger.info(`Setting up ${this.options.discoveryApiEndpoint} routes`)
      const configureDiscoveryApiRoutes = (await import("./discovery-api.js")).default
      app.use(this.options.discoveryApiEndpoint, configureDiscoveryApiRoutes(this))
    }

    // setup /grafana-api routes, if enabled
    if (this.options.grafanaApiEndpoint) {
      this.logger.info(`Setting up ${this.options.grafanaApiEndpoint} routes`)
      const configureGrafanaApiRoutes = (await import("./grafana-api.js")).default
      app.use(this.options.grafanaApiEndpoint, configureGrafanaApiRoutes(this))
    }

    // listen
    return new Promise((resolve, _reject) => {
      const primaryPort = this.options.port
      this.httpServer.listen(primaryPort, () => {
        this.logger.info(`Server started, listening at *:${primaryPort}`)
        this.logger.debug("Starting server...")
        this.isRunning = true
        resolve(self)
      })
    })
  }

  async stop(cb?: () => void) {
    if (!this.isRunning) {
      return
    }
    this.logger.debug("Stopping server...")
    this.httpServer.close()
    this.logger.debug("Server stopped.")
    this.isRunning = false
    cb && cb()
  }

  get isDebugEnabled(): boolean {
    return this.rootLogger.level === "debug"
  }

  set isDebugEnabled(value: boolean) {
    this.rootLogger.level = value ? "debug" : "info"
    this.logger.log(this.rootLogger.level, `Log level changed to: ${this.rootLogger.level}`)
  }

  get logEntries(): LogEntry[] {
    return this.logTransport.entries
  }

  getLogger(label: string): Logger {
    return this.rootLogger.child({ label: label })
  }

  loaderState: { [type: string]: any } = {}

  upnpDevices: { [portalId: string]: DiscoveredDevice } = {}
  vrmDevices: { [portalId: string]: DiscoveredDevice } = {}

  setupEventListeners() {
    this.on("loaderevent", (event) => {
      if (event.type) {
        this.loaderState[event.type] = event
      }
    })

    this.on("upnpDiscoveryDidStart", () => {
      this.upnpDevices = {}
      this.emit("loaderevent", {
        type: "UPNPDISCOVERY",
        data: [],
      })
    })

    this.on("upnpDiscoveryDidStop", () => {
      this.upnpDevices = {}
      this.emit("loaderevent", {
        type: "UPNPDISCOVERY",
        data: [],
      })
    })

    this.on("upnpDiscovered", (device) => {
      if (this.upnpDevices[device.portalId] === undefined) {
        this.upnpDevices[device.portalId] = device
        // TODO: duplicate log from upnp and here
        this.logger.info("Found new UPNP device %j", device)

        this.emit("loaderevent", {
          type: "UPNPDISCOVERY",
          data: Object.values(this.upnpDevices),
        })
      }
    })

    this.on("vrmDiscovered", (devices) => {
      let initial: { [portalId: string]: DiscoveredDevice } = {}
      this.vrmDevices = devices.reduce((result, device) => {
        result[device.portalId] = device
        return result
      }, initial)
      // TODO: duplicate log from vrm and here
      this.logger.debug("Found VRM devices %j", devices)

      this.emit("loaderevent", {
        type: "VRMDISCOVERY",
        data: devices,
      })
    })

    this.on("vrmStatus", (status) => {
      this.emit("loaderevent", {
        type: "VRMSTATUS",
        data: status,
      })
    })

    this.on("settingsChanged", () => {
      this.settingsChanged()
    })
  }

  emitInitialServerState() {
    this.emit("loaderevent", {
      type: "DEBUG",
      data: this.logger.level === "debug",
    })

    this.emit("settingsChanged", this.config)

    this.emit("loaderevent", {
      type: "UI_SETTINGS",
      data: this.options.uiSettings,
    })
  }

  async settingsChanged() {
    this.logger.debug("Settings changed...")

    // start local upnp browser if enabled and not running
    if (this.config.upnp.enabled && !this.upnp.isRunning) {
      if (!this.options.discoveryApiEndpoint) {
        this.upnp.start()
      }
    }

    // stop local upnp browser if enabled and running
    if (!this.config.upnp.enabled && this.upnp.isRunning) {
      if (!this.options.discoveryApiEndpoint) {
        this.upnp.stop()
      }
    }

    // reload VRM portals and set VRM state depending on settings
    try {
      await this.vrm.refresh()
    } catch {
      /* empty */
    }

    this.emit("loaderevent", {
      type: "LOADER_SETTINGS",
      data: this.config,
    })
  }

  async loadSecrets(): Promise<AppSecrets> {
    const location = this.configFiles.secretsLocation
    try {
      this.logger.info(`Loading secrets from: ${location}...`)
      const contents = await fs.readFile(location, "utf-8")
      return JSON.parse(contents) as AppSecrets
    } catch (error) {
      this.logger.error(`Failed loading secrets from: ${location}, error: ${error}.`)
      return createAppSecrets({
        login: {
          username: defaultAdminUsername,
          password: defaultAdminPassword,
        },
      })
    }
  }

  // InfluxDB settings taken from the VIL_INFLUXDB_* environment, used only when no config.json exists yet
  private influxDBConfigFromEnvironment(): AppInfluxDBConfig {
    const env = process.env
    const version = parseInfluxDBVersion(env.VIL_INFLUXDB_VERSION || "1")
    if (version === undefined) {
      this.logger.error(`Ignoring VIL_INFLUXDB_VERSION=${env.VIL_INFLUXDB_VERSION}, it must be 1, 2 or 3`)
    }
    const url = new URL(env.VIL_INFLUXDB_URL || (version === "3" ? "http://influxdb:8181" : "http://influxdb:8086"))
    return {
      version: version ?? "1",
      protocol: url.protocol.replace(":", "") as AppInfluxDBProtocol,
      host: url.hostname,
      // the URL parser drops the default port of the scheme
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
      path: url.pathname,
      username: env.VIL_INFLUXDB_USERNAME || "",
      password: env.VIL_INFLUXDB_PASSWORD || "",
      org: env.VIL_INFLUXDB_ORG || "",
      token: env.VIL_INFLUXDB_TOKEN || "",
      database: defaultInfluxDBDatabase,
      retention: defaultInfluxDBRetention,
    }
  }

  async loadConfig(): Promise<AppConfig> {
    const location = this.configFiles.configLocation
    let config: AppConfig
    try {
      this.logger.info(`Loading config from: ${location}...`)
      const contents = await fs.readFile(location, "utf-8")
      const stored = JSON.parse(contents) as AppConfig
      // fill in keys missing from the stored config (for example after an upgrade) with the
      // neutral built-in defaults, the environment only applies to a brand new installation
      const defaultConfig = createAppConfig()
      config = {
        upnp: { ...defaultConfig.upnp, ...stored.upnp },
        vrm: { ...defaultConfig.vrm, ...stored.vrm },
        manual: { ...defaultConfig.manual, ...stored.manual },
        influxdb: { ...defaultConfig.influxdb, ...stored.influxdb },
      }
      this.migrateInfluxDBConfig(config.influxdb)
    } catch (error) {
      this.logger.error(`Failed loading config from: ${location}, error: ${error}.`)
      config = createAppConfig({ influxdb: this.influxDBConfigFromEnvironment() })
    }
    // keep any remaining invalid configuration so that the Admin UI shows what needs fixing, the
    // InfluxDB backend refuses to connect until it is valid
    for (const problem of validateInfluxDBConfig(config.influxdb)) {
      this.logger.error(`Invalid InfluxDB configuration: ${problem}`)
    }
    return config
  }

  // Repairs values written by older versions or by hand so that an upgrade never leaves the
  // loader unable to connect: the version may be a number or garbage, the retention may be any
  // InfluxQL duration. The repaired config is persisted on the next save.
  private migrateInfluxDBConfig(influxdb: AppInfluxDBConfig) {
    const version = parseInfluxDBVersion(influxdb.version)
    if (version === undefined) {
      this.logger.error(`Unsupported InfluxDB version ${JSON.stringify(influxdb.version)} in config, using 1`)
    }
    influxdb.version = version ?? "1"

    const retention = influxdb.retention ?? ""
    const migrated = migrateLegacyRetention(retention)
    if (migrated === undefined) {
      this.logger.error(
        `Invalid InfluxDB retention ${JSON.stringify(retention)} in config, leaving retention unmanaged`,
      )
      influxdb.retention = ""
    } else if (migrated !== retention) {
      this.logger.warn(`Migrated InfluxDB retention ${JSON.stringify(retention)} to ${JSON.stringify(migrated)}`)
      influxdb.retention = migrated
    }
  }

  async saveConfig() {
    const location = this.configFiles.configLocation
    try {
      this.logger.info(`Saving config to: ${location}...`)
      await fs.writeFile(location, JSON.stringify(this.config, null, 2))
      this.emit("settingsChanged", this.config)
    } catch (error) {
      this.logger.error(`Failed saving config to: ${location}, error: ${error}.`)
      throw error
    }
  }

  async saveSecrets() {
    const location = this.configFiles.secretsLocation
    try {
      this.logger.info(`Saving secrets to: ${location}...`)
      await fs.writeFile(location, JSON.stringify(this.secrets, null, 2))
    } catch (error) {
      this.logger.error(`Failed saving secrets to: ${location}, error: ${error}.`)
      throw error
    }
  }

  // typed variant of EventEmitter.emit
  emit<K extends keyof ServerEvents>(event: K, data: ServerEvents[K]) {
    this.app.emit(event, data)
  }

  // typed variant of EventEmitter.on
  on<K extends keyof ServerEvents>(event: K, listener: (_data: ServerEvents[K]) => void) {
    // bypass the express-specific on("mount") overload, we only use the plain EventEmitter behaviour
    return (this.app as EventEmitter).on(event, listener as (..._args: unknown[]) => void)
  }

  // typed variant of EventEmitter.removeListener
  removeListener<K extends keyof ServerEvents>(event: K, listener: (_data: ServerEvents[K]) => void) {
    this.app.removeListener(event, listener)
  }
}

export interface ServerEvents {
  loaderevent: { type: AppStateActionType; data: any }
  settingsChanged: AppConfig
  upnpDiscoveryDidStart: {}
  upnpDiscoveryDidStop: {}
  upnpDiscovered: DiscoveredDevice
  vrmStatus: VRMStatus
  vrmDiscovered: DiscoveredDevice[]
}

export interface ServerMock {
  getLogger: (_label: string) => LoggerMock
  emit: (_type: string, _data: any) => void
}

export interface LoggerMock {
  log: (_level: LogLevel, _message: string) => void
}
