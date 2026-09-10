import { describe, expect, it, vi } from "vitest"
import {
  Loader,
  arrayDifference,
  calculateVrmBrokerURL,
  parseVenusTopic,
  prepareVenusMQTTSubscriptions,
} from "./loader"
import ignoredMeasurements from "./ignoredMeasurements"
import { Server } from "./server"

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
