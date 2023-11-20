const express = require('express')
const path = require('node:path')
const http = require('node:http')
const _ = require('lodash')
const fs = require('node:fs/promises')
const createRootLogger = require('./logger')
const Loader = require('./loader')
const InfluxDB = require('./influxdb')
const bodyParser = require('body-parser')
const compare = require('tsscmp')
const auth = require('basic-auth')

const defaultInfluxDBURL = new URL(process.env.VIL_INFLUXDB_URL || 'http://influxdb:8086')
const defaultInfluxDBUsername = process.env.VIL_INFLUXDB_USERNAME || ''
const defaultInfluxDBPassword = process.env.VIL_INFLUXDB_PASSWORD || ''
const defaultInfluxDBDatabase = 'venus'
const defaultInfluxDBRetention = '30d'

const defaultAdminUsername = 'admin'
const defaultAdminPassword = 'admin'

const logMessages = []

async function loadSecrets (app) {
  try {
    const contents = await fs.readFile(app.config.secretsLocation)
    app.config.secrets = JSON.parse(contents)
  } catch (err) {
    app.config.secrets = {}
  }
}

async function loadConfig (app) {
  try {
    const contents = await fs.readFile(app.config.configLocation)
    app.config.settings = JSON.parse(contents)
  } catch (error) {
    app.config.settings = {
      upnp: {
        enabled: false,
        enabledPortalIds: []
      },
      vrm: {
        enabled: false,
        enabledPortalIds: []
      },
      manual: {
        enabled: false,
        hosts: []
      },
      influxdb: {
        host: defaultInfluxDBURL.hostname,
        port: defaultInfluxDBURL.port,
        username: defaultInfluxDBUsername,
        password: defaultInfluxDBPassword,
        database: defaultInfluxDBDatabase,
        retention: defaultInfluxDBRetention
      }
    }

    try {
      await fs.writeFile(app.config.configLocation, JSON.stringify(app.config.settings, null, 2))
    } catch (error) {
    }
  }
}

async function saveConfig (app, cb) {
  try {
    await fs.writeFile(app.config.configLocation, JSON.stringify(app.config.settings, null, 2))
  } catch (error) {
    app.logger.error(err)
    if (cb) {
      cb(err)
    }
  }
}

class Server {
  constructor(options) {
    const app = express()
    this.app = app

    app.config = {
      configLocation: path.join(options.configPath, 'config.json'),
      secretsLocation: path.join(options.configPath, 'secrets.json')
    }

    app.saveSettings = cb => {
      saveConfig(app, cb)
    }

    app.options = options
    app.started = false
  }

  async start() {
    const self = this
    const app = this.app

    await loadSecrets(app)
    await loadConfig(app)

    createRootLogger(app, 'venus-influx-loader', 'info')
    if (app.config.settings.debug) {
      app.rootLogger.level = 'debug'
    }

    app.debug('Settings %j', app.config.settings)

    // TODO: clean this event handling up
    app.lastServerEvents = {}
    app.on('serverevent', event => {
      if (event.type) {
        app.lastServerEvents[event.type] = event
      }
    })

    // TODO: clean upnp event handling up
    app.upnpDiscovered = {}

    app.on('upnpDiscoveryDidStart', info => {
      app.upnpDiscovered = {}
      app.emit('serverevent', {
        type: 'UPNPDISCOVERY',
        data: []
      })
    })

    app.on('upnpDiscoveryDidStop', info => {
      app.upnpDiscovered = {}
      app.emit('serverevent', {
        type: 'UPNPDISCOVERY',
        data: []
      })
    })

    app.on('upnpDiscovered', info => {
      if (_.isUndefined(app.upnpDiscovered[info.portalId])) {
        app.upnpDiscovered[info.portalId] = info
        app.info('Found new UPNP device %j', info)

        app.emit('serverevent', {
          type: 'UPNPDISCOVERY',
          data: _.keys(app.upnpDiscovered)
        })
      }
    })

    // TODO: clean vrm event handling up
    app.vrmDiscovered = []

    app.emit('serverevent', {
      type: 'VRMDISCOVERY',
      data: []
    })

    app.on('vrmDiscovered', devices => {
      app.vrmDiscovered = devices
      app.emit('vrmDiscoveredChanged', app.vrmDiscovered)
      app.debug('Found vrm devices %j', devices)

      app.emit('serverevent', {
        type: 'VRMDISCOVERY',
        data: devices
      })
    })

    app.emit('serverevent', {
      type: 'DEBUG',
      data: app.logger.level === 'debug'
    })

    app.on('vrmStatus', status => {
      app.emit('serverevent', {
        type: 'VRMSTATUS',
        data: status
      })
    })

    app.upnp = require('./upnp')(this.app)
    app.upnpLogger = app.upnp.logger

    app.vrm = require('./vrm')(this.app)
    app.loader = new Loader(app)
    app.influxdb = new InfluxDB(app)

    app.influxdb.start()
    app.loader.start()
    app.emit('settingsChanged', app.config.settings)

    // TODO: this is called from many places, clean up and clarify
    function settingsChanged(settings) {
      if (settings.upnp.enabled && app.upnp.isRunning() === false) {
        if (!app.options.discoveryApiEndpoint) {
          app.upnp.start()
        }
      }
      if (!settings.upnp.enabled && app.upnp.isRunning()) {
        if (!app.options.discoveryApiEndpoint) {
          app.upnp.stop()
        }
      }

      if (settings.vrm.enabled && _.keys(app.vrmDiscovered).length === 0) {
        /*
        app.vrmDiscovered = []
        app.emit('serverevent', {
          type: 'VRMDISCOVERY',
          data: []
        })
        */
        app.vrm.loadPortalIDs()
      }
      if (!settings.vrm.enabled && _.keys(app.vrmDiscovered).length > 0) {
        /*
        app.vrmDiscovered = []
        app.emit('serverevent', {
          type: 'VRMDISCOVERY',
          data: []
        })
        */
      }

      app.emit('serverevent', {
        type: 'SETTINGSCHANGED',
        data: settings
      })
    }

    app.on('settingsChanged', settingsChanged)
    app.emit('settingsChanged', app.config.settings)

    return new Promise((resolve, reject) => {
      app.server = http.createServer(app)

      app.use(bodyParser.json())

      // basic auth
      const adminCredentials = (req, res, next) => {
        const credentials = auth(req)
        let login = app.config.secrets.login
        if (!login) {
          login = {
            username: defaultAdminUsername,
            password: defaultAdminPassword
          }
        }

        if (!credentials || compare(credentials.name, login.username) === false || compare(credentials.pass, login.password) === false) {
          res.statusCode = 401
          res.setHeader('WWW-Authenticate', 'Basic realm="example"')
          res.status(401).send()
        } else {
          next()
        }
      }

      // setup /admin-api routes and authentication, if enabled
      if (app.options.adminApiEndpoint) {
        app.logger.info(`setting up ${app.options.adminApiEndpoint} routes`)

        app.use('/admin', adminCredentials)
        app.use('/admin', express.static(path.join(__dirname, '../../dist')))
        app.get('/', (req, res) => {
          res.redirect('/admin')
        })

        app.use(app.options.adminApiEndpoint, adminCredentials)
        app.use(app.options.adminApiEndpoint, require('./admin-api')(app))

        app.websocket = require('./websocket')(app)
        app.websocket.start()
      }

      // setup /discovery-api routes, if enabled
      if (app.options.discoveryApiEndpoint) {
        app.logger.info(`setting up ${app.options.discoveryApiEndpoint} routes`)
        app.use(app.options.discoveryApiEndpoint, require('./discovery-api')(app))
      }

      // setup /grafana-api routes, if enabled
      if (app.options.grafanaApiEndpoint) {
        app.logger.info(`setting up ${app.options.grafanaApiEndpoint} routes`)
        app.use(app.options.grafanaApiEndpoint, require('./grafana-api')(app))
      }

      // listen
      const primaryPort = app.options.port
      app.server.listen(primaryPort, function (err) {
        app.logger.info(`running at 0.0.0.0:${primaryPort}`)
        app.started = true
        resolve(self)
      })
    })
  }

  async stop(cb) {
    if (!this.app.started) {
        return
    }
    this.app.debug('Closing server...')
    await this.app.server.close()
    this.app.debug('Server closed')
    this.app.started = false
    cb && cb()
  }
}

module.exports = Server
