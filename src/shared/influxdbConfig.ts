import ms, { StringValue } from "ms"
import { AppInfluxDBConfig, AppInfluxDBProtocol, AppInfluxDBVersion } from "./types.js"

export const influxDBVersions: readonly AppInfluxDBVersion[] = ["1", "2", "3"]
const influxDBProtocols: readonly AppInfluxDBProtocol[] = ["http", "https"]

// Accepts "2" as well as 2 (a JSON number), anything else is undefined
export function parseInfluxDBVersion(value: unknown): AppInfluxDBVersion | undefined {
  const version = String(value) as AppInfluxDBVersion
  return influxDBVersions.includes(version) ? version : undefined
}

// "" -> undefined (leave the retention unmanaged), "0" -> 0 (keep forever), "30d" -> 2592000.
// Throws for anything else: a unit is required ("30" would be 30 milliseconds), compound
// InfluxQL durations ("1h30m") are not supported by `ms`, negative or sub-second values make no sense.
export function retentionSeconds(retention: string): number | undefined {
  if (retention === "") {
    return undefined
  }
  if (retention === "0") {
    return 0
  }
  const millis = /^\d+(\.\d+)?\s*[a-zA-Z]+$/.test(retention) ? ms(retention as StringValue) : undefined
  if (millis === undefined || !Number.isFinite(millis) || millis < 1000) {
    throw new Error(
      `Invalid retention: ${JSON.stringify(retention)}, use for example 30d, 12h, 2w, or 0 to keep forever`,
    )
  }
  return Math.round(millis / 1000)
}

// Returns every problem with the InfluxDB settings as a human readable message, an empty
// array means the settings are valid. `version` is compared after coercion to a string, so
// callers that accept raw JSON should also store `parseInfluxDBVersion(config.version)`.
export function validateInfluxDBConfig(config: AppInfluxDBConfig): string[] {
  const errors: string[] = []
  const version = parseInfluxDBVersion(config.version)

  if (version === undefined) {
    errors.push(`Version must be one of ${influxDBVersions.join(", ")}, got ${JSON.stringify(config.version)}`)
  }
  if (!influxDBProtocols.includes(config.protocol)) {
    errors.push(`Protocol must be http or https, got ${JSON.stringify(config.protocol)}`)
  }
  if (!config.host) {
    errors.push("Host is required")
  }
  if (!/^\d+$/.test(config.port ?? "") || Number(config.port) < 1 || Number(config.port) > 65535) {
    errors.push(`Port must be a number between 1 and 65535, got ${JSON.stringify(config.port)}`)
  }
  if (!config.database) {
    errors.push(version === "2" ? "Bucket name is required" : "Database name is required")
  }
  try {
    retentionSeconds(config.retention ?? "")
  } catch (error) {
    errors.push((error as Error).message)
  }
  if (version === "2") {
    if (!config.org) {
      errors.push("Organization is required for InfluxDB 2.x")
    }
    if (!config.token) {
      errors.push("Token is required for InfluxDB 2.x")
    }
  }
  if (config.batchWriteInterval !== undefined) {
    const interval = config.batchWriteInterval
    if (typeof interval !== "number" || !Number.isFinite(interval) || interval < 0) {
      errors.push(`Batch write interval must be a non-negative number, got ${JSON.stringify(interval)}`)
    }
  }
  return errors
}
