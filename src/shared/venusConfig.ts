// local Venus devices are either configured manually by hostName ("IP") or discovered via UPNP ("UPNP")
export type VenusDeviceType = "IP" | "UPNP"

// role sent to the Venus OS pairing endpoint, it becomes part of the MQTT username "token/<role>/<device_id>",
// the device only accepts \w+ so no hyphens
export const venusPairingRole = "venusinfluxloader"

// key under which the pairing token of a local device is stored in secrets.json,
// prefixed with the device type to never confuse a hostName with a portalId
export function venusTokenKey(type: VenusDeviceType, key: string): string {
  return `${type}:${key}`
}
