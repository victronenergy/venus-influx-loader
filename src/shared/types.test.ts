import { describe, expect, it } from "vitest"
import { createAppConfig, createAppSecrets } from "./types.js"

describe("createAppConfig", () => {
  it("returns the full default config", () => {
    const config = createAppConfig()
    expect(config.upnp).toEqual({ enabled: true, enabledPortalIds: [], expiry: {}, subscriptions: {} })
    expect(config.manual).toEqual({ enabled: true, hosts: [], expiry: {}, subscriptions: {} })
    expect(config.vrm).toEqual({
      enabled: true,
      enabledPortalIds: [],
      manualPortalIds: [],
      hasToken: false,
      expiry: {},
      subscriptions: {},
    })
    expect(config.influxdb).toEqual({
      protocol: "http",
      host: "localhost",
      port: "8086",
      database: "venus",
      retention: "30d",
    })
  })

  it("replaces whole top-level sections with overrides (shallow merge)", () => {
    const config = createAppConfig({ influxdb: { host: "x" } as any })
    expect(config.influxdb).toEqual({ host: "x" })
    expect(config.upnp.enabled).toBe(true)
  })
})

describe("createAppSecrets", () => {
  it("defaults to an empty object", () => {
    expect(createAppSecrets()).toEqual({})
  })

  it("passes overrides through", () => {
    const login = { username: "u", password: "p" }
    expect(createAppSecrets({ login })).toEqual({ login })
  })
})
