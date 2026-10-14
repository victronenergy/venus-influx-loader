import axios, { AxiosError, AxiosHeaders } from "axios"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildPairingDeviceId,
  describePairingError,
  pairingTimeout,
  requestVenusPairingToken,
} from "./venus-pairing.js"
import { Logger } from "winston"

const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() } as unknown as Logger

function axiosError(status?: number, code?: string, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response = status ? { status, statusText: "", headers: {}, config, data } : undefined
  return new AxiosError("boom", code, config, undefined, response as any)
}

describe("buildPairingDeviceId", () => {
  it("is alphanumeric and unique", () => {
    const a = buildPairingDeviceId()
    const b = buildPairingDeviceId()
    expect(a).toMatch(/^vil[0-9a-f]{12}$/)
    expect(a).toMatch(/^\w+$/)
    expect(a).not.toBe(b)
  })
})

describe("requestVenusPairingToken", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("posts the role and a fresh device id over https ignoring the self-signed certificate", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { token_name: "token/venusinfluxloader/vilabc", password: "s3cr4t" } })
    const result = await requestVenusPairingToken("1.2.3.4", logger)
    expect(result).toEqual({ tokenName: "token/venusinfluxloader/vilabc", password: "s3cr4t" })
    expect(post).toHaveBeenCalledTimes(1)
    const [url, body, options] = post.mock.calls[0]
    expect(url).toBe("https://1.2.3.4/auth/generate-token/")
    expect(body).toMatch(/^role=venusinfluxloader&device_id=vil[0-9a-f]{12}$/)
    expect(options?.timeout).toBe(pairingTimeout)
    expect((options?.httpsAgent as any).options.rejectUnauthorized).toBe(false)
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("s3cr4t"))
  })

  it("explains that the device is not in pairing mode on 403", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(axiosError(403))
    await expect(requestVenusPairingToken("1.2.3.4", logger)).rejects.toThrow(/pairing mode/)
  })

  it("explains that the firmware is too old on 404", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(axiosError(404))
    await expect(requestVenusPairingToken("1.2.3.4", logger)).rejects.toThrow(/3\.80/)
  })

  it("explains an unreachable device", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(axiosError(undefined, "ECONNREFUSED"))
    await expect(requestVenusPairingToken("1.2.3.4", logger)).rejects.toThrow(
      "Can not reach https://1.2.3.4: ECONNREFUSED",
    )
  })

  it("explains a timeout", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(axiosError(undefined, "ECONNABORTED"))
    await expect(requestVenusPairingToken("1.2.3.4", logger)).rejects.toThrow(/Timed out/)
  })

  it("rejects a reply without token fields", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: "<html></html>" })
    await expect(requestVenusPairingToken("1.2.3.4", logger)).rejects.toThrow(/Unexpected response/)
  })
})

describe("describePairingError", () => {
  it("passes other errors through", () => {
    expect(describePairingError("h", new Error("x"))).toBe("x")
    expect(describePairingError("h", axiosError(500))).toBe("h answered 500")
  })
})
