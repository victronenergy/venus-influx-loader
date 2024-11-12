#!/usr/bin/env node

import { program } from "commander"
// @ts-expect-error
import buildInfo from "../buildInfo.cjs"

import axios from "axios"

import { UPNP } from "../server/upnp"
import { LogEntry, LogLevel } from "../shared/types"
import { DiscoveredDevice } from "../shared/state"

program
  .version(buildInfo.buildVersion)
  .description("Discover Venus devices running on local network using UPNP")
  .option("-d, --discovery-api <url>", "discovery api endpoint", "http://localhost:8088/discovery-api/")

program.parse()
const options = program.opts()

function log(message: string) {
  console.log(`${program.name()}: ${message}`)
}

log("Use --help to learn how to use this program")
log(`Discovery API: ${options.discoveryApi}`)

// endpoints used to talk to venus-influx-loader
const logEndpoint = new URL("log", options.discoveryApi)
const discoveryEndpoint = new URL("upnpDiscovered", options.discoveryApi)

// cache discovered venus devices and log entries
// so they can be posted to discoveryApi when ready
let cachedLogs: LogEntry[] = []
let cachedDiscovery: DiscoveredDevice[] = []

function postLog(endpoint: URL, entry: LogEntry) {
  axios
    .post(endpoint.toString(), entry)
    .then((response) => response.data)
    .catch((err) => {
      log(`Failed to postLog to ${endpoint}, error: ${err.message}`)
      cachedLogs.push(entry)
    })
}

function postDiscovery(endpoint: URL, info: DiscoveredDevice) {
  axios
    .post(endpoint.toString(), info)
    .then((response) => response.data)
    .catch((err) => {
      log(`Failed to postDiscovery to ${endpoint}, error: ${err.message}`)
      cachedDiscovery.push(info)
    })
}

// flush all cached discovered devices and log entries every 5 sec
setInterval(() => {
  const logs = cachedLogs
  const discovered = cachedDiscovery
  cachedLogs = []
  cachedDiscovery = []
  logs.forEach((log) => {
    postLog(logEndpoint, log)
  })
  discovered.forEach((info) => {
    postDiscovery(discoveryEndpoint, info)
  })
}, 5000)

// server mock
const serverMock = {
  getLogger: (name: string) => {
    return {
      log: (level: LogLevel, message: string) => {
        log(message)
        postLog(logEndpoint, { timestamp: Date.now().toString(), label: name, level: level, message: message })
      },
    }
  },
  emit: (event: string, data: any) => {
    if (event === "upnpDiscovered") {
      postDiscovery(discoveryEndpoint, data)
    }
  },
}

// upnp browser
const browser = new UPNP(serverMock)

// exit on `docker stop` or Ctrl-C
const signals = ["SIGTERM", "SIGINT"]
signals.forEach((signal: string) => {
  process.on(signal, function () {
  browser.stop()
  process.exit()
})})

// start browsing
browser.start()
