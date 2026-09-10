import express from "express"
import auth from "basic-auth"
import compare from "tsscmp"
import { AppSecrets } from "../shared/types"

export const defaultAdminUsername = "admin"
export const defaultAdminPassword = "admin"

// express middleware enforcing HTTP basic auth against the configured login,
// falling back to the default admin credentials when no login is configured
export function createBasicAuthMiddleware(getLogin: () => AppSecrets["login"] | undefined): express.RequestHandler {
  return (req, res, next) => {
    const credentials = auth(req)
    const login = getLogin()
    if (
      !credentials ||
      compare(credentials.name, login?.username ?? defaultAdminUsername) === false ||
      compare(credentials.pass, login?.password ?? defaultAdminPassword) === false
    ) {
      res.statusCode = 401
      res.setHeader("WWW-Authenticate", 'Basic realm="venus-influx-loader"')
      res.status(401).send()
    } else {
      next()
    }
  }
}
