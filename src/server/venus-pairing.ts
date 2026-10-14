import axios, { AxiosError } from "axios"
import https from "node:https"
import crypto from "node:crypto"
import { Logger } from "winston"
import { venusPairingRole } from "../shared/venusConfig.js"

export const pairingTimeout = 10_000

export interface VenusPairingResult {
  tokenName: string
  password: string
}

// dbus-flashmq matches the first tokens.json entry with a given token_name, so every pairing
// must use a fresh device_id to never collide with a previous (possibly deleted) pairing
export function buildPairingDeviceId(): string {
  return `vil${crypto.randomBytes(6).toString("hex")}`
}

// Asks a Venus OS 3.80+ device for MQTT credentials. The device only answers while it is in
// pairing mode (Settings > Integrations > MQTT Devices > Pairing mode, or double-press the GX
// button, 120 seconds), and only over https with its self-signed certificate.
export async function requestVenusPairingToken(address: string, logger: Logger): Promise<VenusPairingResult> {
  const url = `https://${address}/auth/generate-token/`
  const deviceId = buildPairingDeviceId()
  logger.info(`Requesting pairing token from ${url} as ${venusPairingRole}/${deviceId}`)
  try {
    const response = await axios.post(
      url,
      new URLSearchParams({ role: venusPairingRole, device_id: deviceId }).toString(),
      {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        // Venus OS uses a self-signed certificate
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: pairingTimeout,
        responseType: "json",
      },
    )
    const data = response.data
    if (typeof data?.token_name !== "string" || typeof data?.password !== "string") {
      throw new Error(`Unexpected response from ${url}: ${JSON.stringify(data)?.slice(0, 200)}`)
    }
    logger.info(`Paired with ${address} as ${data.token_name}`)
    return { tokenName: data.token_name, password: data.password }
  } catch (error) {
    throw new Error(describePairingError(address, error), { cause: error })
  }
}

export function describePairingError(address: string, error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    if (status === 403) {
      return `${address} refused pairing (403). Put the device into pairing mode, and try again.`
    }
    if (status === 404) {
      return `${address} has no pairing endpoint (404), Venus OS 3.80 or newer is required`
    }
    if (status !== undefined) {
      return `${address} answered ${status} ${error.response?.statusText ?? ""}`.trim()
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return `Timed out connecting to https://${address} after ${pairingTimeout / 1000} seconds`
    }
    return `Can not reach https://${address}: ${error.code ?? error.message}`
  }
  return `${(error as Error)?.message ?? error}`
}
