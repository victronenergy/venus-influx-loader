import { describe, expect, it, vi } from "vitest"
import {
  Loader,
  arrayDifference,
  buildVenusMqttConnection,
  calculateVrmBrokerURL,
  isSameVenusMqttConnection,
  parseVenusTopic,
  prepareVenusMQTTSubscriptions,
} from "./loader.js"
import ignoredMeasurements from "./ignoredMeasurements.js"
import { Server } from "./server.js"
import { AppSecrets } from "../shared/types.js"
import { ConfiguredDevice } from "../shared/state.js"

describe("parseVenusTopic", () => {
  it("splits portalId, instance and measurement", () => {
    expect(parseVenusTopic("N/abc123/solarcharger/288/Dc/0/Voltage")).toEqual({
      portalId: "abc123",
      instanceNumber: "288",
      measurement: "solarcharger/Dc/0/Voltage",
    })
  })

  it("handles the portalId and system name detection topics", () => {
    expect(parseVenusTopic("N/abc/system/0/Serial").measurement).toBe("system/Serial")
    expect(parseVenusTopic("N/abc/settings/0/Settings/SystemSetup/SystemName").measurement).toBe(
      "settings/Settings/SystemSetup/SystemName",
    )
  })

  it("produces measurements matching the ignored prefixes", () => {
    const { measurement } = parseVenusTopic("N/abc/solarcharger/288/History/Daily/0/Yield")
    expect(measurement).toBe("solarcharger/History/Daily/0/Yield")
    expect(ignoredMeasurements.some((prefix) => measurement.startsWith(prefix))).toBe(true)
  })
})

describe("arrayDifference", () => {
  it("returns items of the first array missing from the second", () => {
    expect(arrayDifference([1, 2, 3], [2])).toEqual([1, 3])
    expect(arrayDifference([], [1])).toEqual([])
    expect(arrayDifference(["a"], [])).toEqual(["a"])
  })
})

describe("calculateVrmBrokerURL", () => {
  it("hashes the lowercased portalId onto one of 128 brokers", () => {
    expect(calculateVrmBrokerURL("abc")).toBe("mqtt38.victronenergy.com")
    expect(calculateVrmBrokerURL("ABC")).toBe("mqtt38.victronenergy.com")
    expect(calculateVrmBrokerURL("48e7da87e0d5")).toBe("mqtt106.victronenergy.com")
  })
})

describe("prepareVenusMQTTSubscriptions", () => {
  it("subscribes to everything by default", () => {
    expect(prepareVenusMQTTSubscriptions()).toEqual(["/#"])
    expect(prepareVenusMQTTSubscriptions([])).toEqual(["/system/#", "/settings/#"])
  })

  it("collapses to the wildcard when it is included", () => {
    expect(prepareVenusMQTTSubscriptions(["/battery/#", "/#"])).toEqual(["/#"])
  })

  it("always adds the system and settings topics to a custom selection", () => {
    expect(prepareVenusMQTTSubscriptions(["/battery/#"])).toEqual(["/battery/#", "/system/#", "/settings/#"])
  })
})

describe("Loader.collectStatistics", () => {
  function createLoader() {
    const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
    const server = { getLogger: () => logger, emit: vi.fn(), on: vi.fn() } as unknown as Server
    const loader = new Loader(server)
    loader.loaderStatistics.deviceStatistics["UPNP:1.2.3.4:abc"] = {
      type: "UPNP",
      address: "1.2.3.4",
      portalId: "abc",
      name: "abc",
      isReceivingData: true,
      hasReceivedKeepAliveConfirmation: true,
      measurementRate: 0,
      totalMeasurementsCount: 10,
      lastIntervalCount: 0,
      distinctMeasurementsCount: 3,
    }
    return { loader, server }
  }

  it("derives rates from the measurement counts since the last interval", () => {
    const { loader, server } = createLoader()

    loader.collectStatistics()

    const stats = loader.loaderStatistics
    expect(stats.measurementRate).toBe(2)
    expect(stats.distinctMeasurementsCount).toBe(3)
    expect(stats.deviceStatistics["UPNP:1.2.3.4:abc"]).toMatchObject({ measurementRate: 2, lastIntervalCount: 10 })
    expect(server.emit).toHaveBeenCalledWith("loaderevent", { type: "LOADER_STATISTICS", data: stats })
  })

  it("reports a zero rate when no new measurements arrived", () => {
    const { loader } = createLoader()
    loader.collectStatistics()
    loader.collectStatistics()
    expect(loader.loaderStatistics.measurementRate).toBe(0)
    expect(loader.loaderStatistics.deviceStatistics["UPNP:1.2.3.4:abc"].measurementRate).toBe(0)
  })
})

describe("buildVenusMqttConnection", () => {
  const secrets: AppSecrets = {
    vrmUsername: "me@example.com",
    vrmToken: "vrm-token",
    vrmTokenId: "42",
    venusTokens: {
      "IP:1.2.3.4": { tokenName: "token/venusinfluxloader/vil1", password: "pw-ip", pairedAt: 1 },
      "UPNP:abc": { tokenName: "token/venusinfluxloader/vil2", password: "pw-upnp", pairedAt: 1 },
    },
  }
  const ip: ConfiguredDevice = { type: "IP", address: "1.2.3.4", subscriptions: ["/#"] }
  const upnp: ConfiguredDevice = { type: "UPNP", address: "10.0.0.2", portalId: "abc", subscriptions: ["/#"] }
  const vrm: ConfiguredDevice = {
    type: "VRM",
    address: "mqtt38.victronenergy.com",
    portalId: "abc",
    subscriptions: ["/#"],
  }

  it("connects to VRM over TLS with the VRM token", () => {
    const { url, options } = buildVenusMqttConnection(vrm, secrets, "rnd")
    expect(url).toBe("mqtts://mqtt38.victronenergy.com:8883")
    expect(options).toMatchObject({
      rejectUnauthorized: false,
      username: "me@example.com",
      password: "Token vrm-token",
      reconnectPeriod: 10_000,
      protocolVersion: 5,
      reconnectOnConnackError: true,
    })
    expect(options.clientId).toMatch(/^venus_influx_loader_.*_rnd_42$/)
  })

  it("connects to a plain local device without credentials", () => {
    const { url, options } = buildVenusMqttConnection(ip, secrets, "rnd")
    expect(url).toBe("mqtt://1.2.3.4:1883")
    expect(options.username).toBeUndefined()
    expect(options.password).toBeUndefined()
    expect(options.rejectUnauthorized).toBeUndefined()
    expect(options).toMatchObject({ reconnectPeriod: 10_000, protocolVersion: 5, reconnectOnConnackError: true })
    expect(options.clientId).toMatch(/^venus_influx_loader_.*_rnd$/)
  })

  it("connects to a secure manual host over TLS with the token stored under its hostName", () => {
    const { url, options } = buildVenusMqttConnection({ ...ip, secure: true }, secrets, "rnd")
    expect(url).toBe("mqtts://1.2.3.4:8883")
    expect(options).toMatchObject({
      rejectUnauthorized: false,
      username: "token/venusinfluxloader/vil1",
      password: "pw-ip",
    })
  })

  it("connects to a secure discovered device with the token stored under its portalId", () => {
    const { url, options } = buildVenusMqttConnection({ ...upnp, secure: true }, secrets, "rnd")
    expect(url).toBe("mqtts://10.0.0.2:8883")
    expect(options).toMatchObject({ username: "token/venusinfluxloader/vil2", password: "pw-upnp" })
  })

  it("refuses to connect a secure device that is not paired", () => {
    expect(() => buildVenusMqttConnection({ ...ip, address: "5.6.7.8", secure: true }, secrets, "rnd")).toThrow(
      /not yet paired/,
    )
    expect(() => buildVenusMqttConnection({ ...ip, secure: true }, {}, "rnd")).toThrow(/not yet paired/)
  })
})

describe("isSameVenusMqttConnection", () => {
  const a = { url: "mqtts://h:8883", options: { username: "u", password: "p", clientId: "1" } }

  it("ignores the clientId", () => {
    expect(isSameVenusMqttConnection(a, { ...a, options: { ...a.options, clientId: "2" } })).toBe(true)
  })

  it("compares url and credentials", () => {
    expect(isSameVenusMqttConnection(a, { ...a, url: "mqtt://h:1883" })).toBe(false)
    expect(isSameVenusMqttConnection(a, { ...a, options: { ...a.options, password: "x" } })).toBe(false)
  })

  it("treats two unpaired states as the same", () => {
    expect(isSameVenusMqttConnection(undefined, undefined)).toBe(true)
    expect(isSameVenusMqttConnection(a, undefined)).toBe(false)
  })
})
