const Influx = require('influx')
const _ = require('lodash')
const debug = require('debug')('venus-server:influxdb')

class InfluxDB {
  constructor(app) {
    this.app = app
    this.logger = app.getLogger('influxdb')
    this.debug = this.logger.debug.bind(this.logger)
    this.info = this.logger.info.bind(this.logger)
    this.warn = this.logger.warn.bind(this.logger)
    this.error = this.logger.error.bind(this.logger)
    this.connected = false

    this.accumulatedPoints = []
    this.lastWriteTime = Date.now()
    this.batchWriteInterval =
    (_.isUndefined(this.app.config.settings.influxdb.batchWriteInterval)
    ? 10
    : this.app.config.settings.influxdb.batchWriteInterval) * 1000

    app.on('settingsChanged', (settings) => {
      this.batchWriteInterval =
      (_.isUndefined(this.app.config.settings.influxdb.batchWriteInterval)
      ? 10
      : this.app.config.settings.influxdb.batchWriteInterval) * 1000

      if (!this.connected) {
        return
      }

      const {
        host, port, database, retention, username, password
      } = settings.influxdb

      if (this.host !== host || this.port !== port || this.database !== database || this.username !== username || this.password !== password) {
        this.start()
      } else if (!_.isUndefined(this.retention) && retention !== this.retention) {
          this._setRetentionPolicy(retention)
      }
    })
  }

  async start() {
    this.connected = false
    try {
      await this._connect()
    } catch (error) {
      setTimeout(async () => { this.start() }, 5000)
    }
  }

  async _connect() {
    const {
      host, port, database, retention, username, password
    } = this.app.config.settings.influxdb

    this.host = host
    this.port = port
    this.database = database
    this.username = username !== '' ? username : 'root'
    this.password = password !== '' ? password : 'root'

    this.influxClient = new Influx.InfluxDB({
      host: host,
      port: port,
      protocol: 'http',
      database: database,
      username: username,
      password: password
    })

    this.info(`Attempting connection to ${host}:${port}/${database} using ${this.username}:*****`)

    try {
      let databaseNames = await this.influxClient.getDatabaseNames()
      this.info(`Connected to ${host}:${port}/${database}`)
      if (!databaseNames.includes(database)) {
        this.info(`Creating database: ${database}`)
        await this.influxClient.createDatabase(database)
      }
      this.connected = true
      await this._setRetentionPolicy(retention)
    } catch (error) {
      this.error(`Unable to connect: ${error}`)
      throw error
    }
  }

  async _setRetentionPolicy(retention) {
    if (this.connected === false || _.isUndefined(retention) || retention === null) {
      return
    }

    const opts = {
      duration: retention,
      replication: 1,
      isDefault: true
    }

    this.info(`Setting retention policy: ${retention}`)

    try {
      await this.influxClient.createRetentionPolicy('venus_default', opts)
      this.logger.debug(`Retention policy set: ${retention}`)
      this.retention = retention
    } catch (error) {
      try {
        await this.influxClient.alterRetentionPolicy('venus_default', opts)
        this.logger.debug(`Retention policy set: ${retention}`)
        this.retention = retention
      } catch (error) {
        this.logger.error(`Error setting retention policy: ${retention}, ${error}`)
      }
    }
  }

  async store(portalId, name, instanceNumber, measurement, value) {
    if (this.connected === false || _.isUndefined(value) || value === null) {
      return
    }

    let valueKey = 'value'
    if (typeof value === 'string') {
      if (value.length === 0) {
        //influxdb won't allow empty strings
        return
      }
      valueKey = 'stringValue'
    } else if (typeof value !== 'number') {
      return
    }

    const point = {
      timestamp: new Date(),
      measurement: measurement,
      tags: {
        portalId: portalId,
        instanceNumber: instanceNumber,
        name: name || portalId
      },
      fields: {
        [valueKey]: value
      }
    }

    this.accumulatedPoints.push(point)
    const now = Date.now()

    if (this.batchWriteInterval === 0 || now - this.lastWriteTime > this.batchWriteInterval) {
      this.lastWriteTime = now

      try {
        await this.influxClient.writePoints(this.accumulatedPoints)
        this.accumulatedPoints = []
      } catch (error) {
        this.accumulatedPoints = []
        this.debug(error)
        this.start()
        throw error
      }
    }
  }
}

module.exports = InfluxDB
