import { describe, expect, it } from "vitest"
import {
  migrateLegacyRetention,
  parseInfluxDBVersion,
  retentionSeconds,
  validateInfluxDBConfig,
} from "./influxdbConfig.js"
import { AppInfluxDBConfig } from "./types.js"

describe("parseInfluxDBVersion", () => {
  it.each([
    ["1", "1"],
    ["2", "2"],
    [3, "3"],
    ["1.8", undefined],
    ["4", undefined],
    [undefined, undefined],
    [null, undefined],
    ["", undefined],
  ])("parses %j as %j", (input, expected) => {
    expect(parseInfluxDBVersion(input)).toBe(expected)
  })
})

describe("retentionSeconds", () => {
  it.each([
    ["30d", 2592000],
    ["2w", 1209600],
    ["12h", 43200],
    ["1h", 3600],
    ["90m", 5400],
    ["1 day", 86400],
    ["0", 0],
    ["", undefined],
  ])("converts %j to %j", (input, expected) => {
    expect(retentionSeconds(input)).toBe(expected)
  })

  it.each(["garbage", "30dd", "1h30m", "720h0m0s", "30", "-1d", "500ms", "INF", "30m", "59m"])(
    "rejects %j",
    (input) => {
      expect(() => retentionSeconds(input)).toThrow("Invalid retention")
    },
  )
})

describe("migrateLegacyRetention", () => {
  it.each([
    ["30d", "30d"],
    ["", ""],
    ["0", "0"],
    ["INF", "0"],
    ["inf", "0"],
    ["0s", "0"],
    ["0d", "0"],
    ["720h0m0s", "30d"],
    ["1h30m", "90m"],
    ["2w", "2w"],
    ["168h", "168h"],
    ["3660s", "3660s"],
    ["1h1m", "61m"],
    ["1h0m1s", "3601s"],
    ["30m", undefined],
    ["garbage", undefined],
    ["30dd", undefined],
  ])("migrates %j to %j", (input, expected) => {
    expect(migrateLegacyRetention(input)).toBe(expected)
  })
})

describe("validateInfluxDBConfig", () => {
  const valid: AppInfluxDBConfig = {
    version: "1",
    protocol: "http",
    host: "influx",
    port: "8086",
    database: "venus",
    retention: "30d",
  }

  it("accepts a valid v1 config without credentials", () => {
    expect(validateInfluxDBConfig(valid)).toEqual([])
  })

  it("accepts a valid v2 config", () => {
    expect(validateInfluxDBConfig({ ...valid, version: "2", org: "o", token: "t" })).toEqual([])
  })

  it("accepts a v3 config with and without a token", () => {
    expect(validateInfluxDBConfig({ ...valid, version: "3", token: "t" })).toEqual([])
    expect(validateInfluxDBConfig({ ...valid, version: "3", token: "" })).toEqual([])
  })

  it("accepts a numeric version as sent in raw JSON", () => {
    expect(validateInfluxDBConfig({ ...valid, version: 2 as any, org: "o", token: "t" })).toEqual([])
  })

  it.each([
    [{ version: "1.8" }, "Version must be one of 1, 2, 3"],
    [{ version: "4" }, "Version must be one of 1, 2, 3"],
    [{ protocol: "ftp" }, "Protocol must be http or https"],
    [{ host: "" }, "Host is required"],
    [{ port: "" }, "Port must be a number"],
    [{ port: "abc" }, "Port must be a number"],
    [{ port: "70000" }, "Port must be a number"],
    [{ database: "" }, "Database name is required"],
    [{ version: "2", org: "o", token: "t", database: "" }, "Bucket name is required"],
    [{ retention: "30dd" }, "Invalid retention"],
    [{ retention: "30" }, "Invalid retention"],
    [{ version: "2", token: "t" }, "Organization is required"],
    [{ version: "2", org: "o" }, "Token is required"],
    [{ batchWriteInterval: -1 }, "Batch write interval"],
    [{ batchWriteInterval: "10" }, "Batch write interval"],
  ])("rejects %j with %j", (override, message) => {
    const errors = validateInfluxDBConfig({ ...valid, ...(override as Partial<AppInfluxDBConfig>) })
    expect(errors.some((error) => error.includes(message))).toBe(true)
  })

  it("reports every problem at once", () => {
    const errors = validateInfluxDBConfig({ ...valid, version: "2", host: "", retention: "x" })
    expect(errors).toHaveLength(4)
  })
})
