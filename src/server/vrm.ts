import axios from "axios"
import { Server } from "./server"
import { Logger } from "winston"

const apiUrl = "https://vrmapi.victronenergy.com/v2"

export class VRM {
  server: Server
  logger: Logger

  constructor(server: Server) {
    this.server = server
    this.logger = server.getLogger("vrm")
  }

  good(msg: string) {
    this.server.emit("vrmStatus", { status: "success", message: msg })
    this.logger.info(msg)
  }

  fail(msg: string) {
    this.server.emit("vrmStatus", { status: "failure", message: msg })
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
        this.server.secrets.vrmToken = token
        this.server.secrets.vrmUserId = response.user.id
        this.server.secrets.vrmUsername = response.user.name
        this.server.config.vrm.hasToken = true
        await this.server.saveSecrets()
        await this.server.saveConfig()
        this.good("Login successful")
      } else {
        throw `${JSON.stringify(response.errors)}`
      }
    } catch (error) {
      this.fail(`Login failed: ${error}`)
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

    // NOTE: we do not check response code,
    // we simply delete secrets, and forget enabled portals
    delete this.server.secrets.vrmToken
    delete this.server.secrets.vrmTokenId
    delete this.server.secrets.vrmUserId
    delete this.server.secrets.vrmUsername
    this.server.config.vrm.enabledPortalIds = []
    this.server.config.vrm.manualPortalIds = []
    this.server.config.vrm.hasToken = false
    await this.server.saveSecrets()
    await this.server.saveConfig()
  }

  async refresh() {
    if (this.server.secrets.vrmToken === undefined || this.server.secrets.vrmUserId === undefined) {
      return
    }

    if (!this.server.config.vrm.enabled) {
      this.server.emit("vrmDiscovered", [])
      this.fail("Connection to Venus Devices via VRM is disabled")
      return
    }

    this.good("Getting installations...")

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

    try {
      const res = await axios.get(`${apiUrl}/users/${this.server.secrets.vrmUserId}/installations`, {
        headers: { "X-Authorization": `Token ${this.server.secrets.vrmToken}` },
      })
      const response: VRMAPIUsersInstallations = res.data
      this.logger.debug(`refresh response: ${JSON.stringify(response)}`)

      if (res.status === 200) {
        const devices = response.records.map((record) => {
          return { portalId: String(record.identifier), name: record.name, address: record.mqtt_host }
        })
        this.server.emit("vrmDiscovered", devices)
        this.good("Installations Retrieved")
      } else {
        throw `${JSON.stringify(response.errors)}`
      }
    } catch (error) {
      this.fail(`Getting installations failed: ${error}`)
      throw error
    }
  }
}
