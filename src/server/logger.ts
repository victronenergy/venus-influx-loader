import winston from "winston"
import Transport from "winston-transport"
import { Server } from "./server"
import { LogEntry, LogLevel } from "../shared/types"

// custom log storage transport
// that keeps last 100 messages
// and emits them live over ws /stream connection
// from venus-influx-loader to react.js client
export class LogStorageTransport extends Transport {
  server: Server
  entries: LogEntry[] = []
  size: number

  constructor(server: Server, opts: any) {
    super(opts)
    this.server = server
    this.entries = []
    this.size = opts.size || 100
  }

  log(entry: LogEntry, callback: () => void) {
    this.entries.push(entry)

    if (this.entries.length > this.size) {
      this.entries.splice(0, this.entries.length - this.size)
    }

    this.server.emit("loaderevent", {
      type: "LOG",
      data: entry,
    })

    callback()
  }
}

// setup root logger with given label and log level
// and provide couple useful helpers like
//
// app.info
// app.debug
// app.getLogger
//
export function createRootLogger(server: Server, level: LogLevel) {
  const format = winston.format.printf((info) => {
    return `[${info.level}] [${info.label}] ${info.message} ${info.stack || ""}`
  })

  const logTransport = new LogStorageTransport(server, {
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.timestamp(),
      winston.format.json(),
    ),
    handleExceptions: true,
  })

  const rootLogger = winston.createLogger({
    level: level,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.splat(), format),
        handleExceptions: true,
      }),
      logTransport,
    ],
  })
  rootLogger.exitOnError = false
  return { rootLogger, logTransport }
}
