const router = require("express").Router()
const _ = require("lodash")

module.exports = function (app) {
  router.get("/", (_req, res, _next) => {
    res.send("ok")
  })

  router.post("search", (_req, res, _next) => {
    res.json(["portals"])
  })

  router.post("/query", (req, res, _next) => {
    const request = req.body

    if (app.lastStats && request.targets) {
      if (request.targets.length > 0 && request.targets[0].type === "table") {
        if (request.targets[0].target === "portals") {
          const json = {
            columns: [
              { text: "Name", type: "string" },
              { text: "Last Measurement", type: "string" },
            ],
            type: "table",
          }

          json.rows = _.values(app.lastStats.deviceStatistics).map((stats) => {
            return [stats.name, stats.lastMeasurement.toString()]
          })
          res.json([json])
          return
        }
      }
    }
    res.json([])
  })

  return router
}
