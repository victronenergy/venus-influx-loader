import express from "express"
import { Server } from "./server.js"
import {
  API_VENUS_PAIR,
  API_VENUS_TOKENS,
  API_VENUS_UNPAIR,
  GetVenusTokensResponse,
  VenusDeviceRequest,
  VenusPairResponse,
} from "../shared/api.js"
import { venusTokenKey } from "../shared/venusConfig.js"
import { requestVenusPairingToken } from "./venus-pairing.js"

// Pairing with local Venus OS 3.80+ devices: the obtained MQTT token is kept in secrets.json,
// the Admin UI only ever sees the token name.
export default function (server: Server) {
  const router = express.Router()
  const logger = server.getLogger("venus-pairing")

  function parseRequest(body: unknown): VenusDeviceRequest | undefined {
    const b = (body ?? {}) as Partial<VenusDeviceRequest>
    if ((b.type === "IP" || b.type === "UPNP") && typeof b.key === "string" && b.key.length > 0) {
      return { type: b.type, key: b.key }
    }
    return undefined
  }

  function publicTokens(): GetVenusTokensResponse {
    return Object.fromEntries(
      Object.entries(server.secrets.venusTokens ?? {}).map(([key, token]) => [
        key,
        { tokenName: token.tokenName, pairedAt: token.pairedAt },
      ]),
    )
  }

  router.post(`/${API_VENUS_PAIR}`, async (req, res: express.Response<VenusPairResponse | string>, _next) => {
    const request = parseRequest(req.body)
    if (!request) {
      res.status(400).send('Expected { type: "IP" | "UPNP", key }')
      return
    }
    const address = request.type === "IP" ? request.key : server.upnpDevices[request.key]?.address
    if (!address) {
      res.status(404).send(`Device ${request.key} has not been discovered`)
      return
    }
    let token
    try {
      token = await requestVenusPairingToken(address, logger)
    } catch (error) {
      logger.error(`Pairing with ${address} failed: ${(error as Error).message}`)
      res.status(400).send((error as Error).message)
      return
    }
    const pairedAt = Date.now()
    const previous = server.secrets.venusTokens
    server.secrets.venusTokens = {
      ...previous,
      [venusTokenKey(request.type, request.key)]: { ...token, pairedAt },
    }
    // saving emits secretsChanged, the loader reconnects with the new credentials
    try {
      await server.saveSecrets()
    } catch (error) {
      server.secrets.venusTokens = previous
      res.status(500).send(`${error}`)
      return
    }
    res.json({ tokenName: token.tokenName, pairedAt })
  })

  router.post(`/${API_VENUS_UNPAIR}`, async (req, res, _next) => {
    const request = parseRequest(req.body)
    if (!request) {
      res.status(400).send('Expected { type: "IP" | "UPNP", key }')
      return
    }
    const key = venusTokenKey(request.type, request.key)
    const previous = server.secrets.venusTokens
    if (previous?.[key]) {
      const { [key]: _forgotten, ...remaining } = previous
      server.secrets.venusTokens = remaining
      logger.info(`Forgot pairing token of ${key}`)
    }
    // saving emits secretsChanged, the loader disconnects as the device can no longer be reached
    try {
      await server.saveSecrets()
    } catch (error) {
      server.secrets.venusTokens = previous
      res.status(500).send(`${error}`)
      return
    }
    res.send()
  })

  router.get(`/${API_VENUS_TOKENS}`, (_req, res: express.Response<GetVenusTokensResponse>, _next) => {
    res.json(publicTokens())
  })

  return router
}
