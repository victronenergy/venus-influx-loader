#!/usr/bin/env node

const program = require('commander')
const axios = require('axios')

const upnp = require('../src/server/upnp')

program
  .description('Discover Venus devices running on local network using UPNP')
  .option(
    '-d, --discovery-api <url>',
    'discovery api endpoint',
    'http://localhost:8088/discovery-api/'
  )

program.parse()
const options = program.opts()

function log (message) {
  console.log(`${program.name()}: ${message}`)
}

log('Use --help to learn how to use this program')
log(`Discovery API: ${options.discoveryApi}`)

// endpoints used to talk to venus-influx-loader
const logEndpoint = new URL('log', options.discoveryApi)
const discoveryEndpoint = new URL('upnpDiscovered', options.discoveryApi)

// upnp browser
const browser = upnp({
  getLogger: name => {
    return {
      info: message => {
        log(message)
        postLog(logEndpoint, { level: 'info', message: message })
      },
      error: message => {
        log(message)
        postLog(logEndpoint, { level: 'error', message: message })
      }
    }
  },
  emit: (event, data) => {
    if (event === 'upnpDiscovered') {
      postDiscovery(discoveryEndpoint, data)
    }
  }
})

// cache discovered venus devices and log entries
// so they can be posted to discoveryApi when ready
let cachedLogs = []
let cachedDiscovery = []

function postLog (endpoint, info) {
  axios
    .post(logEndpoint, info)
    .then(response => response.data)
    .catch(err => {
      log(`Failed to postLog to ${endpoint}, error: ${err.message}`)
      cachedLogs.push(info)
    })
}

function postDiscovery (endpoint, info) {
  axios
    .post(discoveryEndpoint, info)
    .then(response => response.data)
    .catch(err => {
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
  logs.forEach(log => {
    postLog(logEndpoint, log)
  })
  discovered.forEach(info => {
    postDiscovery(discoveryEndpoint, info)
  })
}, 5000)

// exit on Ctrl-C
process.on('SIGINT', function () {
  browser.stop()
  process.exit()
})

// start browsing
browser.start()
