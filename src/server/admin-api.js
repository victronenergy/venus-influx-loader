const router = require('express').Router()
const fs = require('node:fs')
const _ = require('lodash')

module.exports = function (app) {
  router.get('/config', (req, res, next) => {
    fs.readFile(app.config.configLocation, (err, contents) => {
      if (err) {
        app.logger.error(err)
        res.status(500).send('Unable to read config file')
      } else {
        const config = JSON.parse(contents)
        if (_.isUndefined(config.upnp.enabledPortalIds)) {
          config.upnp.enabledPortalIds = []
        }
        if (_.isUndefined(config.vrm.enabledPortalIds)) {
          config.vrm.enabledPortalIds = []
        }
        config.vrm.hasToken = !_.isUndefined(app.config.secrets.vrmToken)
        res.json(config)
      }
    })
  })

  router.put('/config', (req, res, next) => {
    fs.writeFile(
      app.config.configLocation,
      JSON.stringify(req.body, null, 2),
      err => {
        if (err) {
          app.logger.error(err)
          res.status(500).send('Unable to write config file')
        } else {
          res.status(200).send('Configuration Saved')
          app.config.settings = req.body
          app.emit('settingsChanged', app.config.settings)
          delete req.body.vrm.hasToken
        }
      }
    )
  })

  router.post('/security', (req, res, next) => {
    if (
      req.body.username &&
      req.body.username.length > 0 &&
      req.body.password &&
      req.body.password.length > 0
    ) {
      app.config.secrets.login = req.body
      fs.writeFile(
        app.config.secretsLocation,
        JSON.stringify(app.config.secrets, null, 2),
        err => {
          if (err) {
            app.logger.error(err)
            res.status(500).send('Unable to write secrets file')
          } else {
            res.send()
          }
        }
      )
    } else {
      res.status(400).send('Please enter a Username and Password')
    }
  })

  router.get('/log', (req, res, next) => {
    res.json({ entries: app.logTransport.entries })
  })

  router.get('/debug', (req, res, next) => {
    const value = app.rootLogger.level === 'debug' ? true : false
    res.send(value)
  })

  router.put('/debug', (req, res, next) => {
    app.rootLogger.level = req.body.value ? 'debug' : 'info'
    app.logger[app.rootLogger.level](
      'Log level changed to: ' + app.rootLogger.level
    )
    app.emit('serverevent', {
      type: 'DEBUG',
      data: req.body.value
    })
    res.send(req.body.value)
  })

  return router
}
