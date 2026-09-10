import axios, { AxiosError } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VRM } from "./vrm"
import { Server } from "./server"

const tokens = [
  { name: "a", idAccessToken: "id1", lastSuccessfulAuth: 100 },
  { name: "b", idAccessToken: "id2", lastSuccessfulAuth: 50 },
]
const installations = [{ identifier: 123, name: "Home", mqtt_host: "mqtt1.victronenergy.com" }]

function createVRM(overrides: { vrmTokenId?: string; vrmEnabled?: boolean; hasToken?: boolean } = {}) {
  const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
  const server = {
    getLogger: () => logger,
    emit: vi.fn(),
    saveConfig: vi.fn(),
    saveSecrets: vi.fn(),
    secrets: {
      vrmToken: overrides.hasToken === false ? undefined : "t",
      vrmUserId: 1,
      vrmTokenId: overrides.vrmTokenId ?? "id2",
    },
    config: { vrm: { enabled: overrides.vrmEnabled ?? true } },
  } as unknown as Server
  return { vrm: new VRM(server), server }
}

function mockApi(tokenList: unknown[] = tokens) {
  return vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
    if (url.endsWith("/accesstokens/list")) return { status: 200, data: { success: true, tokens: tokenList } }
    if (url.endsWith("/installations")) return { status: 200, data: { success: true, records: installations } }
    throw new Error(`unexpected url ${url}`)
  })
}

const lastStatus = (server: Server) =>
  (server.emit as any).mock.calls.filter((c: any[]) => c[0] === "vrmStatus").at(-1)[1]

describe("VRM.refresh", () => {
  afterEach(() => vi.restoreAllMocks())

  it("does nothing without a stored token", async () => {
    const get = mockApi()
    const { vrm } = createVRM({ hasToken: false })
    await vrm.refresh()
    expect(get).not.toHaveBeenCalled()
  })

  it("prefers the token matching the stored token id", async () => {
    mockApi()
    const { vrm, server } = createVRM({ vrmTokenId: "id2" })
    await vrm.refresh()
    expect(lastStatus(server)).toMatchObject({ status: "success", tokenInfo: "b (id2)", tokenExpires: undefined })
  })

  it("falls back to the most recently authenticated token", async () => {
    mockApi()
    const { vrm, server } = createVRM({ vrmTokenId: "unknown" })
    await vrm.refresh()
    expect(lastStatus(server).tokenInfo).toBe("a (id1)")
  })

  it("emits the discovered installations", async () => {
    mockApi()
    const { vrm, server } = createVRM()
    await vrm.refresh()
    expect(server.emit).toHaveBeenCalledWith("vrmDiscovered", [
      { portalId: "123", name: "Home", address: "mqtt1.victronenergy.com" },
    ])
  })

  it("skips installations when VRM is disabled", async () => {
    const get = mockApi()
    const { vrm, server } = createVRM({ vrmEnabled: false })
    await vrm.refresh()
    expect(get).toHaveBeenCalledOnce()
    expect(server.emit).toHaveBeenCalledWith("vrmDiscovered", [])
    expect(lastStatus(server).status).toBe("failure")
  })

  it("reports an invalid token on 401", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(
      new AxiosError("Unauthorized", "ERR_BAD_REQUEST", undefined, undefined, { status: 401 } as any),
    )
    const { vrm, server } = createVRM()
    await expect(vrm.refresh()).rejects.toBeInstanceOf(AxiosError)
    expect(lastStatus(server)).toMatchObject({ status: "failure", tokenExpires: -1000 })
    expect(lastStatus(server).message).toContain("invalid or expired VRM Token")
  })

  describe("token expiry", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    })
    afterEach(() => vi.useRealTimers())

    it("converts the expiry to milliseconds relative to now", async () => {
      const expires = Date.now() / 1000 + 3600
      mockApi([{ name: "a", idAccessToken: "id2", lastSuccessfulAuth: 1, expires }])
      const { vrm, server } = createVRM()
      await vrm.refresh()
      expect(lastStatus(server).tokenExpires).toBe(3600 * 1000)
    })
  })
})

describe("VRM.loginWithToken", () => {
  afterEach(() => vi.restoreAllMocks())

  it("reports an invalid token on 401", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(
      new AxiosError("Unauthorized", "ERR_BAD_REQUEST", undefined, undefined, { status: 401 } as any),
    )
    const { vrm, server } = createVRM()
    await vrm.loginWithToken("bad").catch(() => {})
    expect(lastStatus(server).status).toBe("failure")
    expect(lastStatus(server).message).toContain("invalid or expired VRM Token")
    expect(server.saveSecrets).not.toHaveBeenCalled()
  })
})
