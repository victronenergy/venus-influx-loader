import Primus from "primus"
import { Server } from "./server"
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

    const primusOptions = {
      transformer: "websockets",
      pingInterval: false,
      pathname: "/stream",
    }

    // @ts-ignore
    this.primus = new Primus(this.server.httpServer, primusOptions)
    this.primus.on("connection", (spark) => {
      this.logger.debug(`${spark.id} connected`)

      spark.on("end", function () {})

      // @ts-ignore
      spark.onDisconnects = []

      const onServerEvent = (event: any) => {
        spark.write(event)
      }

      this.server.on("loaderevent", onServerEvent)

      // @ts-ignore
      spark.onDisconnects.push(() => {
        this.server.removeListener("loaderevent", onServerEvent)
      })

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

    this.primus.on("disconnection", (spark) => {
      this.logger.debug(`${spark.id} disconnected`)

      // @ts-ignore
      spark.onDisconnects.forEach((f: () => void) => f())
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
