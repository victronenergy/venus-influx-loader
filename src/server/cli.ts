import { Command } from "commander"
import ms, { StringValue } from "ms"
import type { ServerOptions } from "./server.js"

export const programName = "venus-influx-loader"
export const autoExpiryDefault = "30d"

export function createProgram(version: string): Command {
  return new Command()
    .name(programName)
    .version(version)
    .description("Monitor Venus devices and capture & store realtime data to serve Grafana")
    .option("-c, --config-path <path>", "path to store config.json and secrets.json", "/config")
    .option("-p, --port <port>", "http port used by Admin Web User Interface and Grafana JSON datasource", "8088")
    .option(
      "--grafana-url <url>",
      "http link to Grafana",
      "${window.location.protocol}//${window.location.hostname}:3000",
    )
    .option("--disable-admin-api", "disable Admin Web User Interface and /admin-api/ endpoint")
    .option(
      "--disable-admin-api-auth",
      "disable password protection for Admin Web User Interface and /admin-api/ endpoint",
    )
    .option("--disable-grafana-api", "disable Grafana JSON datasource /grafana-api/ endpoint")
    .option("--enable-discovery-api", "enable venus-upnp-browser /discovery-api/ endpoint")
    .option("--enable-auto-expiry [duration]", "enable automatic expiry of data collection", autoExpiryDefault)
    .option("--hide-settings-influxdb")
    .option("--hide-settings-security")
    .option("--hide-settings-venus-discovery")
    .option("--hide-settings-venus-manual")
    .option("--hide-settings-venus-vrm")
}

// argv: user arguments only (i.e. process.argv.slice(2))
export function parseCliOptions(argv: string[], version: string): ServerOptions {
  const program = createProgram(version)
  program.parse(argv, { from: "user" })
  const options = program.opts()

  const adminApiAuthEnabled = options.disableAdminApiAuth ? false : true

  // only honour auto expiry when the option was actually given on the command line,
  // commander always reports the default value otherwise
  let autoExpiryDuration: number
  if (program.getOptionValueSource("enableAutoExpiry") === "cli") {
    autoExpiryDuration =
      options.enableAutoExpiry === true ? ms(autoExpiryDefault) : ms(options.enableAutoExpiry as StringValue)
  } else {
    autoExpiryDuration = 0 // disabled
  }

  return {
    configPath: options.configPath,
    port: Number(options.port),
    discoveryApiEndpoint: options.enableDiscoveryApi ? "/discovery-api/" : undefined,
    adminApiEndpoint: options.disableAdminApi ? undefined : "/admin-api/",
    adminApiEndpointAuthEnabled: adminApiAuthEnabled,
    grafanaApiEndpoint: options.disableGrafanaApi ? undefined : "/grafana-api/",
    uiSettings: {
      grafanaUrl: options.grafanaUrl,
      showEditDiscoverySettings: !options.hideSettingsVenusDiscovery,
      showEditVRMSettings: !options.hideSettingsVenusVrm,
      showEditManualSettings: !options.hideSettingsVenusManual,
      showEditSecuritySettings: !options.hideSettingsSecurity && adminApiAuthEnabled,
      showEditInfluxDBSettings: !options.hideSettingsInfluxdb,
      showAutomaticExpirySettings: autoExpiryDuration > 0 ? autoExpiryDuration : undefined,
    },
  }
}
