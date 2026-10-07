// Minimal InfluxDB line protocol serializer, shared by every InfluxDB version (1.x, 2.x, 3):
// https://docs.influxdata.com/influxdb/v2/reference/syntax/line-protocol/

export interface Point {
  timestamp: Date
  measurement: string
  tags: Record<string, string | undefined>
  fields: Record<string, number | string>
}

// Line protocol has no escape for control characters (newline would start a new line), and
// they never belong in a measurement, tag or field key, so drop them. Other Unicode whitespace
// such as a non-breaking space is legal and left alone. A trailing backslash would escape the
// separator that follows and InfluxDB 1.x does not unescape a doubled backslash, so drop it too.
function sanitizeIdentifier(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1f\x7f]/g, "").replace(/\\+$/, "")
}

// measurement: escape comma and space
function escapeMeasurement(value: string): string {
  return sanitizeIdentifier(value).replace(/[, ]/g, (c) => `\\${c}`)
}

// tag keys, tag values, field keys: escape comma, equals sign and space
function escapeKey(value: string): string {
  return sanitizeIdentifier(value).replace(/[,= ]/g, (c) => `\\${c}`)
}

// string field values: double quoted, escape backslash and double quote; a newline can not be
// represented inside the quotes either, so turn it into a space
function escapeStringValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`).replace(/\r?\n|\r/g, " ")}"`
}

// Numbers are written without the integer `i` suffix so the field is always a float,
// which keeps new data type compatible with everything written so far.
function formatFieldValue(value: number | string): string {
  return typeof value === "string" ? escapeStringValue(value) : String(value)
}

// Serializes one point with a millisecond timestamp (write requests must use `precision=ms`).
// Tags without a value are skipped: InfluxDB rejects empty tag values, and topics without an
// instance segment (for example `N/<portalId>/full_publish_completed`) have no instance number.
export function toLineProtocol(point: Point): string {
  const tags = Object.entries(point.tags)
    .map(([key, value]): [string, string] => [escapeKey(key), escapeKey(value ?? "")])
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `,${key}=${value}`)
    .join("")
  const fields = Object.entries(point.fields)
    .map(([key, value]) => `${escapeKey(key)}=${formatFieldValue(value)}`)
    .join(",")
  return `${escapeMeasurement(point.measurement)}${tags} ${fields} ${point.timestamp.getTime()}`
}

export function toLineProtocolBatch(points: Point[]): string {
  return points.map(toLineProtocol).join("\n")
}
