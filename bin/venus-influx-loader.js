#!/usr/bin/env node

const commander = require('commander')
const program = commander.program
const buildVersion = require('../dist/buildInfo').buildVersion

const Server = require('../src/server/server')

program
  .version(buildVersion)
  .description(
    'Monitor Venus devices and capture & store realtime data to serve Grafana'
  )
  .option(
    '-c, --config-path <path>',
    'path to store config.json and secrets.json',
    '/config'
  )
  .option(
    '--disable-admin-api',
    'disable Admin Web User Interface and /admin-api/ endpoint'
  )
  .option(
    '--disable-admin-api-auth',
    'disable password protection for Admin Web User Interface and /admin-api/ endpoint'
  )
  .option(
    '--disable-grafana-api',
    'disable Grafana JSON datasource /grafana-api/ endpoint'
  )
  .option(
    '--enable-discovery-api',
    'enable venus-upnp-browser /discovery-api/ endpoint'
  )
  .option(
    '-p, --port <port>',
    'http port used by Admin Web User Interface and Grafana JSON datasource',
    8088
  )

program.parse()
const options = program.opts()

function log (message) {
  console.log(`${program.name()}: ${message}`)
}

const discoveryApiEndpoint = options.enableDiscoveryApi
  ? '/discovery-api/'
  : undefined
const adminApiEndpoint = options.disableAdminApi ? undefined : '/admin-api/'
const adminApiEndpointAuthEnabled = options.disableAdminApiAuth ? false : true
const grafanaApiEndpoint = options.disableGrafanaApi
  ? undefined
  : '/grafana-api/'
const port = options.port

log('Use --help to learn how to use this program')
log(`Config Path: ${options.configPath}`)
log(`Discovery API: ${discoveryApiEndpoint || 'disabled'}`)
log(`Admin API: ${adminApiEndpoint || 'disabled'}`)
log(`Grafana JSON Datasource API: ${grafanaApiEndpoint || 'disabled'}`)
log(`API Port: ${adminApiEndpoint || grafanaApiEndpoint ? port : 'disabled'}`)

// exit on Ctrl-C
process.on('SIGINT', function () {
  server.stop()
  process.exit()
})

const server = new Server({
  configPath: options.configPath,
  port: port,
  discoveryApiEndpoint: discoveryApiEndpoint,
  adminApiEndpoint: adminApiEndpoint,
  adminApiEndpointAuthEnabled: adminApiEndpointAuthEnabled,
  grafanaApiEndpoint: grafanaApiEndpoint
})

// start server
server.start()
