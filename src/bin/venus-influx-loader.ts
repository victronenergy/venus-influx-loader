#!/usr/bin/env node

import commander from "commander"
const program = commander.program
const buildVersion = require("../buildInfo").buildVersion

import Server from "../server/server.js"

program
  .version(buildVersion)
  .description(
    "Monitor Venus devices and capture & store realtime data to serve Grafana",
  )
  .option(
    "-c, --config-path <path>",
    "path to store config.json and secrets.json",
    "/config",
  )
  .option(
    "-p, --port <port>",
    "http port used by Admin Web User Interface and Grafana JSON datasource",
    "8088",
  )
  .option(
    "--disable-admin-api",
    "disable Admin Web User Interface and /admin-api/ endpoint",
  )
  .option(
    "--disable-admin-api-auth",
    "disable password protection for Admin Web User Interface and /admin-api/ endpoint",
  )
  .option(
    "--disable-grafana-api",
    "disable Grafana JSON datasource /grafana-api/ endpoint",
  )
  .option(
    "--enable-discovery-api",
    "enable venus-upnp-browser /discovery-api/ endpoint",
  )
  .option("--hide-settings-influxdb")
  .option("--hide-settings-security")
  .option("--hide-settings-venus-discovery")
  .option("--hide-settings-venus-manual")
  .option("--hide-settings-venus-vrm")

program.parse()
const options = program.opts()

function log(message: string) {
  console.log(`${program.name()}: ${message}`)
}

const discoveryApi = options.enableDiscoveryApi ? "/discovery-api/" : undefined
const adminApi = options.disableAdminApi ? undefined : "/admin-api/"
const adminApiAuthEnabled = options.disableAdminApiAuth ? false : true
const grafanaApi = options.disableGrafanaApi ? undefined : "/grafana-api/"
const port = options.port

log("Use --help to learn how to use this program")
log(`Config Path: ${options.configPath}`)
log(`Discovery API: ${discoveryApi || "disabled"}`)
log(`Admin API: ${adminApi || "disabled"}`)
log(`Grafana JSON Datasource API: ${grafanaApi || "disabled"}`)
log(`API Port: ${adminApi || grafanaApi ? port : "disabled"}`)

// exit on Ctrl-C
process.on("SIGINT", function () {
  server.stop()
  process.exit()
})

const server = new Server({
  configPath: options.configPath,
  port: Number(port),
  discoveryApiEndpoint: discoveryApi,
  adminApiEndpoint: adminApi,
  adminApiEndpointAuthEnabled: adminApiAuthEnabled,
  grafanaApiEndpoint: grafanaApi,
  showEditDiscoverySettings: !options.hideSettingsVenusDiscovery,
  showEditVRMSettings: !options.hideSettingsVenusVRM,
  showEditManualSettings: !options.hideSettingsVenusManual,
  showEditSecuritySettings:
    !options.hideSettingsSecurity && adminApiAuthEnabled,
  showEditInfluxDBSettings: !options.hideSettingsInfluxdb,
})

// start server
server.start()
