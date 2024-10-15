#!/usr/bin/env node

import commander from "commander"
const program = commander.program
const buildVersion = require("../buildInfo").buildVersion

import axios from "axios"

import upnp from "../server/upnp.js"

program
  .version(buildVersion)
  .description("Discover Venus devices running on local network using UPNP")
  .option(
    "-d, --discovery-api <url>",
    "discovery api endpoint",
    "http://localhost:8088/discovery-api/",
  )

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

// upnp browser
const browser = upnp({
  getLogger: (_name: string) => {
    return {
      info: (message: string) => {
        log(message)
        postLog(logEndpoint, { level: "info", message: message })
      },
      error: (message: string) => {
        log(message)
        postLog(logEndpoint, { level: "error", message: message })
      },
    }
  },
  emit: (event: string, data: any) => {
    if (event === "upnpDiscovered") {
      postDiscovery(discoveryEndpoint, data)
    }
  },
})

interface LogMessage {
  level: string
  message: string
}

interface DiscoveryMessage {
  data: string
}

// cache discovered venus devices and log entries
// so they can be posted to discoveryApi when ready
let cachedLogs: LogMessage[] = []
let cachedDiscovery: DiscoveryMessage[] = []

function postLog(endpoint: URL, info: LogMessage) {
  axios
    .post(endpoint.toString(), info)
    .then((response) => response.data)
    .catch((err) => {
      log(`Failed to postLog to ${endpoint}, error: ${err.message}`)
      cachedLogs.push(info)
    })
}

function postDiscovery(endpoint: URL, info: DiscoveryMessage) {
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

// exit on Ctrl-C
process.on("SIGINT", function () {
  browser.stop()
  process.exit()
})

// start browsing
browser.start()
