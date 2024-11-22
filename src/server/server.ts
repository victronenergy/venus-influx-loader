import express from "express"
import path from "node:path"
import http from "node:http"
import fs from "node:fs/promises"
import { createRootLogger, LogStorageTransport } from "./logger.js"
import { InfluxDBBackend } from "./influxdb"
import { WebSocketChannel } from "./websocket.js"
import bodyParser from "body-parser"
import compare from "tsscmp"
import auth from "basic-auth"
import {
  AppConfig,
  AppConfigFiles,
  AppInfluxDBProtocol,
  AppSecrets,
  AppUISettings,
  createAppConfig,
  createAppSecrets,
  LogLevel,
} from "../shared/types"
import { LogEntry, Logger } from "winston"
import { UPNP } from "./upnp"
import { VRM } from "./vrm"
import { AppStateActionType, DiscoveredDevice, VRMStatus } from "../shared/state.js"
import { Loader } from "./loader.js"

const defaultInfluxDBURL = new URL(process.env.VIL_INFLUXDB_URL || "http://influxdb:8086")
const defaultInfluxDBUsername = process.env.VIL_INFLUXDB_USERNAME || ""
const defaultInfluxDBPassword = process.env.VIL_INFLUXDB_PASSWORD || ""
const defaultInfluxDBDatabase = "venus"
const defaultInfluxDBRetention = "30d"

const defaultAdminUsername = "admin"
const defaultAdminPassword = "admin"

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
  // TODO: convert to ES class
  loader!: any
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
    const adminCredentials = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const credentials = auth(req)
      let login = this.secrets.login
      if (
        !credentials ||
        compare(credentials.name, login?.username ?? defaultAdminUsername) === false ||
        compare(credentials.pass, login?.password ?? defaultAdminPassword) === false
      ) {
        res.statusCode = 401
        res.setHeader("WWW-Authenticate", 'Basic realm="venus-influx-loader"')
        res.status(401).send()
      } else {
        next()
      }
    }

    // setup /admin-api routes and authentication, if enabled
    if (this.options.adminApiEndpoint) {
      this.logger.info(`Setting up ${this.options.adminApiEndpoint} routes`)

      // setup /admin-api basic auth, if enabled
      if (this.options.adminApiEndpointAuthEnabled) {
        app.use("/admin", adminCredentials)
      }
      app.use("/admin", express.static(path.join(__dirname, "../client")))
      app.get("/", (req, res) => {
        res.redirect("/admin")
      })

      // setup /admin-api basic auth, if enabled
      if (this.options.adminApiEndpointAuthEnabled) {
        app.use(this.options.adminApiEndpoint, adminCredentials)
      }

      const configureAdminRoutes = (await import("./admin-api")).default
      app.use(this.options.adminApiEndpoint, configureAdminRoutes(this))

      const configureVRMRoutes = (await import("./vrm-api")).default
      app.use(this.options.adminApiEndpoint, configureVRMRoutes(this))

      // prepare websocket channel for communication with Admin UI
      this.websocket = new WebSocketChannel(this)
      this.websocket.start()
    }

    // setup /discovery-api routes, if enabled
    if (this.options.discoveryApiEndpoint) {
      this.logger.info(`Setting up ${this.options.discoveryApiEndpoint} routes`)
      const configureDiscoveryApiRoutes = (await import("./discovery-api")).default
      app.use(this.options.discoveryApiEndpoint, configureDiscoveryApiRoutes(this))
    }

    // setup /grafana-api routes, if enabled
    if (this.options.grafanaApiEndpoint) {
      this.logger.info(`Setting up ${this.options.grafanaApiEndpoint} routes`)
      const configureGrafanaApiRoutes = (await import("./grafana-api")).default
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

  async loadConfig(): Promise<AppConfig> {
    const location = this.configFiles.configLocation
    const defaultConfig = createAppConfig({
      influxdb: {
        protocol: defaultInfluxDBURL.protocol.replace(":", "") as AppInfluxDBProtocol,
        host: defaultInfluxDBURL.hostname,
        port: defaultInfluxDBURL.port,
        path: defaultInfluxDBURL.pathname,
        username: defaultInfluxDBUsername,
        password: defaultInfluxDBPassword,
        database: defaultInfluxDBDatabase,
        retention: defaultInfluxDBRetention,
      },
    })
    try {
      this.logger.info(`Loading config from: ${location}...`)
      const contents = await fs.readFile(location, "utf-8")
      const config = JSON.parse(contents) as AppConfig
      // merge default with loaded overrides
      return {
        upnp: { ...defaultConfig.upnp, ...config.upnp },
        vrm: { ...defaultConfig.vrm, ...config.vrm },
        manual: { ...defaultConfig.manual, ...config.manual },
        influxdb: { ...defaultConfig.influxdb, ...config.influxdb },
      }
    } catch (error) {
      this.logger.error(`Failed loading config from: ${location}, error: ${error}.`)
      return defaultConfig
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
    // @ts-expect-error
    return this.app.on(event, listener)
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
