import Primus from "primus"
import { Server, ServerEvents } from "./server.js"
import { Logger } from "winston"

export class WebSocketChannel {
  server: Server
  logger: Logger
  private primus!: Primus

  constructor(server: Server) {
    this.server = server
    this.logger = server.getLogger("ws")
  }

  start() {
    this.logger.debug("Starting Primus/WS interface...")

    this.primus = new Primus(this.server.httpServer, {
      transformer: "websockets",
      pingInterval: 0, // disables heartbeats, primus treats any falsy value as off
      pathname: "/stream",
    })

    this.primus.on("connection", (spark) => {
      this.logger.debug(`${spark.id} connected`)

      // forward live loader events to this client until it disconnects
      const onServerEvent = (event: ServerEvents["loaderevent"]) => {
        spark.write(event)
      }
      this.server.on("loaderevent", onServerEvent)
      spark.on("end", () => {
        this.logger.debug(`${spark.id} disconnected`)
        this.server.removeListener("loaderevent", onServerEvent)
      })

      // replay the current loader state and recent log entries to the new client
      Object.entries(this.server.loaderState).forEach(([type, event]) => {
        if (type !== "LOG") {
          spark.write(event)
        }
      })
      this.server.logEntries.forEach((entry) => {
        spark.write({
          type: "LOG",
          data: entry,
        })
      })
    })
  }

  stop() {
    this.logger.debug("Stopping Primus/WS interface...")
    this.primus.destroy(
      {
        close: false,
        timeout: 500,
        reconnect: false,
      },
      () => {
        this.logger.debug("Primus/WS interface stopped.")
      },
    )
  }
}
