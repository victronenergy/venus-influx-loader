import mqtt, { MqttClient } from "mqtt"
import ignoredMeasurements from "./ignoredMeasurements.js"
// @ts-expect-error
import buildInfo from "../buildInfo.cjs"
const buildVersion = buildInfo.buildVersion
import { Server } from "./server"
import { Logger } from "winston"
import { ConfiguredDevice, DiscoveredDevice, LoaderStatistics } from "../shared/state.js"

const collectStatsInterval = 5
const keepAliveInterval = 30

export class Loader {
  server: Server
  logger: Logger

  upnpConnections: { [portalId: string]: VenusMqttClient } = {}
  manualConnections: { [address: string]: VenusMqttClient } = {}
  vrmConnections: { [portalId: string]: VenusMqttClient } = {}

  loaderStatistics: LoaderStatistics = { distinctMeasurementsCount: 0, measurementRate: 0.1, deviceStatistics: {} }
  lastIntervalCount = 0

  collectInterval: any = undefined

  constructor(server: Server) {
    this.server = server
    this.logger = server.getLogger("loader")
  }

  async start() {
    // whenever settings change, we disconnect/reconnect as needed
    this.server.on("settingsChanged", () => {
      this.settingsChanged()
    })

    // whenever we discover new UPNP device, we disconnect/reconenct as needed
    this.server.on("upnpDiscovered", (_device) => {
      this.updateUpnpDeviceConnections()
    })

    // start sending loader statistics
    this.server.emit("loaderevent", {
      type: "LOADERSTATISTICS",
      data: this.loaderStatistics,
    })
    this.collectInterval = setInterval(() => {
      this.collectStats()
    }, collectStatsInterval * 1000)

    // initiate connections to configured devices
    this.settingsChanged()
  }

  collectStats() {
    // this.logger.debug("collectStats")

    let distinctMeasurementsCount = 0
    let totalMeasurementsCount = 0
    Object.keys(this.loaderStatistics.deviceStatistics).forEach((key) => {
      let stats = this.loaderStatistics.deviceStatistics[key]
      stats.measurementRate = (stats.totalMeasurementsCount - stats.lastIntervalCount) / collectStatsInterval
      stats.lastIntervalCount = stats.totalMeasurementsCount
      distinctMeasurementsCount += stats.distinctMeasurementsCount
      totalMeasurementsCount += stats.totalMeasurementsCount
      this.loaderStatistics.deviceStatistics[key] = stats
    })

    this.loaderStatistics = {
      measurementRate: (totalMeasurementsCount - this.lastIntervalCount) / collectStatsInterval,
      distinctMeasurementsCount: distinctMeasurementsCount,
      deviceStatistics: this.loaderStatistics.deviceStatistics,
    }

    this.lastIntervalCount = totalMeasurementsCount

    this.server.emit("loaderevent", {
      type: "LOADERSTATISTICS",
      data: this.loaderStatistics,
    })
  }

  private settingsChanged() {
    this.logger.debug("settingsChanged")

    this.updateUpnpDeviceConnections()
    this.updateHostnameDeviceConnections()
    this.updateVrmDeviceConnections()
  }

  private updateUpnpDeviceConnections() {
    // check what devices are enabled
    // and compute what devices should be disabled
    const config = this.server.config.upnp
    const enabled = config.enabled ? config.enabledPortalIds : []
    const disabled = arrayDifference(Object.keys(this.upnpConnections), enabled)
    // disconnect from Venus devices that are no longer enabled
    disabled.forEach((portalId) => {
      this.upnpConnections[portalId].stop()
      delete this.upnpConnections[portalId]
    })
    // connect to Venus devices that are enabled
    enabled.forEach((portalId) => this.initiateUpnpDeviceConnection(this.server.upnpDevices[portalId]))
  }

  private updateHostnameDeviceConnections() {
    // check what devices are enabled
    // and compute what devices should be disabled
    const config = this.server.config.manual
    const enabled = config.enabled
      ? config.hosts.reduce((result: string[], host) => {
          if (host.enabled) {
            result.push(host.hostName)
          }
          return result
        }, [])
      : []
    const disabled = arrayDifference(Object.keys(this.manualConnections), enabled)
    // disconnect from Venus devices that are no longer enabled
    disabled.forEach((hostName) => {
      this.manualConnections[hostName].stop()
      delete this.manualConnections[hostName]
    })
    // connect to Venus devices that are enabled
    enabled.forEach((hostName) => this.initiateHostnameDeviceConnection(hostName))
  }

  private updateVrmDeviceConnections() {
    // check what devices are enabled
    // and compute what devices should be disabled
    const config = this.server.config.vrm
    const enabled = config.enabled ? config.enabledPortalIds : []
    const disabled = arrayDifference(Object.keys(this.vrmConnections), enabled)
    // disconnect from Venus devices that are no longer enabled
    disabled.forEach((portalId) => {
      this.vrmConnections[portalId].stop()
      delete this.vrmConnections[portalId]
    })
    // connect to Venus devices that are enabled
    enabled.forEach((portalId) => this.initiateVrmDeviceConnection(portalId))
  }

  private async initiateUpnpDeviceConnection(d: DiscoveredDevice) {
    if (d === undefined) return
    if (this.upnpConnections[d.portalId]) {
      return
    }
    const device: ConfiguredDevice = { type: "UPNP", address: d.address, portalId: d.portalId }
    this.logger.debug(`initiateUpnpDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device)
    this.upnpConnections[d.portalId] = mqttClient
    await mqttClient.start()
  }

  private async initiateHostnameDeviceConnection(hostName: string) {
    if (hostName === undefined) return
    if (this.manualConnections[hostName]) {
      return
    }
    const device: ConfiguredDevice = { type: "IP", address: hostName }
    this.logger.debug(`initiateHostnameDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device)
    this.manualConnections[hostName] = mqttClient
    await mqttClient.start()
  }

  private async initiateVrmDeviceConnection(portalId: string) {
    if (portalId === undefined) return
    if (this.vrmConnections[portalId]) {
      return
    }
    const device: ConfiguredDevice = { type: "VRM", portalId: portalId, address: this.calculateVrmBrokerURL(portalId) }
    this.logger.debug(`initiateVrmDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, true)
    this.vrmConnections[portalId] = mqttClient
    await mqttClient.start()
  }

  private calculateVrmBrokerURL(portalId: string) {
    let sum = 0
    const lowered = portalId.toLowerCase()
    for (let i = 0; i < lowered.length; i++) {
      sum = sum + lowered.charCodeAt(i)
    }
    return `mqtt${sum % 128}.victronenergy.com`
  }
}

class VenusMqttClient {
  loader: Loader
  logger: Logger
  device: ConfiguredDevice
  client!: MqttClient
  address: string
  port: number
  isVrm: boolean
  isFirstKeepAliveRequest: boolean = true
  isDetectingPortalId: boolean = true
  venusKeepAlive: any

  constructor(loader: Loader, device: ConfiguredDevice, isVrm = false) {
    this.loader = loader
    this.logger = loader.server.getLogger(`${device.type}:${device.portalId ?? device.address}`)
    this.address = device.address!!
    this.port = isVrm ? 8883 : 1883
    this.device = device
    this.isVrm = isVrm

    this.setupStatistics()
  }

  async start() {
    this.logger.info("start")
    return new Promise((resolve, _reject) => {
      const clientId = Math.random().toString(16).slice(3)
      let options
      if (this.isVrm) {
        options = {
          rejectUnauthorized: false,
          username: `${this.loader.server.secrets.vrmUsername}`,
          password: `Token ${this.loader.server.secrets.vrmToken}`,
          // use random clientId + vrmTokenId to identify this loader instance
          clientId: `venus_influx_loader_${buildVersion}_${clientId}_${this.loader.server.secrets.vrmTokenId}`,
          reconnectPeriod: 10_000,
        }
      } else {
        options = {
          // use random clientId to identify this loader instance
          clientId: `venus_influx_loader_${buildVersion}_${clientId}`,
          reconnectPeriod: 10_000,
        }
      }
      this.logger.info(`MQTT connecting to ${this.address}:${this.port} using clientId: ${options.clientId}`)
      this.client = mqtt.connect(`${this.isVrm ? "mqtts" : "mqtt"}:${this.address}:${this.port}`, options)
      this.setupMqttClient()
      resolve(this)
    })
  }

  async stop() {
    this.logger.info("stop")
    this.client.end(true)
  }

  async changeExpirationDate() {
    // TODO: change expiration date, and if expired, disconnect
  }

  private setupMqttClient() {
    this.client.on("connect", () => {
      this.logger.info(`MQTT connected to ${this.clientRemoteAddress}`)
      if (this.device.portalId === undefined) {
        // we do not know the portalId yet (manual connection)
        this.logger.info("Detecting portalId...")
        this.client.subscribe("N/+/#")
        this.isDetectingPortalId = true
      } else {
        // we do know the portalId already (vrm + upnp connection)
        this.logger.info("Subscribing to portalId %s", this.device.portalId)
        this.client.subscribe(`N/${this.device.portalId}/settings/0/Settings/SystemSetup/SystemName`)
        this.client.subscribe(`N/${this.device.portalId}/#`)
        this.client.publish(`R/${this.device.portalId}/settings/0/Settings/SystemSetup/SystemName`, "")
        this.client.publish(`R/${this.device.portalId}/system/0/Serial`, "")
        this.isDetectingPortalId = false
      }
      if (!this.venusKeepAlive) {
        this.isFirstKeepAliveRequest = true
        this.venusKeepAlive = setInterval(() => {
          this.keepAlive()
        }, keepAliveInterval * 1000)
        this.logger.debug(`Starting keep alive timer`)
      }
    })

    this.client.on("message", (topic, message) => this.onMessage(topic, message))

    this.client.on("error", (error) => {
      this.logger.error(`MQTT connection to ${this.clientRemoteAddress}, ${error}`)
    })

    this.client.on("close", () => {
      this.logger.debug(`MQTT connection to ${this.clientRemoteAddress} closed`)

      if (this.venusKeepAlive) {
        this.logger.debug(`Clearing keep alive timer`)
        clearInterval(this.venusKeepAlive)
        this.venusKeepAlive = undefined
      }
    })

    this.client.on("offline", () => {
      this.logger.debug(`MQTT connection to ${this.clientRemoteAddress} offline`)

      // update stats
      if (this.device.portalId) {
        this.loader.loaderStatistics.deviceStatistics[this.device.portalId].isConnected = false
      }
    })

    this.client.on("end", () => {
      this.logger.info(`MQTT connection to ${this.clientRemoteAddress} ended`)
    })

    this.client.on("reconnect", () => {
      this.logger.debug(`MQTT reconnecting to ${this.clientRemoteAddress}`)
    })
  }

  private onMessage(topic: string, message: Buffer) {
    // this.logger.debug(`${topic}: ${message}`)

    if (message === undefined || message == null || message.length === 0) {
      return
    }

    const split = topic.split("/")
    const id = split[1]
    const instanceNumber = split[3]

    split.splice(0, 2)
    split.splice(1, 1)
    const measurement = split.join("/")

    if (ignoredMeasurements.find((path) => measurement.startsWith(path))) {
      return
    }

    try {
      const json = JSON.parse(message.toString("utf-8"))

      //this.logger.debug(`${id} ${instanceNumber} ${measurement} ${json.value}`)

      // detect portalId for manual connections
      if (this.isDetectingPortalId && measurement === "system/Serial") {
        this.logger.info("Detected portalId %s", json.value)
        this.client.subscribe(`N/${json.value}/settings/0/Settings/SystemSetup/SystemName`)
        this.client.subscribe(`N/${json.value}/#`)
        this.client.publish(`R/${json.value}/settings/0/Settings/SystemSetup/SystemName`, "")
        this.client.publish(`R/${json.value}/system/0/Serial`, "")
        this.isDetectingPortalId = false
        this.device.portalId = json.value
        return
      }

      // detect portalName for all connections
      if (this.device.name === undefined) {
        if (measurement === "settings/Settings/SystemSetup/SystemName") {
          if (json.value.length === 0) {
            this.device.name = id
          } else {
            this.logger.info("Detected portalName %s", json.value)
            this.device.name = json.value
          }
        }
        return
      }

      // update stats
      this.updateStatistics(measurement)

      this.loader.server.influxdb.store(id, this.device.name!!, instanceNumber, measurement, json.value)
    } catch (error) {
      this.logger.error(`can't record ${topic}: ${message}`)
      this.logger.error(error)
    }
  }

  private sendKeepAlive(isFirstKeepAliveRequest: boolean) {
    this.logger.debug(`sendKeepAlive: isFirstKeepAliveRequest: ${isFirstKeepAliveRequest}`)
    this.client.publish(
      `R/${this.device.portalId}/system/0/Serial`,
      isFirstKeepAliveRequest ? "" : '{ "keepalive-options" : ["suppress-republish"] }',
    )
  }

  private keepAlive() {
    if (this.device.portalId) {
      this.sendKeepAlive(this.isFirstKeepAliveRequest)
      this.isFirstKeepAliveRequest = false
    }
  }

  get clientRemoteAddress() {
    return `${this.client.options?.host}:${this.client.options?.port}`
  }

  get statisticsKey() {
    switch (this.device.type) {
      case "UPNP":
        return `${this.device.type}:${this.device.address}:${this.device.portalId!!}`
      case "VRM":
        return `${this.device.type}:${this.device.address}:${this.device.portalId!!}`
      case "IP":
      default:
        return `${this.device.type}:${this.device.address}:`
    }
  }

  private setupStatistics() {
    // prepare empty slot for device statistics
    this.loader.loaderStatistics.deviceStatistics[this.statisticsKey] = {
      type: this.device.type,
      address: this.device.address,
      isConnected: false,
      name: this.device.name || this.device.portalId!!,
      totalMeasurementsCount: 0,
      distinctMeasurementsCount: 0,
      measurementRate: 0,
      lastIntervalCount: 0,
      lastMeasurement: undefined,
    }
  }

  distinctMeasurements: Set<string> = new Set()

  private updateStatistics(measurement: string) {
    // no portalId -> wait
    if (this.device.portalId === undefined) return

    // remember how many distinct measurements each device receives
    this.distinctMeasurements.add(measurement)

    let portalStats = this.loader.loaderStatistics.deviceStatistics[this.statisticsKey]!!
    portalStats.isConnected = true
    portalStats.name = this.device.name || this.device.portalId!!
    portalStats.totalMeasurementsCount++
    portalStats.distinctMeasurementsCount = this.distinctMeasurements.size
    portalStats.lastMeasurement = new Date()
  }
}

function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((item) => !arr2.includes(item))
}
