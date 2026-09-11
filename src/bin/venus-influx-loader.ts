#!/usr/bin/env node

import buildInfo from "../buildInfo.cjs"
import ms from "ms"

import { Server } from "../server/server.js"
import { parseCliOptions, programName } from "../server/cli.js"

const options = parseCliOptions(process.argv.slice(2), buildInfo.buildVersion)

function log(message: string) {
  console.log(`${programName}: ${message}`)
}

const autoExpiryDuration = options.uiSettings.showAutomaticExpirySettings ?? 0

log("Use --help to learn how to use this program")
log(`Config Path: ${options.configPath}`)
log(`Discovery API: ${options.discoveryApiEndpoint || "disabled"}`)
log(`Admin API: ${options.adminApiEndpoint || "disabled"}`)
log(`Grafana JSON Datasource API: ${options.grafanaApiEndpoint || "disabled"}`)
log(`API Port: ${options.adminApiEndpoint || options.grafanaApiEndpoint ? options.port : "disabled"}`)
log(`Grafana URL: ${options.uiSettings.grafanaUrl}`)
log(`Automatic Data Collection Expiry: ${autoExpiryDuration > 0 ? ms(autoExpiryDuration, { long: true }) : "disabled"}`)

// exit on `docker stop` or Ctrl-C
const signals = ["SIGTERM", "SIGINT"]
signals.forEach((signal: string) => {
  process.on(signal, function () {
    server.stop()
    process.exit()
  })
})

const server = new Server(options)

// start server
server.start()
