import { describe, expect, it } from "vitest"
import { parseCliOptions } from "./cli.js"

const parse = (argv: string[]) => parseCliOptions(argv, "1.0.0-test")

describe("parseCliOptions", () => {
  it("applies defaults when no arguments are given", () => {
    expect(parse([])).toEqual({
      configPath: "/config",
      port: 8088,
      discoveryApiEndpoint: undefined,
      adminApiEndpoint: "/admin-api/",
      adminApiEndpointAuthEnabled: true,
      grafanaApiEndpoint: "/grafana-api/",
      uiSettings: {
        grafanaUrl: "${window.location.protocol}//${window.location.hostname}:3000",
        showEditDiscoverySettings: true,
        showEditVRMSettings: true,
        showEditManualSettings: true,
        showEditSecuritySettings: true,
        showEditInfluxDBSettings: true,
        showAutomaticExpirySettings: undefined,
      },
    })
  })

  it("parses port, config path, and endpoint toggles", () => {
    const options = parse(["-p", "9000", "-c", "/tmp/x", "--enable-discovery-api", "--disable-grafana-api"])
    expect(options.port).toBe(9000)
    expect(options.configPath).toBe("/tmp/x")
    expect(options.discoveryApiEndpoint).toBe("/discovery-api/")
    expect(options.grafanaApiEndpoint).toBeUndefined()
    expect(options.adminApiEndpoint).toBe("/admin-api/")
  })

  it("disables the admin api", () => {
    expect(parse(["--disable-admin-api"]).adminApiEndpoint).toBeUndefined()
  })

  it("disabling admin api auth also hides the security settings", () => {
    const options = parse(["--disable-admin-api-auth"])
    expect(options.adminApiEndpointAuthEnabled).toBe(false)
    expect(options.uiSettings.showEditSecuritySettings).toBe(false)
  })

  it("keeps auto expiry disabled unless the option is given", () => {
    expect(parse([]).uiSettings.showAutomaticExpirySettings).toBeUndefined()
  })

  it("uses the 30d default for a bare --enable-auto-expiry", () => {
    expect(parse(["--enable-auto-expiry"]).uiSettings.showAutomaticExpirySettings).toBe(30 * 24 * 3600 * 1000)
  })

  it("accepts an explicit auto expiry duration", () => {
    expect(parse(["--enable-auto-expiry", "7d"]).uiSettings.showAutomaticExpirySettings).toBe(7 * 24 * 3600 * 1000)
    expect(parse(["--enable-auto-expiry=7d"]).uiSettings.showAutomaticExpirySettings).toBe(7 * 24 * 3600 * 1000)
  })

  it("maps --hide-settings-* flags to ui settings", () => {
    const options = parse([
      "--hide-settings-influxdb",
      "--hide-settings-security",
      "--hide-settings-venus-discovery",
      "--hide-settings-venus-manual",
      "--hide-settings-venus-vrm",
    ])
    expect(options.uiSettings).toMatchObject({
      showEditInfluxDBSettings: false,
      showEditSecuritySettings: false,
      showEditDiscoverySettings: false,
      showEditManualSettings: false,
      showEditVRMSettings: false,
    })
  })
})
