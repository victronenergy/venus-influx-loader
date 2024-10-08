const _ = require("lodash")
const mqtt = require("mqtt")
const ignoredMeasurements = require("./ignoredMeasurements")
const buildVersion = require("../../dist/buildInfo").buildVersion

const collectStatsInterval = 5
const keepAliveInterval = 30

function Loader(app) {
  this.app = app
  this.upnpConnections = {}
  this.manualConnections = {}
  this.vrmConnections = {}

  this.deviceStats = {}
  this.deviceMeasurements = {}
  this.totalCount = 0
  this.lastIntervalCount = 0
  this.vrmSubscriptions = []

  this.logger = app.getLogger("loader")
}

Loader.prototype.start = function () {
  this.logger.debug("starting...")
  this.app.emit("serverevent", {
    type: "SERVERSTATISTICS",
  })

  this.app.on("upnpDiscovered", (info) => {
    const upnp = this.app.config.settings.upnp
    if (
      !this.upnpConnections[info.portalId] &&
      upnp.enabledPortalIds.indexOf(info.portalId) !== -1
    ) {
      this.connectUPNP(info)
    }
  })

  this.app.on("vrmDiscovered", (devices) => {
    if (this.app.config.settings.vrm.enabled) {
      this.connectVRM(devices)
    }
  })

  this.app.on("settingsChanged", this.settingsChanged.bind(this))

  this.collectInterval = setInterval(
    this.collectStats.bind(this),
    collectStatsInterval * 1000,
  )
}

Loader.prototype.getPortalName = function (client, id) {
  if (client.deviceName) {
    return client.deviceName
  }
  if (this.app.config.settings.upnp.enabled) {
    const info = this.app.upnpDiscovered[id]
    if (info && info.name) {
      return info.name
    }
  }
  if (this.app.config.settings.vrm.enabled) {
    const info = this.app.vrmDiscovered.find((info) => info.portalId === id)
    if (info && info.name) {
      return info.name
    }
  }
}

Loader.prototype.sendKeepAlive = function (
  client,
  portalId,
  isFirstKeepAliveRequest,
) {
  this.logger.debug(
    `sending keep alive for ${portalId}, isFirstKeepAliveRequest: ${isFirstKeepAliveRequest} [${client.venusKeepAlive}]`,
  )
  client.publish(
    `R/${portalId}/system/0/Serial`,
    isFirstKeepAliveRequest
      ? ""
      : '{ "keepalive-options" : ["suppress-republish"] }',
  )
}

Loader.prototype.keepAlive = function (client) {
  if (client.portalId) {
    this.sendKeepAlive(client, client.portalId, client.isFirstKeepAliveRequest)
    client.isFirstKeepAliveRequest = false
  }
}

Loader.prototype.onMessage = function (client, topic, message) {
  //console.log(`${topic} : ${message}`)

  if (_.isUndefined(message) || message == null || message.length === 0) {
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
    const json = JSON.parse(message)

    //console.log(`${id} ${instanceNumber} ${measurement} ${json.value}`)

    if (client.venusNeedsID && measurement === "system/Serial") {
      this.logger.info("Detected portalId %s", json.value)
      client.subscribe(
        `N/${json.value}/settings/0/Settings/SystemSetup/SystemName`,
      )
      client.subscribe(`N/${json.value}/#`)
      client.publish(
        `R/${json.value}/settings/0/Settings/SystemSetup/SystemName`,
      )
      client.publish(`R/${json.value}/system/0/Serial`)
      client.venusNeedsID = false
      client.portalId = json.value
      return
    }

    const name = this.getPortalName(client, id)

    let portalStats
    let measurements
    this.totalCount++
    if (this.deviceStats[id]) {
      portalStats = this.deviceStats[id]
      measurements = this.deviceMeasurements[id]
    } else {
      portalStats = {
        measurementCount: 0,
        measurementRate: 0,
        lastIntervalCount: 0,
        name: name || id,
      }
      this.deviceStats[id] = portalStats
      measurements = []
      this.deviceMeasurements[id] = measurements
    }

    portalStats.lastMeasurement = new Date()
    portalStats.measurementCount++

    if (measurements.indexOf(measurement) === -1) {
      this.logger.debug("got measurement %s = %j", measurement, json.value)
      measurements.push(measurement)
    }

    if (!name && !client.isVrm) {
      if (measurement === "settings/Settings/SystemSetup/SystemName") {
        if (json.value.length === 0) {
          client.deviceName = id
        } else {
          this.logger.info("Detected name %s : %j", id, json.value)
          client.deviceName = json.value
          portalStats.name = client.deviceName
        }
      }
      return
    }

    this.app.influxdb.store(id, name, instanceNumber, measurement, json.value)
  } catch (e) {
    this.logger.error(`can't record ${topic}: ${message}`)
    this.logger.error(e)
  }
}

Loader.prototype.close = function (connectionInfo) {
  this.logger.info(
    "closing connection to %s",
    connectionInfo.client.portalId || connectionInfo.address,
  )
  connectionInfo.client.end(true)
}

Loader.prototype.settingsChanged = function (settings) {
  //close existing connections if upnp disabled or a device is disabled
  _.keys(this.upnpConnections).forEach((id) => {
    if (
      !settings.upnp.enabled ||
      settings.upnp.enabledPortalIds.indexOf(id) === -1
    ) {
      this.close(this.upnpConnections[id])
      delete this.upnpConnections[id]
    }
  })

  // open connections for upnp devices that were previously disabled
  if (settings.upnp.enabled) {
    _.keys(this.app.upnpDiscovered).forEach((id) => {
      if (
        !this.upnpConnections[id] &&
        settings.upnp.enabledPortalIds.indexOf(id) !== -1
      ) {
        this.connectUPNP(this.app.upnpDiscovered[id])
      }
    })
  }

  if (_.keys(this.vrmConnections).length > 0) {
    _.values(this.vrmConnections).forEach((info) => {
      this.logger.info(`closing vrm connection for ${info.portalId}`)
      info.client.end(true)
    })
    this.vrmConnections = {}
    this.app.emit("vrmStatus", {
      status: "success",
      message: "Connections Closed",
    })
  }
  if (settings.vrm.enabled) {
    this.connectVRM(this.app.vrmDiscovered)
  }

  if (settings.manual.enabled) {
    settings.manual.hosts.forEach((host) => {
      if (host.enabled) {
        if (!this.manualConnections[host.hostName]) {
          this.connectManual({ address: host.hostName })
        }
      } else if (this.manualConnections[host.hostName]) {
        this.close(this.manualConnections[host.hostName])
        delete this.manualConnections[host.hostName]
      }
    })
    _.keys(this.manualConnections).forEach((ip) => {
      if (!settings.manual.hosts.find((host) => host.hostName === ip)) {
        this.close(this.manualConnections[ip])
        delete this.manualConnections[ip]
      }
    })
  } else {
    _.keys(this.manualConnections).forEach((ip) => {
      this.close(this.manualConnections[ip])
    })
    this.manualConnections = {}
  }
}

// for UPNP info contains IP `address` and `portalId`
Loader.prototype.connectUPNP = function (info) {
  this.upnpConnections[info.portalId] = {
    name: info.name,
    address: info.address,
  }

  this.connect(info.address, 1883, info)
    .then((client) => {
      this.upnpConnections[info.portalId].client = client
    })
    .catch((err) => {
      this.logger.error(err)
    })
}

// for Manual info contains IP `address`
Loader.prototype.connectManual = function (info) {
  this.manualConnections[info.address] = {
    name: info.name,
    address: info.address,
  }

  this.connect(info.address, 1883, info)
    .then((client) => {
      this.manualConnections[info.address].client = client
    })
    .catch((err) => {
      this.logger.error(err)
    })
}

function calculateVRMBrokerURL(portalId) {
  let sum = 0
  const lowered = portalId.toLowerCase()
  for (let i = 0; i < lowered.length; i++) {
    sum = sum + lowered.charCodeAt(i)
  }
  return `mqtt${sum % 128}.victronenergy.com`
}

// for VRM portalInfos contains an array of objects with `portalId` and `name`
// belonging to the VRM account
Loader.prototype.connectVRM = function (portalInfos) {
  if (this.app.config.secrets.vrmToken) {
    const enabled = portalInfos.filter((info) => {
      return (
        this.app.config.settings.vrm.enabledPortalIds.indexOf(info.portalId) !==
        -1
      )
    })

    enabled.forEach((info) => {
      const port = 8883
      const address = calculateVRMBrokerURL(info.portalId)

      if (!this.vrmConnections[info.portalId]) {
        this.vrmConnections[info.portalId] = {
          address: address,
          portalId: info.portalId,
        }

        this.connect(address, port, info, true)
          .then((client) => {
            this.vrmConnections[info.portalId].client = client
          })
          .catch((err) => {
            delete this.vrmConnections[info.portalId]
            this.logger.error(err)
          })
      }
    })
  }
}

function formatClientRemoteAddress(client) {
  return `${client.options?.host}:${client.options?.port}`
}

Loader.prototype.setupClient = function (client, info, isVrm) {
  client.on("connect", () => {
    this.logger.info(`MQTT connected to ${formatClientRemoteAddress(client)}`)
    if (info.portalId === undefined) {
      // we do not know the portalId yet (manual connection)
      this.logger.info("Detecting portalId...")
      client.subscribe("N/+/#")
      client.venusNeedsID = true
    } else {
      // we do know the portalId already (vrm + upnp connection)
      this.logger.info("Subscribing to portalId %s", info.portalId)
      client.subscribe(
        `N/${info.portalId}/settings/0/Settings/SystemSetup/SystemName`,
      )
      client.subscribe(`N/${info.portalId}/#`)
      client.publish(
        `R/${info.portalId}/settings/0/Settings/SystemSetup/SystemName`,
      )
      client.publish(`R/${info.portalId}/system/0/Serial`)
      client.portalId = info.portalId
      client.venusNeedsID = false
    }
    if (!client.venusKeepAlive) {
      client.isFirstKeepAliveRequest = true
      client.venusKeepAlive = setInterval(
        this.keepAlive.bind(this, client),
        keepAliveInterval * 1000,
      )
      this.logger.debug(
        `starting keep alive timer for ${client.portalId} [${client.venusKeepAlive}]`,
      )
    }
  })

  client.on("message", (topic, message) =>
    this.onMessage(client, topic, message),
  )

  client.on("error", (error) => {
    this.logger.error(
      `MQTT connection to ${formatClientRemoteAddress(client)}, ${error}`,
    )
  })

  client.on("close", () => {
    this.logger.debug(
      `MQTT connection to ${formatClientRemoteAddress(client)} closed`,
    )

    if (client.venusKeepAlive) {
      this.logger.debug(
        `clearing keep alive timer for ${client.portalId} [${client.venusKeepAlive}]`,
      )
      clearInterval(client.venusKeepAlive)
      delete client.venusKeepAlive
    }

    if (isVrm) {
      delete this.vrmConnections[client.portalId]
    }
  })
  client.on("offline", () => {
    this.logger.debug(
      `MQTT connection to ${formatClientRemoteAddress(client)} offline`,
    )
  })
  client.on("end", () => {
    this.logger.info(
      `MQTT connection to ${formatClientRemoteAddress(client)} ended`,
    )
  })
  client.on("reconnect", () => {
    this.logger.debug(
      `MQTT reconnecting to ${formatClientRemoteAddress(client)}`,
    )
  })
}

Loader.prototype.connect = function (address, port, info, isVrm = false) {
  return new Promise((resolve, _reject) => {
    const clientId = Math.random().toString(16).slice(3)
    let options
    if (isVrm) {
      options = {
        rejectUnauthorized: false,
        username: `${this.app.config.secrets.vrmUsername}`,
        password: `Token ${this.app.config.secrets.vrmToken}`,
        // use random clientId + vrmTokenId to identify this loader instance
        clientId: `venus_influx_loader_${buildVersion}_${clientId}_${this.app.config.secrets.vrmTokenId}`,
        reconnectPeriod: 10_000,
      }
    } else {
      options = {
        // use random clientId to identify this loader instance
        clientId: `venus_influx_loader_${buildVersion}_${clientId}`,
        reconnectPeriod: 10_000,
      }
    }
    this.logger.info(
      `MQTT connecting to ${address}:${port} using clientId: ${options.clientId}`,
    )
    const client = mqtt.connect(
      `${isVrm ? "mqtts" : "mqtt"}:${address}:${port}`,
      options,
    )
    this.setupClient(client, info, isVrm)
    resolve(client)
  })
}

Loader.prototype.collectStats = function () {
  //this.logger.debug('collecting stats...')

  let measurementCount = 0
  _.keys(this.deviceStats).forEach((id) => {
    const stats = this.deviceStats[id]
    stats.measurementRate =
      (stats.measurementCount - stats.lastIntervalCount) / collectStatsInterval
    stats.lastIntervalCount = stats.measurementCount
    measurementCount += this.deviceMeasurements[id].length
  })

  const stats = {
    measurementRate:
      (this.totalCount - this.lastIntervalCount) / collectStatsInterval,
    measurementCount: measurementCount,
    deviceStatistics: this.deviceStats,
  }

  this.lastIntervalCount = this.totalCount

  this.app.lastStats = stats

  this.app.emit("serverevent", {
    type: "SERVERSTATISTICS",
    data: stats,
  })
}

module.exports = Loader
