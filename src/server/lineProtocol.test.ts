import { describe, expect, it } from "vitest"
import { Point, toLineProtocol, toLineProtocolBatch } from "./lineProtocol.js"

const timestamp = new Date("2026-01-01T00:00:00.123Z")

function point(overrides: Partial<Point> = {}): Point {
  return {
    timestamp,
    measurement: "solarcharger/Dc/0/Voltage",
    tags: { portalId: "abc123", instanceNumber: "288", name: "Boat" },
    fields: { value: 12.5 },
    ...overrides,
  }
}

describe("toLineProtocol", () => {
  it("serializes measurement, tags, field and millisecond timestamp", () => {
    expect(toLineProtocol(point())).toBe(
      "solarcharger/Dc/0/Voltage,portalId=abc123,instanceNumber=288,name=Boat value=12.5 1767225600123",
    )
  })

  it("writes integers as floats (no i suffix)", () => {
    expect(toLineProtocol(point({ fields: { value: 42 } }))).toContain(" value=42 ")
  })

  it("quotes string field values and escapes quotes and backslashes", () => {
    expect(toLineProtocol(point({ fields: { stringValue: 'a "b" c\\d' } }))).toContain(
      ' stringValue="a \\"b\\" c\\\\d" ',
    )
  })

  it("escapes comma, equals sign and space in tag values", () => {
    expect(toLineProtocol(point({ tags: { name: "My Boat, v=2" } }))).toBe(
      "solarcharger/Dc/0/Voltage,name=My\\ Boat\\,\\ v\\=2 value=12.5 1767225600123",
    )
  })

  it("escapes comma and space in the measurement", () => {
    expect(toLineProtocol(point({ measurement: "a b,c" }))).toMatch(/^a\\ b\\,c,/)
  })

  it("drops tags with an empty value", () => {
    expect(toLineProtocol(point({ tags: { portalId: "p", name: "" } }))).toBe(
      "solarcharger/Dc/0/Voltage,portalId=p value=12.5 1767225600123",
    )
  })

  it("joins a batch with newlines", () => {
    expect(toLineProtocolBatch([point(), point({ fields: { value: 1 } })]).split("\n")).toHaveLength(2)
  })
})
