import { LoggerMock, ServerMock } from "./server"
import { Client } from "node-ssdp"
import axios from "axios"
import { parseString as parseXml } from "xml2js"
import { DiscoveredDevice } from "../shared/state"

export class UPNP {
  server: ServerMock
  logger: LoggerMock
  client: Client
  private _isRunning: boolean = false

  constructor(server: ServerMock) {
    this.server = server
    this.logger = server.getLogger("upnp")
    this.client = new Client()
  }

  info = (message: string) => this.logger.log("info", message)
  error = (message: string) => this.logger.log("error", message)

  start() {
    this.client.on("response", async (headers, _statusCode, rinfo) => {
      if (headers.USN && headers.USN.startsWith("uuid:com.victronenergy.ccgx") && headers.LOCATION) {
        try {
          const response = await axios.get(headers.LOCATION)
          const text = response.data
          const result = (await new Promise((resolve, reject) => {
            parseXml(text, (err, result) => {
              if (err) reject(err)
              else resolve(result)
            })
          })) as VenusUPNPDeviceInfo
          const device: DiscoveredDevice = {
            name: result.root.device[0].friendlyName[0],
            portalId: result.root.device[0]["ve:X_VrmPortalId"][0]._,
            address: rinfo.address,
          }
          this.info(`Found: ${device.name}, portalId: ${device.portalId}, address: ${device.address}`)
          this.server.emit("upnpDiscovered", device)
        } catch (error) {
          this.error(`${error}`)
        }
      }
    })

    this.info("Starting UPNP Discovery...")
    this._isRunning = true
    this.server.emit("upnpDiscoveryDidStart", {})
    this.client.search("urn:schemas-upnp-org:device:Basic:1")
  }

  stop() {
    this.info("Stopping UPNP Discovery")
    this._isRunning = false
    this.client.stop()
    this.server.emit("upnpDiscoveryDidStop", {})
  }

  get isRunning() {
    return this._isRunning
  }
}

interface VenusUPNPDeviceInfo {
  root: {
    device: {
      friendlyName: string[]
      "ve:X_VrmPortalId": {
        _: string
      }[]
    }[]
  }
}
