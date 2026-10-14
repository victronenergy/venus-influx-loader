import { describe, expect, it } from "vitest"
import { venusPairingRole, venusTokenKey } from "./venusConfig.js"

describe("venusTokenKey", () => {
  it("prefixes the key with the device type", () => {
    expect(venusTokenKey("IP", "192.168.1.5")).toBe("IP:192.168.1.5")
    expect(venusTokenKey("UPNP", "abc123")).toBe("UPNP:abc123")
  })
})

describe("venusPairingRole", () => {
  it("only contains characters the device accepts", () => {
    expect(venusPairingRole).toMatch(/^\w+$/)
  })
})
