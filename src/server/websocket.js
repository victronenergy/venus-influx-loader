const Primus = require('primus')

module.exports = function (app) {
  const logger = app.getLogger('websockets')
  const debug = logger.debug.bind(logger)
  const api = {}
  let primus

  api.start = function () {
    debug('Starting Primus/WS interface')

    const primusOptions = {
      transformer: 'websockets',
      pingInterval: false,
      pathname: '/stream',
    }

    primus = new Primus(app.server, primusOptions)
    primus.on('connection', function (spark) {
      debug(`${spark.id} connected`)

      spark.on('end', function () {})

      spark.onDisconnects = []

      const onServerEvent = (event) => {
        spark.write(event)
      }
      app.on('serverevent', onServerEvent)
      spark.onDisconnects.push(() => {
        app.removeListener('serverevent', onServerEvent)
      })
      Object.keys(app.lastServerEvents).forEach((propName) => {
        if (propName !== 'LOG') {
          spark.write(app.lastServerEvents[propName])
        }
      })
      app.logTransport.entries.forEach((log) => {
        spark.write({
          type: 'LOG',
          data: log,
        })
      })
    })

    primus.on('disconnection', function (spark) {
      spark.onDisconnects.forEach((f) => f())
      debug(spark.id + ' disconnected')
    })
  }

  api.stop = function () {
    debug('Destroying primus...')
    primus.destroy({
      close: false,
      timeout: 500,
    })
  }

  return api
}
