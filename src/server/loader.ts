import mqtt, { IPublishPacket, MqttClient } from "mqtt"
import ignoredMeasurements from "./ignoredMeasurements.js"
import buildInfo from "../buildInfo.cjs"
const buildVersion = buildInfo.buildVersion
import { Server } from "./server.js"
import { Logger } from "winston"
import { ConfiguredDevice, DeviceStatisticsDetails, DiscoveredDevice, LoaderStatistics } from "../shared/state.js"
import ms from "ms"
import { AppManualConfig, AppSecrets, VenusMQTTTopic } from "../shared/types.js"
import { venusTokenKey } from "../shared/venusConfig.js"

const collectStatsInterval = 5
const checkExpiryInterval = 60
const keepAliveInterval = 30

const secureProfileHint = "(device in Secured mode?)"

const defaultVenusMQTTSubscriptions: VenusMQTTTopic[] = ["/#"]
const niceToHaveVenusMQTTSubscriptions: VenusMQTTTopic[] = ["/system/#", "/settings/#"]

export interface VenusTopic {
  portalId: string
  instanceNumber: string
  measurement: string
}

// N/<portalId>/<service>/<instance>/<path...> -> { portalId, instanceNumber, measurement: "<service>/<path...>" }
export function parseVenusTopic(topic: string): VenusTopic {
  const split = topic.split("/")
  const portalId = split[1]
  const instanceNumber = split[3]
  split.splice(0, 2)
  split.splice(1, 1)
  return { portalId, instanceNumber, measurement: split.join("/") }
}

export function calculateVrmBrokerURL(portalId: string): string {
  let sum = 0
  const lowered = portalId.toLowerCase()
  for (let i = 0; i < lowered.length; i++) {
    sum = sum + lowered.charCodeAt(i)
  }
  return `mqtt${sum % 128}.victronenergy.com`
}

export interface VenusMqttConnection {
  url: string
  options: mqtt.IClientOptions
}

// Decides how to reach a device: VRM brokers and secure local devices use TLS on 8883 with
// credentials, plain local devices use 1883 without. Throws when a secure local device has no
// pairing token stored yet. The token is only ever copied into the options, never onto the device.
export function buildVenusMqttConnection(
  device: ConfiguredDevice,
  secrets: AppSecrets,
  clientId: string,
): VenusMqttConnection {
  // random clientId to identify this loader instance
  const base: mqtt.IClientOptions = {
    clientId: `venus_influx_loader_${buildVersion}_${clientId}`,
    reconnectPeriod: 10_000,
    protocolVersion: 5,
  }
  if (device.type === "VRM") {
    return {
      url: `mqtts://${device.address}:8883`,
      options: {
        ...base,
        rejectUnauthorized: false,
        username: `${secrets.vrmUsername}`,
        password: `Token ${secrets.vrmToken}`,
        // append the vrmTokenId to tell loader instances apart on VRM
        clientId: `${base.clientId}_${secrets.vrmTokenId}`,
      },
    }
  }
  if (device.secure) {
    const key = venusTokenKey(device.type, device.type === "IP" ? device.address : device.portalId!!)
    const token = secrets.venusTokens?.[key]
    if (token === undefined) {
      throw new Error("Collection paused: Configured as Secured, but not yet paired")
    }
    return {
      url: `mqtts://${device.address}:8883`,
      options: {
        ...base,
        // Venus OS uses a self-signed certificate
        rejectUnauthorized: false,
        username: token.tokenName,
        password: token.password,
        // the device refuses the token while its MQTT Access is off, keep retrying until it is
        // turned on again (mqtt.js otherwise gives up after a refused CONNACK)
        reconnectOnConnackError: true,
      },
    }
  }
  return { url: `mqtt://${device.address}:1883`, options: base }
}

// Everything that decides *how* we connect, the clientId is random per connection.
// undefined means "can not connect" (secure device without a token), two of those are the same.
export function isSameVenusMqttConnection(a?: VenusMqttConnection, b?: VenusMqttConnection): boolean {
  if (a === undefined || b === undefined) {
    return a === b
  }
  const { clientId: _a, ...optionsA } = a.options
  const { clientId: _b, ...optionsB } = b.options
  return a.url === b.url && JSON.stringify(optionsA) === JSON.stringify(optionsB)
}

// Enabled manual hosts with their Secured flag, keyed by hostName. Duplicate hostNames are rejected
// by the Admin UI but not by the API, the first enabled entry wins.
export function enabledManualHosts(config: AppManualConfig): Map<string, boolean> {
  const hosts = new Map<string, boolean>()
  if (!config.enabled) return hosts
  for (const host of config.hosts) {
    if (host.enabled && !hosts.has(host.hostName)) {
      hosts.set(host.hostName, host.secure === true)
    }
  }
  return hosts
}

// system error code (ECONNREFUSED, EPROTO, ...) carried by socket errors
function errorCode(error: Error): string | undefined {
  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code : undefined
}

// Dashboard text for an MQTT client error, a refused connection to a dual-stack host surfaces as an
// AggregateError with an empty message, so fall back to the error code
export function describeMqttError(error: Error): string {
  if (error instanceof mqtt.ErrorWithReasonCode) {
    return `${error.message} (code ${error.code})`
  }
  const code = errorCode(error)
  if (error.message.length === 0 && code !== undefined) {
    return code
  }
  return error.message
}

export function prepareVenusMQTTSubscriptions(subscriptions?: VenusMQTTTopic[]): VenusMQTTTopic[] {
  if (subscriptions && subscriptions.filter((topic) => topic === "/#").length == 0) {
    return [...subscriptions, ...niceToHaveVenusMQTTSubscriptions]
  }
  return defaultVenusMQTTSubscriptions
}

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

    // whenever secrets change (pairing, VRM login), we reconnect devices whose credentials changed
    this.server.on("secretsChanged", () => {
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
      // an async callback that rejects would otherwise terminate the process as an unhandled rejection
      this.checkExpiry().catch((error) => this.logger.error(`checkExpiry failed: ${error}`))
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
        (config.securePortalIds ?? []).includes(portalId),
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
    const hosts = enabledManualHosts(config)
    const enabled = [...hosts.keys()]
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
      this.initiateHostnameDeviceConnection(
        hostName,
        hosts.get(hostName) === true,
        config.subscriptions[hostName],
        config.expiry[hostName],
      ),
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
    // without a VRM token there is nothing to authenticate with, disconnect everything
    const isUsable = config.enabled && this.server.secrets.vrmToken !== undefined
    const e1 = isUsable ? config.enabledPortalIds : []
    const e2 = isUsable
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

  // Keeps an existing connection (expiry/subscriptions updated in place) and returns undefined,
  // or tears it down because the way we connect changed (secure flag, pairing token, VRM token)
  // and returns what the replacement should inherit.
  private reuseConnection(
    connections: { [key: string]: VenusMqttClient },
    key: string,
    secure: boolean,
    subscriptions: VenusMQTTTopic[],
    expiry?: number,
  ): { replace: true; name?: string } | undefined {
    const existing = connections[key]
    if (existing === undefined) return { replace: true }
    if (existing.needsReconnect(this.server.secrets, secure)) {
      this.logger.info(`${key}: connection settings changed, reconnecting`)
      existing.stop()
      delete connections[key]
      return { replace: true, name: existing.device.name }
    }
    existing.updateExpiry(expiry)
    existing.updateSubscriptions(prepareVenusMQTTSubscriptions(subscriptions))
    return undefined
  }

  private async initiateUpnpDeviceConnection(
    d: DiscoveredDevice,
    secure: boolean,
    subscriptions: VenusMQTTTopic[],
    expiry?: number,
  ) {
    if (d === undefined) return
    const replacement = this.reuseConnection(this.upnpConnections, d.portalId, secure, subscriptions, expiry)
    if (replacement === undefined) return
    const device: ConfiguredDevice = {
      type: "UPNP",
      address: d.address,
      portalId: d.portalId,
      name: replacement.name,
      secure,
      subscriptions: prepareVenusMQTTSubscriptions(subscriptions),
    }
    this.logger.debug(`initiateUpnpDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, expiry)
    this.upnpConnections[d.portalId] = mqttClient
    await mqttClient.start()
  }

  private async initiateHostnameDeviceConnection(
    hostName: string,
    secure: boolean,
    subscriptions: VenusMQTTTopic[],
    expiry?: number,
  ) {
    if (hostName === undefined) return
    const replacement = this.reuseConnection(this.manualConnections, hostName, secure, subscriptions, expiry)
    if (replacement === undefined) return
    const device: ConfiguredDevice = {
      type: "IP",
      address: hostName,
      name: replacement.name,
      secure,
      subscriptions: prepareVenusMQTTSubscriptions(subscriptions),
    }
    this.logger.debug(`initiateHostnameDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, expiry)
    this.manualConnections[hostName] = mqttClient
    await mqttClient.start()
  }

  private async initiateVrmDeviceConnection(portalId: string, subscriptions: VenusMQTTTopic[], expiry?: number) {
    if (portalId === undefined) return
    const replacement = this.reuseConnection(this.vrmConnections, portalId, false, subscriptions, expiry)
    if (replacement === undefined) return
    const device: ConfiguredDevice = {
      type: "VRM",
      portalId: portalId,
      address: calculateVrmBrokerURL(portalId),
      // the name does not depend on the token, no need to ask VRM again
      name: replacement.name,
      subscriptions: prepareVenusMQTTSubscriptions(subscriptions),
    }
    this.logger.debug(`initiateVrmDeviceConnection: ${JSON.stringify(device)}`)
    const mqttClient = new VenusMqttClient(this, device, expiry)
    this.vrmConnections[portalId] = mqttClient
    await mqttClient.start()
  }
}

class VenusMqttClient {
  loader: Loader
  logger: Logger
  device: ConfiguredDevice
  client?: MqttClient
  connection?: VenusMqttConnection
  expiry?: number
  isFirstKeepAliveRequest: boolean = true
  isDetectingPortalId: boolean = true
  hasConnected: boolean = false
  isStopped: boolean = false
  venusKeepAlive: any

  constructor(loader: Loader, device: ConfiguredDevice, expiry?: number) {
    this.loader = loader
    this.logger = loader.server.getLogger(`${device.type}:${device.portalId ?? device.address}`)
    this.device = device
    this.expiry = expiry

    this.setupStatistics()
  }

  get isVrm() {
    return this.device.type === "VRM"
  }

  async start() {
    this.logger.info(`start, will stop ${this.formatExpiry(this.expiry)}`)
    // decide how to connect first, needsReconnect() compares against it while the name lookup below is pending
    const clientId = Math.random().toString(16).slice(3)
    try {
      this.connection = buildVenusMqttConnection(this.device, this.loader.server.secrets, clientId)
    } catch (error) {
      // stays listed on the dashboard with the reason, re-evaluated on the next settings change
      this.logger.error(`${(error as Error).message}`)
      this.setLastError((error as Error).message)
      return
    }
    if (this.isVrm && this.device.name === undefined) {
      this.device.name = await this.loader.server.vrm.getInstallationName(this.device.portalId!!, this.logger)
    }
    // torn down while the name lookup was pending, the replacement connection owns the device now
    if (this.isStopped) return
    this.logger.info(`MQTT connecting to ${this.connection.url} using clientId: ${this.connection.options.clientId}`)
    this.client = mqtt.connect(this.connection.url, this.connection.options)
    this.setupMqttClient(this.client)
  }

  // Everything that may still fire afterwards (keep alive timer, queued messages, the asynchronous
  // close event) must not touch the statistics slot, it may already belong to the replacement.
  async stop() {
    this.logger.info("stop")
    this.isStopped = true
    this.stopKeepAlive()
    this.client?.end(true)
    delete this.loader.loaderStatistics.deviceStatistics[this.statisticsKey]
  }

  private stopKeepAlive() {
    if (this.venusKeepAlive) {
      this.logger.debug(`Clearing keep alive timer`)
      clearInterval(this.venusKeepAlive)
      this.venusKeepAlive = undefined
    }
  }

  // true when the stored secrets or the secure flag now lead to a different connection
  needsReconnect(secrets: AppSecrets, secure: boolean): boolean {
    let fresh: VenusMqttConnection | undefined
    try {
      fresh = buildVenusMqttConnection({ ...this.device, secure }, secrets, "")
    } catch {
      fresh = undefined
    }
    return !isSameVenusMqttConnection(this.connection, fresh)
  }

  // the statistics slot of a stopped client may already belong to its replacement
  private get statistics(): DeviceStatisticsDetails | undefined {
    return this.isStopped ? undefined : this.loader.loaderStatistics.deviceStatistics[this.statisticsKey]
  }

  private setLastError(message?: string) {
    const stats = this.statistics
    if (stats) {
      stats.lastError = message
    }
  }

  private setupMqttClient(client: MqttClient) {
    client.on("connect", () => {
      this.logger.info(`MQTT connected to ${this.clientRemoteAddress}`)
      this.hasConnected = true
      this.setLastError(undefined)
      // every connect should trigger full republish on first keepalive
      this.isFirstKeepAliveRequest = true
      if (this.device.portalId === undefined) {
        // we do not know the portalId yet (manual connection)
        this.logger.info("Detecting portalId...")
        // dbus-flashmq only supports publishing at QoS 0
        client.subscribe("N/+/#", { qos: 0 })
        this.isDetectingPortalId = true
      } else {
        // we do know the portalId already (vrm + upnp connection)
        this.logger.info("Using portalId %s", this.device.portalId)
        this.subscribeAndRequestRepublish()
      }
      if (!this.venusKeepAlive) {
        this.venusKeepAlive = setInterval(() => {
          this.keepAlive()
        }, keepAliveInterval * 1000)
        this.logger.debug(`Starting keep alive timer`)
      }
    })

    client.on("message", (topic, message, packet) => this.onMessage(topic, message, packet))

    client.on("error", (error) => {
      this.logger.error(`MQTT connection to ${this.clientRemoteAddress}, ${error}`)
      // "Connection refused: Not authorized (code 135)" for a deleted pairing token,
      // "write EPROTO ... wrong version number" for TLS against a plaintext port, ...
      let message = describeMqttError(error)
      // a Secured network profile closes the plaintext port, point the user to the fix
      if (!this.isVrm && !this.device.secure && errorCode(error) === "ECONNREFUSED") {
        message = `Connection failed: ${message} ${secureProfileHint}`
      }
      this.setLastError(message)
    })

    client.on("close", () => {
      this.logger.debug(`MQTT connection to ${this.clientRemoteAddress} closed`)

      // mqtt.js swallows stream errors without a code, so plaintext against a TLS-only port only
      // shows up as a close loop, give the user a hint
      if (!this.hasConnected && !this.isVrm && !this.device.secure) {
        const stats = this.statistics
        if (stats && stats.lastError === undefined) {
          this.setLastError(`Connection failed: closed before connecting ${secureProfileHint}`)
        }
      }

      this.stopKeepAlive()
    })

    client.on("offline", () => {
      this.logger.debug(`MQTT connection to ${this.clientRemoteAddress} offline`)

      // update stats
      const stats = this.statistics
      if (stats && this.device.portalId) {
        stats.isReceivingData = false
      }
    })

    client.on("end", () => {
      this.logger.info(`MQTT connection to ${this.clientRemoteAddress} ended`)
    })

    client.on("reconnect", () => {
      this.logger.debug(`MQTT reconnecting to ${this.clientRemoteAddress}`)
    })
  }

  private onMessage(topic: string, message: Buffer, packet: IPublishPacket) {
    // this.logger.debug(`${topic}: ${message}`)

    // mqtt.js still delivers already parsed packets after end()
    if (this.isStopped) {
      return
    }

    if (message === undefined || message == null || message.length === 0) {
      return
    }

    if (packet.dup) {
      this.logger.debug(`Skipping duplicate ${topic}`)
      return
    }

    const { portalId: id, instanceNumber, measurement } = parseVenusTopic(topic)

    if (ignoredMeasurements.find((path) => measurement.startsWith(path))) {
      return
    }

    try {
      const json = JSON.parse(message.toString("utf-8"))

      //this.logger.debug(`${id} ${instanceNumber} ${measurement} ${json.value}`)

      // detect portalId for manual connections
      if (this.isDetectingPortalId && measurement === "system/Serial") {
        this.logger.info("Detected portalId %s", json.value)
        this.device.portalId = json.value
        this.subscribeAndRequestRepublish()
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
    if (isFirstKeepAliveRequest) {
      this.logger.info(`sendKeepAlive: isFirstKeepAliveRequest: ${isFirstKeepAliveRequest}`)
    } else {
      this.logger.debug(`sendKeepAlive: isFirstKeepAliveRequest: ${isFirstKeepAliveRequest}`)
    }
    this.client?.publish(
      `R/${this.device.portalId}/system/0/Serial`,
      isFirstKeepAliveRequest ? "" : '{ "keepalive-options" : ["suppress-republish"] }',
      { qos: 1 },
      (error) => {
        const portalStats = this.statistics
        if (portalStats === undefined) return
        if (error) {
          this.logger.error(`sendKeepAlive: ${describeMqttError(error)}. Ensure the system is assigned to your team.`)
          portalStats.hasReceivedKeepAliveConfirmation = false
        } else {
          portalStats.hasReceivedKeepAliveConfirmation = true
        }
      },
    )
  }

  private subscribeAndRequestRepublish() {
    const portalId = this.device.portalId!!
    // dbus-flashmq only supports publishing at QoS 0
    this.client?.subscribe(`N/${portalId}/settings/0/Settings/SystemSetup/SystemName`, { qos: 0 })
    for (const topic of this.device.subscriptions) {
      const x = `N/${portalId}${topic}`
      this.logger.info(`Subscribing to '${x}'`)
      // dbus-flashmq only supports publishing at QoS 0
      this.client?.subscribe(x, { qos: 0 })
    }
    this.client?.publish(`R/${portalId}/settings/0/Settings/SystemSetup/SystemName`, "", { qos: 1 })
    // first keepalive carries empty payload, asking the broker for full republish
    this.keepAlive()
    this.isDetectingPortalId = false
  }

  private keepAlive() {
    if (this.device.portalId) {
      this.sendKeepAlive(this.isFirstKeepAliveRequest)
      this.isFirstKeepAliveRequest = false
    }
  }

  get clientRemoteAddress() {
    return `${this.client?.options?.host}:${this.client?.options?.port}`
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
      isReceivingData: false,
      hasReceivedKeepAliveConfirmation: false,
      secure: this.device.secure,
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

    const portalStats = this.statistics
    if (portalStats === undefined) return
    portalStats.isReceivingData = true
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
        this.client?.unsubscribe(x)
      }
      for (const topic of toSubscribe) {
        const x = `N/${this.device.portalId}${topic}`
        this.logger.info(`Subscribing to '${x}'`)
        // dbus-flashmq only supports publishing at QoS 0
        this.client?.subscribe(x, { qos: 0 })
      }
    }
  }

  updateExpiry(expiry?: number) {
    if (this.expiry === expiry) {
      return
    }
    this.expiry = expiry
    this.logger.info(`updateExpiry, will stop ${this.formatExpiry(this.expiry)}`)
    const stats = this.statistics
    if (stats) stats.expiry = this.expiry
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

export function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((item) => !arr2.includes(item))
}
