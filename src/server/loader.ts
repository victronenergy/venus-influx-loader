import mqtt, { MqttClient } from "mqtt"
import ignoredMeasurements from "./ignoredMeasurements.js"
// @ts-expect-error
import buildInfo from "../buildInfo.cjs"
const buildVersion = buildInfo.buildVersion
import { Server } from "./server"
import { Logger } from "winston"
import { ConfiguredDevice, DiscoveredDevice, LoaderStatistics } from "../shared/state.js"
import ms from "ms"
import { VenusMQTTTopic } from "../shared/types.js"

const collectStatsInterval = 5
const checkExpiryInterval = 60
const keepAliveInterval = 30

const defaultVenusMQTTSubscriptions: VenusMQTTTopic[] = ["/#"]
const niceToHaveVenusMQTTSubscriptions: VenusMQTTTopic[] = ["/system/#", "/settings/#"]

export class Loader {
  server: Server
  logger: Logger

  upnpConnections: { [portalId: string]: VenusMqttClient } = {}
  manualConnections: { [address: string]: VenusMqttClient } = {}
  vrmConnections: { [portalId: string]: VenusMqttClient } = {}

  loaderStatistics: LoaderStatistics = { distinctMeasurementsCount: 0, measurementRate: 0.1, deviceStatistics: {} }
  lastIntervalCount = 0

  collectStatisticsInterval: any = undefined
  checkExpiryInterval: any = undefined
  isConfigFileDirty = false

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
      type: "LOADER_STATISTICS",
      data: this.loaderStatistics,
    })
    this.collectStatisticsInterval = setInterval(() => {
      this.collectStatistics()
    }, collectStatsInterval * 1000)

    this.checkExpiryInterval = setInterval(() => {
      this.checkExpiry()
    }, checkExpiryInterval * 1000)

    // initiate connections to configured devices
    this.settingsChanged()
  }

  collectStatistics() {
    // this.logger.debug("collectStatistics")

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

    let totalIntervalCount = totalMeasurementsCount - this.lastIntervalCount
    if (totalIntervalCount < 0) {
      totalIntervalCount = 0
    }

    this.loaderStatistics = {
      measurementRate: totalIntervalCount / collectStatsInterval,
      distinctMeasurementsCount: distinctMeasurementsCount,
      deviceStatistics: this.loaderStatistics.deviceStatistics,
    }

    this.lastIntervalCount = totalMeasurementsCount

    this.server.emit("loaderevent", {
      type: "LOADER_STATISTICS",
      data: this.loaderStatistics,
    })
  }

  async checkExpiry() {
    this.logger.debug("checkExpiry")

    // mark config as not dirty and update all connections to recompute expiry
    this.isConfigFileDirty = false
    this.settingsChanged()

    // save settings in case something expired
    if (this.isConfigFileDirty) {
      await this.server.saveConfig()
    }
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
    // check device expiry settings (add one minute to never go negative on the dashboard)
    const now = Date.now() + 60_000
    const expired = enabled.filter((device) => (config.expiry[device] ? config.expiry[device] < now : false))
    const remaining = arrayDifference(enabled, expired)
    const disabled = arrayDifference(Object.keys(this.upnpConnections), remaining)
    // disconnect from Venus devices that are no longer enabled
    disabled.forEach((portalId) => {
      this.upnpConnections[portalId].stop()
      delete this.upnpConnections[portalId]
    })
    // connect to Venus devices that are enabled and not expired
    remaining.forEach((portalId) =>
      this.initiateUpnpDeviceConnection(
        this.server.upnpDevices[portalId],
        config.subscriptions[portalId],
        config.expiry[portalId],
      ),
    )
    // disable expired devices in the config file
    this.server.config.upnp.enabledPortalIds = remaining
    expired.forEach((device) => delete this.server.config.upnp.expiry[device])
    // mark config as dirty to save it eventually
    this.isConfigFileDirty = this.isConfigFileDirty ? true : expired.length > 0
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
    // check device expiry settings (add one minute to never go negative on the dashboard)
    const now = Date.now() + 60_000
    const expired = enabled.filter((device) => (config.expiry[device] ? config.expiry[device] < now : false))
    const remaining = arrayDifference(enabled, expired)
    const disabled = arrayDifference(Object.keys(this.manualConnections), remaining)
    // disconnect from Venus devices that are no longer enabled
    disabled.forEach((hostName) => {
      this.manualConnections[hostName].stop()
      delete this.manualConnections[hostName]
    })
    // connect to Venus devices that are enabled
    remaining.forEach((hostName) =>
      this.initiateHostnameDeviceConnection(hostName, config.subscriptions[hostName], config.expiry[hostName]),
    )
    // disable expired devices in the config file
    expired.forEach((hostName) => {
      this.server.config.manual.hosts.forEach((host) => {
        if (host.hostName === hostName) host.enabled = false
      })
      delete this.server.config.manual.expiry[hostName]
    })
    // mark config as dirty to save it eventually
    this.isConfigFileDirty = this.isConfigFileDirty ? true : expired.length > 0
  }

  private updateVrmDeviceConnections() {
    // check what devices are enabled
    // and compute what devices should be disabled
    const config = this.server.config.vrm
    const e1 = config.enabled ? config.enabledPortalIds : []
    const e2 = config.enabled
      ? config.manualPortalIds.reduce((r: string[], e) => {
          if (e.enabled) r.push(e.portalId)
          return r
        }, [])
      : []
    const enabled = [...e1, ...e2]
    // check device expiry settings (add one minute to never go negative on the dashboard)
    const now = Date.now() + 60_000
    const expired = enabled.filter((device) => (config.expiry[device] ? config.expiry[device] < now : false))
    const remaining = arrayDifference(enabled, expired)
    const disabled = arrayDifference(Object.keys(this.vrmConnections), remaining)
    // disconnect from Venus devices that are no longer enabled
    disabled.forEach((portalId) => {
      this.vrmConnections[portalId].stop()
      delete this.vrmConnections[portalId]
    })
    // connect to Venus devices that are enabled
    remaining.forEach((portalId) =>
      this.initiateVrmDeviceConnection(portalId, config.subscriptions[portalId], config.expiry[portalId]),
    )
    // disable expired devices in the config file
    expired.forEach((portalId) => {
      this.server.config.vrm.enabledPortalIds = this.server.config.vrm.enabledPortalIds.filter((x) => x !== portalId)
      this.server.config.vrm.manualPortalIds.forEach((inst) => {
        if (inst.portalId === portalId) inst.enabled = false
      })
      delete this.server.config.vrm.expiry[portalId]
    })
    // mark config as dirty to save it eventually
    this.isConfigFileDirty = this.isConfigFileDirty ? true : expired.length > 0
  }

  private async initiateUpnpDeviceConnection(d: DiscoveredDevice, subscriptions: VenusMQTTTopic[], expiry?: number) {
    if (d === undefined) return
    if (this.upnpConnections[d.portalId]) {
      this.upnpConnections[d.portalId].updateExpiry(expiry)
      this.upnpConnections[d.portalId].updateSubscriptions(this.prepareVenusMQTTSubscriptions(subscriptions))
      return
    }
    const device: ConfiguredDevice = {
      type: "UPNP",
      address: d.address,
      portalId: d.portalId,
      subscriptions: this.prepareVenusMQTTSubscriptions(subscriptions),
    }
    this.logger.debug(`initiateUpnpDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, expiry)
    this.upnpConnections[d.portalId] = mqttClient
    await mqttClient.start()
  }

  private async initiateHostnameDeviceConnection(hostName: string, subscriptions: VenusMQTTTopic[], expiry?: number) {
    if (hostName === undefined) return
    if (this.manualConnections[hostName]) {
      this.manualConnections[hostName].updateExpiry(expiry)
      this.manualConnections[hostName].updateSubscriptions(this.prepareVenusMQTTSubscriptions(subscriptions))
      return
    }
    const device: ConfiguredDevice = {
      type: "IP",
      address: hostName,
      subscriptions: this.prepareVenusMQTTSubscriptions(subscriptions),
    }
    this.logger.debug(`initiateHostnameDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, expiry)
    this.manualConnections[hostName] = mqttClient
    await mqttClient.start()
  }

  private async initiateVrmDeviceConnection(portalId: string, subscriptions: VenusMQTTTopic[], expiry?: number) {
    if (portalId === undefined) return
    if (this.vrmConnections[portalId]) {
      this.vrmConnections[portalId].updateExpiry(expiry)
      this.vrmConnections[portalId].updateSubscriptions(this.prepareVenusMQTTSubscriptions(subscriptions))
      return
    }
    const device: ConfiguredDevice = {
      type: "VRM",
      portalId: portalId,
      address: this.calculateVrmBrokerURL(portalId),
      subscriptions: this.prepareVenusMQTTSubscriptions(subscriptions),
    }
    this.logger.debug(`initiateVrmDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, expiry, true)
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

  private prepareVenusMQTTSubscriptions(subscriptions?: VenusMQTTTopic[]) {
    if (subscriptions && subscriptions.filter((topic) => topic === "/#").length == 0) {
      return [...subscriptions, ...niceToHaveVenusMQTTSubscriptions]
    }
    return defaultVenusMQTTSubscriptions
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
  expiry?: number
  isFirstKeepAliveRequest: boolean = true
  isDetectingPortalId: boolean = true
  venusKeepAlive: any

  constructor(loader: Loader, device: ConfiguredDevice, expiry?: number, isVrm = false) {
    this.loader = loader
    this.logger = loader.server.getLogger(`${device.type}:${device.portalId ?? device.address}`)
    this.address = device.address!!
    this.port = isVrm ? 8883 : 1883
    this.device = device
    this.expiry = expiry
    this.isVrm = isVrm

    this.setupStatistics()
  }

  async start() {
    this.logger.info(`start, will stop ${this.formatExpiry(this.expiry)}`)
    if (this.isVrm && this.device.name === undefined) {
      this.device.name = await this.loader.server.vrm.getInstallationName(this.device.portalId!!, this.logger)
    }
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
    delete this.loader.loaderStatistics.deviceStatistics[this.statisticsKey]
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
        this.logger.info("Using portalId %s", this.device.portalId)
        this.client.subscribe(`N/${this.device.portalId}/settings/0/Settings/SystemSetup/SystemName`)
        for (const topic of this.device.subscriptions) {
          const x = `N/${this.device.portalId}${topic}`
          this.logger.info(`Subscribing to '${x}'`)
          this.client.subscribe(x)
        }
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
        this.loader.loaderStatistics.deviceStatistics[this.statisticsKey].isConnected = false
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
        for (const sub of this.device.subscriptions) {
          const x = `N/${json.value}${sub}`
          this.logger.info(`Subscribing to '${x}'`)
          this.client.subscribe(x)
        }
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
      expiry: this.expiry,
      portalId: this.device.portalId,
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

  updateSubscriptions(subscriptions: VenusMQTTTopic[]) {
    const existingSubs = this.device.subscriptions
    const newSubs = subscriptions
    const diff = arrayDifference(existingSubs, newSubs)
    if (existingSubs.length == newSubs.length && diff.length == 0) {
      return
    }

    const toSubscribe = arrayDifference(newSubs, existingSubs)
    const toUnsubscribe = arrayDifference(existingSubs, newSubs)
    const toKeep = arrayDifference(existingSubs, toUnsubscribe)
    this.logger.info(
      `updateSubscriptions, unsubscribe: ${JSON.stringify(toUnsubscribe)}, keep: ${JSON.stringify(toKeep)}, subscribe: ${JSON.stringify(toSubscribe)}`,
    )
    this.device.subscriptions = [...toSubscribe, ...toKeep]
    if (!this.isDetectingPortalId) {
      for (const topic of toUnsubscribe) {
        const x = `N/${this.device.portalId}${topic}`
        this.logger.info(`Unsubscribing from '${x}'`)
        this.client.unsubscribe(x)
      }
      for (const topic of toSubscribe) {
        const x = `N/${this.device.portalId}${topic}`
        this.logger.info(`Subscribing to '${x}'`)
        this.client.subscribe(x)
      }
    }
  }

  updateExpiry(expiry?: number) {
    if (this.expiry === expiry) {
      return
    }
    this.expiry = expiry
    this.logger.info(`updateExpiry, will stop ${this.formatExpiry(this.expiry)}`)
    this.loader.loaderStatistics.deviceStatistics[this.statisticsKey].expiry = this.expiry
  }

  formatExpiry(expiry?: number) {
    let formattedExpiry = "never"
    if (expiry) {
      const now = Date.now()
      formattedExpiry = `in ${ms(expiry - now)} (${new Date(expiry).toISOString()})`
    }
    return formattedExpiry
  }
}

function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((item) => !arr2.includes(item))
}
