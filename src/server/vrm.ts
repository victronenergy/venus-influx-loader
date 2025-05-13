import axios, { AxiosError } from "axios"
import { Server } from "./server"
import { Logger } from "winston"
import ms from "ms"

const apiUrl = "https://vrmapi.victronenergy.com/v2"

interface VRMAPIUsersInstallationsRecord {
  identifier: string
  name: string
  mqtt_host: string
}

interface VRMAPIUsersInstallations {
  success: boolean
  errors: any
  records: VRMAPIUsersInstallationsRecord[]
}

interface VRMAPIUsersTokensRecord {
  name: string
  idAccessToken: string
  lastSuccessfulAuth: number
  expires?: number
}

interface VRMAPIUsersTokens {
  success: boolean
  errors: any
  tokens: VRMAPIUsersTokensRecord[]
}

interface VRMAPIUsersSiteId {
  success: boolean
  errors: any
  records: {
    site_id: string
  }
}

export class VRM {
  server: Server
  logger: Logger

  constructor(server: Server) {
    this.server = server
    this.logger = server.getLogger("vrm")
  }

  good(msg: string, tokenInfo: string = "", tokenExpires?: number) {
    this.server.emit("vrmStatus", { status: "success", message: msg, tokenInfo: tokenInfo, tokenExpires: tokenExpires })
    this.logger.info(msg)
  }

  fail(msg: string, tokenInfo: string = "", tokenExpires?: number) {
    this.server.emit("vrmStatus", { status: "failure", message: msg, tokenInfo: tokenInfo, tokenExpires: tokenExpires })
    this.logger.error(msg)
  }

  async loginWithCredentials(username: string, password: string, tokenName: string) {
    this.good("Logging into VRM with Username & Password...")

    interface VRMAPIAuthLoginResponse {
      errors: any
      token: string
      idUser: number
    }

    interface VRMAPIUsersAccessTokensCreateResponse {
      success: boolean
      errors: any
      token: string
      idAccessToken: string
    }

    try {
      // validate username & password
      const res = await axios.post(`${apiUrl}/auth/login`, {
        username: username,
        password: password,
      })
      const response: VRMAPIAuthLoginResponse = res.data
      this.logger.debug(`loginWithCredentials response: ${JSON.stringify(response)}`)

      // validate & parse response
      if (res.status == 200) {
        // if another VRM user logged in, delete previous VRM config
        if (response.idUser !== this.server.secrets.vrmUserId) {
          this.server.config.vrm.enabledPortalIds = []
          this.server.config.vrm.manualPortalIds = []
          this.server.config.vrm.expiry = {}
          this.server.config.vrm.subscriptions = {}
        }
        this.server.secrets.vrmUsername = username
        this.server.secrets.vrmUserId = response.idUser
      } else {
        throw `${JSON.stringify(response.errors)}`
      }

      this.good("Creating VRM Access Token...")

      // create access token
      const res1 = await axios.post(
        `${apiUrl}/users/${response.idUser}/accesstokens/create`,
        { name: tokenName },
        { headers: { "X-Authorization": `Bearer ${response.token}` } },
      )
      const response1: VRMAPIUsersAccessTokensCreateResponse = res1.data
      this.logger.debug(`loginWithCredentials response1: ${JSON.stringify(response1)}`)

      // validate & parse response
      if (res1.status == 200 && response1.success === true) {
        this.server.secrets.vrmToken = response1.token
        this.server.secrets.vrmTokenId = response1.idAccessToken
        this.server.config.vrm.hasToken = true
        await this.server.saveSecrets()
        await this.server.saveConfig()

        this.good("Login successful")
      } else {
        throw `${JSON.stringify(response1.errors)}`
      }
    } catch (error) {
      this.fail(`Login failed: ${error}`)
      throw error
    }
  }

  async loginWithToken(token: string) {
    this.good("Logging into VRM with Token...")

    interface VRMAPIUsersMeResponse {
      success: boolean
      errors: any
      user: {
        id: number
        name: string
        email: string
        country: string
        idAccessToken: string
      }
    }

    try {
      // validate token
      const res = await axios.get(`${apiUrl}/users/me`, {
        headers: { "X-Authorization": `Token ${token}` },
      })
      const response: VRMAPIUsersMeResponse = res.data
      this.logger.debug(`loginWithToken response: ${JSON.stringify(response)}`)

      // validate & parse response
      if (res.status == 200 && response.success === true) {
        // if another VRM user logged in, delete previous VRM config
        if (response.user.id !== this.server.secrets.vrmUserId) {
          this.server.config.vrm.enabledPortalIds = []
          this.server.config.vrm.manualPortalIds = []
          this.server.config.vrm.expiry = {}
          this.server.config.vrm.subscriptions = {}
        }
        this.server.secrets.vrmToken = token
        this.server.secrets.vrmUserId = response.user.id
        this.server.secrets.vrmUsername = response.user.email
        this.server.secrets.vrmTokenId = response.user.idAccessToken
        this.server.config.vrm.hasToken = true
        await this.server.saveSecrets()
        await this.server.saveConfig()
        this.good("Login successful")
      } else {
        throw `${JSON.stringify(response.errors)}`
      }
    } catch (error) {
      var reason = `${error}`
      if (error instanceof AxiosError && error.status === 401) {
        reason = `invalid or expired VRM Token (${error})`
      }
      this.fail(`Login failed: ${reason}`)
      throw error
    }
  }

  async logout() {
    this.logger.info("Logging out of VRM")

    try {
      // logout
      const _res = await axios.get(`${apiUrl}/auth/logout`, {
        headers: { "X-Authorization": `Token ${this.server.secrets.vrmToken}` },
      })
    } catch (error) {
      this.fail(`Logout failed: ${error}`)
    }

    // NOTE: we do not check the response code,
    // delete vrm token, but leave vrm username + config around
    // so that new VRM login with fresh token will retain the config
    // if the vrmUserId matches previous config
    delete this.server.secrets.vrmToken
    delete this.server.secrets.vrmTokenId
    this.server.config.vrm.hasToken = false
    await this.server.saveSecrets()
    await this.server.saveConfig()
  }

  async refresh() {
    if (this.server.secrets.vrmToken === undefined || this.server.secrets.vrmUserId === undefined) {
      return
    }

    this.good("Validating VRM Token...")
    let tokenInfo: string
    let tokenExpires: number | undefined
    try {
      const res = await axios.get(`${apiUrl}/users/${this.server.secrets.vrmUserId}/accesstokens/list`, {
        headers: { "X-Authorization": `Token ${this.server.secrets.vrmToken}` },
      })
      const response: VRMAPIUsersTokens = res.data
      this.logger.debug(`refresh /accesstokens response: ${JSON.stringify(response)}`)

      if (res.status === 200 && response.tokens?.length > 0) {
        const tokens = response.tokens.sort((a, b) => {
          return b.lastSuccessfulAuth - a.lastSuccessfulAuth
        })
        const matching = tokens.filter((token) => token.idAccessToken == this.server.secrets.vrmTokenId)
        const token = matching.length >= 1 ? matching[0] : tokens[0]
        tokenInfo = `${token.name} (${token.idAccessToken})`
        tokenExpires = token.expires ? token.expires * 1000 - Date.now() : undefined
        this.good(
          `VRM Token Validated, expires: ${tokenExpires ? ms(tokenExpires, { long: true }) : "never"}`,
          tokenInfo,
          tokenExpires,
        )
      } else {
        throw `${JSON.stringify(response.errors)}`
      }
    } catch (error) {
      var reason = `${error}`
      if (error instanceof AxiosError && error.status === 401) {
        reason = `invalid or expired VRM Token (${error})`
      }
      this.fail(`Validating VRM Token failed: ${reason}`, ``, -1000)
      throw error
    }

    if (!this.server.config.vrm.enabled) {
      this.server.emit("vrmDiscovered", [])
      this.fail("Connection to Venus Devices via VRM is disabled", tokenInfo, tokenExpires)
      return
    }

    this.good("Getting installations...", tokenInfo, tokenExpires)

    try {
      const res = await axios.get(`${apiUrl}/users/${this.server.secrets.vrmUserId}/installations`, {
        headers: { "X-Authorization": `Token ${this.server.secrets.vrmToken}` },
      })
      const response: VRMAPIUsersInstallations = res.data
      this.logger.debug(`refresh /installations response: ${JSON.stringify(response)}`)

      if (res.status === 200) {
        const devices = response.records.map((record) => {
          return { portalId: String(record.identifier), name: record.name, address: record.mqtt_host }
        })
        this.server.emit("vrmDiscovered", devices)
        this.good("Installations Retrieved", tokenInfo, tokenExpires)
      } else {
        throw `${JSON.stringify(response.errors)}`
      }
    } catch (error) {
      this.fail(`Getting installations failed: ${error}`, tokenInfo, tokenExpires)
      throw error
    }
  }

  async getInstallationName(portalId: string, logger: Logger): Promise<string | undefined> {
    if (this.server.secrets.vrmToken === undefined || this.server.secrets.vrmUserId === undefined) {
      return undefined
    }

    logger.info(`get installationName...`)

    let siteId: string
    let installationName: string

    // get siteId from portalId
    try {
      const res = await axios.post(
        `${apiUrl}/users/${this.server.secrets.vrmUserId}/get-site-id`,
        { installation_identifier: portalId },
        { headers: { "X-Authorization": `Token ${this.server.secrets.vrmToken}` } },
      )
      const response: VRMAPIUsersSiteId = res.data
      if (res.status === 200 && response.success) {
        siteId = response.records.site_id
      } else {
        logger.error(`get installationName failed: ${JSON.stringify(response.errors)}`)
        return undefined
      }
    } catch (error) {
      logger.error(`get installationName failed: ${error}`)
      return undefined
    }

    // get installationName for siteId
    try {
      const res = await axios.get(`${apiUrl}/users/${this.server.secrets.vrmUserId}/installations`, {
        headers: { "X-Authorization": `Token ${this.server.secrets.vrmToken}` },
        params: { idSite: siteId },
      })
      const response: VRMAPIUsersInstallations = res.data
      if (res.status === 200 && response.success && response.records.length == 1) {
        installationName = response.records[0].name
      } else {
        logger.error(`get installationName failed: ${JSON.stringify(response.errors)}`)
        return undefined
      }
    } catch (error) {
      logger.error(`get installationName failed: ${error}`)
      return undefined
    }

    logger.info(`installationName: "${installationName}"`)
    return installationName
  }
}
