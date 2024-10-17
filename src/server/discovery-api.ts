import express from "express"
import { Server } from "./server"

// TODO: add TS API request/response interfaces
// TODO: refactor out hardcoded API endpoints
export default function (server: Server) {
  const router = express.Router()

  router.post("/log", (req, res, _next) => {
    server.upnp.logger.log(req.body.level, req.body.message)
    res.send()
  })

  router.post("/upnpDiscovered", (req, res, _next) => {
    server.emit("upnpDiscovered", req.body)
    res.send()
  })

  return router
}
