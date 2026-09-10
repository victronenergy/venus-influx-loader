import { describe, expect, it, vi } from "vitest"
import { createBasicAuthMiddleware } from "./auth"

function basic(user: string, pass: string) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64")
}

function invoke(getLogin: () => { username: string; password: string } | undefined, authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as any
  const res = { statusCode: 200, setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any
  const next = vi.fn()
  createBasicAuthMiddleware(getLogin)(req, res, next)
  return { res, next }
}

function expectUnauthorized({ res, next }: ReturnType<typeof invoke>) {
  expect(next).not.toHaveBeenCalled()
  expect(res.statusCode).toBe(401)
  expect(res.setHeader).toHaveBeenCalledWith("WWW-Authenticate", 'Basic realm="venus-influx-loader"')
  expect(res.status).toHaveBeenCalledWith(401)
  expect(res.send).toHaveBeenCalled()
}

describe("createBasicAuthMiddleware", () => {
  const login = () => ({ username: "user", password: "secret" })

  it("rejects requests without credentials", () => {
    expectUnauthorized(invoke(login))
  })

  it("rejects a wrong username", () => {
    expectUnauthorized(invoke(login, basic("other", "secret")))
  })

  it("rejects a wrong password", () => {
    expectUnauthorized(invoke(login, basic("user", "nope")))
  })

  it("calls next() for valid credentials", () => {
    const { res, next } = invoke(login, basic("user", "secret"))
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("falls back to admin/admin when no login is configured", () => {
    expect(invoke(() => undefined, basic("admin", "admin")).next).toHaveBeenCalledOnce()
  })

  it("does not accept admin/admin once a login is configured", () => {
    expectUnauthorized(invoke(login, basic("admin", "admin")))
  })
})
