const router = require('express').Router()

module.exports = function (app) {
  router.post('/log', (req, res, _next) => {
    app.upnpLogger[req.body.level](req.body.message)
    res.send()
  })

  router.post('/upnpDiscovered', (req, res, _next) => {
    app.emit('upnpDiscovered', req.body)
    res.send()
  })

  return router
}
