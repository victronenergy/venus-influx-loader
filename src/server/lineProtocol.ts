// Minimal InfluxDB line protocol serializer, shared by every InfluxDB version (1.x, 2.x, 3):
// https://docs.influxdata.com/influxdb/v2/reference/syntax/line-protocol/

export interface Point {
  timestamp: Date
  measurement: string
  tags: Record<string, string>
  fields: Record<string, number | string>
}

// measurement: escape comma and space
function escapeMeasurement(value: string): string {
  return value.replace(/[,\s]/g, (c) => `\\${c}`)
}

// tag keys, tag values, field keys: escape comma, equals sign and space
function escapeKey(value: string): string {
  return value.replace(/[,=\s]/g, (c) => `\\${c}`)
}

// string field values: double quoted, escape backslash and double quote
function escapeStringValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`
}

// Numbers are written without the integer `i` suffix so the field is always a float,
// which keeps new data type compatible with everything written so far.
function formatFieldValue(value: number | string): string {
  return typeof value === "string" ? escapeStringValue(value) : String(value)
}

// Serializes one point with a millisecond timestamp (write requests must use `precision=ms`).
// Tags with an empty value are skipped, InfluxDB rejects them.
export function toLineProtocol(point: Point): string {
  const tags = Object.entries(point.tags)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `,${escapeKey(key)}=${escapeKey(value)}`)
    .join("")
  const fields = Object.entries(point.fields)
    .map(([key, value]) => `${escapeKey(key)}=${formatFieldValue(value)}`)
    .join(",")
  return `${escapeMeasurement(point.measurement)}${tags} ${fields} ${point.timestamp.getTime()}`
}

export function toLineProtocolBatch(points: Point[]): string {
  return points.map(toLineProtocol).join("\n")
}
