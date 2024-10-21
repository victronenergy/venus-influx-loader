import React from "react"
import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCardFooter,
  CForm,
  CFormLabel,
  CFormInput,
  CButton,
  CFormCheck,
  CAlert,
  CNavItem,
  CNav,
  CNavLink,
  CTabPane,
  CTabContent,
  CCol,
  CRow,
} from "@coreui/react"

import { useGetConfig, usePutConfig, useVRMLogin, useVRMLogout, useVRMRefresh } from "../../hooks/useAdminApi"
import { useFormValidation, extractParameterNameAndValue } from "../../hooks/useFormValidation"
import { DeviceList } from "./DeviceList"
import { AppConfig, AppVRMConfig, AppVRMConfigKey } from "../../../shared/types"
import { AppState } from "../../store"
import { VRMDeviceType, VRMLoginMethod, VRMLoginRequest } from "../../../shared/api"
import { VRMStatus } from "../../../shared/state"
import { WebSocketStatus } from "./WebsocketStatus"
import { EditableDeviceList } from "./EditableDeviceList"

function VRM() {
  const [{ data: config, loading: _isLoading, error: _loadError }, loadConfig, _cancelLoadConfig] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()

  const showAutomaticExpirySettings = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)

  const vrmDiscovered = useSelector((state: AppState) => state.vrmDiscovered)
  const vrmStatus = useSelector((state: AppState) => state.vrmStatus)

  const [referenceTime, setReferenceTime] = useState<number>(0)
  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setReferenceTime(Date.now())
    setTemporaryConfig(config)
    setDefaultExpiry()
    setShowStatusPane(config?.vrm.hasToken || false)
  }, [config, vrmDiscovered, showAutomaticExpirySettings])

  const [{ data: _vrmLoginResult, loading: isVRMLoginInProgress, error: _vrmLoginError }, vrmLogin, _cancelVrmLogin] =
    useVRMLogin()
  const [
    { data: _vrmLogoutResult, loading: isVRMLogoutInProgress, error: _vrmLogoutError },
    vrmLogout,
    _cancelVrmLogout,
  ] = useVRMLogout()
  const [
    { data: _vrmRefreshResult, loading: isVRMRefreshInProgress, error: _vrmRefreshError },
    vrmRefresh,
    _cancelVrmRefresh,
  ] = useVRMRefresh()

  function setDefaultExpiry() {
    if (showAutomaticExpirySettings && temporaryConfig) {
      vrmDiscovered.forEach((device) => {
        if (temporaryConfig.vrm.expiry[device.portalId] === undefined) {
          temporaryConfig.vrm.expiry[device.portalId] = referenceTime + showAutomaticExpirySettings
        }
      })
      temporaryConfig.vrm.manualPortalIds.forEach((device) => {
        if (temporaryConfig.vrm.expiry[device.portalId] === undefined) {
          temporaryConfig.vrm.expiry[device.portalId] = referenceTime + showAutomaticExpirySettings
        }
      })
    }
  }

  function beforeSave() {
    if (temporaryConfig && !temporaryConfig.vrm.enabled) {
      vrmDiscovered.forEach((device) => delete temporaryConfig.vrm.expiry[device.portalId])
    }
  }

  const isSaveEnabled = useFormValidation(() => {
    return (
      temporaryConfig !== undefined && temporaryConfig.vrm.manualPortalIds.filter((x) => x.portalId === "").length === 0
    )
  })

  function handleEnableChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const [name, value] = extractParameterNameAndValue<AppVRMConfigKey>(event)

    // TODO: fix this
    // @ts-expect-error
    clone.vrm[name] = value
    if (!value) {
      clone.vrm.enabledPortalIds = []
    }

    setTemporaryConfig(clone)
  }

  function handleEnablePortalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const [_name, value] = extractParameterNameAndValue<AppVRMConfigKey>(event)

    const list = clone.vrm.enabledPortalIds
    if (!value) {
      const idx = list.indexOf(event.target.id)
      if (idx !== -1) {
        list.splice(idx, 1)
      }
    } else {
      list.push(event.target.id)
    }
    clone.vrm.enabledPortalIds = list

    setTemporaryConfig(clone)
  }

  function handleEnableAllPortalsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }

    if (event.target.checked) {
      // TODO: fix this
      // @ts-expect-error
      clone.vrm.enabledPortalIds = vrmDiscovered.map((element) => {
        return element.portalId ? element.portalId : element
      })
    } else {
      clone.vrm.enabledPortalIds = []
    }

    setTemporaryConfig(clone)
  }

  function handleVRMLogin(request: VRMLoginRequest) {
    vrmLogin({ data: request })
      .then(() => {
        loadConfig()
      })
      .catch((_error) => {
        setShowStatusPane(true)
      })
  }

  function handleVRMLogout() {
    vrmLogout({})
      .then(() => {
        loadConfig()
      })
      .catch((_error) => {
        setShowStatusPane(true)
      })
  }

  function handleVRMRefresh() {
    vrmRefresh({})
      .then(() => {
        loadConfig()
      })
      .catch((_error) => {
        setShowStatusPane(true)
      })
  }

  function handleAddPortal(_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds.push({ portalId: "", enabled: true })
    setTemporaryConfig(clone)
  }

  function handleDeletePortal(
    _event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>,
    index: number,
  ) {
    const clone = { ...temporaryConfig!! }
    const previousPortalId = clone.vrm.manualPortalIds[index].portalId
    if (previousPortalId) {
      delete clone.vrm.expiry[previousPortalId]
    }
    clone.vrm.manualPortalIds.splice(index, 1)
    setTemporaryConfig(clone)
  }

  function handlePortalIdChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    const previousPortalId = clone.vrm.manualPortalIds[index].portalId
    const newPortalId = event.target.value
    const expiry = clone.vrm.expiry[previousPortalId]
    clone.vrm.manualPortalIds[index].portalId = newPortalId
    clone.vrm.expiry[newPortalId] = expiry
    delete clone.vrm.expiry[previousPortalId]
    setTemporaryConfig(clone)
  }

  function handleEnableHostChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds[index].enabled = event.target.checked
    setTemporaryConfig(clone)
  }

  function handleEnableAllHostsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds = clone.vrm.manualPortalIds.map((element) => {
      return { portalId: element.portalId, enabled: event.target.checked }
    })
    setTemporaryConfig(clone)
  }

  function handlePortalExpiryChange(event: React.ChangeEvent<HTMLSelectElement>, portalId: string) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    if (value > 0) {
      clone.vrm.expiry[portalId] = referenceTime + value
    } else {
      clone.vrm.expiry[portalId] = 0
    }
    setTemporaryConfig(clone)
  }

  const [loginMethod, setLoginMethod] = useState<VRMLoginMethod>("credentials")
  const [displayedDevices, setDisplayedDevices] = useState<VRMDeviceType>("discovered")
  const [showStatusPane, setShowStatusPane] = useState(false)

  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  return (
    temporaryConfig && (
      <CCard>
        <CCardHeader>
          <CForm>
            <CFormCheck
              name="enabled"
              id="enabled"
              label="Connect to Venus Devices via VRM"
              onChange={(event) => handleEnableChange(event)}
              checked={temporaryConfig.vrm.enabled}
            />
          </CForm>
          {!temporaryConfig.vrm.hasToken && (
            <CNav variant="underline">
              <CNavItem>
                <CNavLink
                  href="#!"
                  active={loginMethod == "credentials"}
                  onClick={(e) => {
                    e.preventDefault()
                    setLoginMethod("credentials")
                    setShowStatusPane(false)
                  }}
                >
                  With Username & Password
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink
                  href="#!"
                  active={loginMethod == "token"}
                  onClick={(e) => {
                    e.preventDefault()
                    setLoginMethod("token")
                    setShowStatusPane(false)
                  }}
                >
                  With Token
                </CNavLink>
              </CNavItem>
            </CNav>
          )}
        </CCardHeader>
        <CCardBody>
          <VRMLoginPane
            settings={temporaryConfig.vrm}
            handleVRMLogin={handleVRMLogin}
            handleVRMLogout={handleVRMLogout}
            haveVRMToken={temporaryConfig.vrm.hasToken}
            loginInProgress={isVRMLoginInProgress}
            logoutInProgress={isVRMLogoutInProgress}
            vrmStatus={vrmStatus}
            loginMethod={loginMethod}
          />
          {temporaryConfig.vrm.hasToken && (
            <>
              <CNav variant="underline">
                <CNavItem>
                  <CNavLink
                    href="#!"
                    active={displayedDevices == "discovered"}
                    onClick={(e) => {
                      e.preventDefault()
                      setDisplayedDevices("discovered")
                    }}
                  >
                    Discovered ({vrmDiscovered.length})
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink
                    href="#!"
                    active={displayedDevices == "configured"}
                    onClick={(e) => {
                      e.preventDefault()
                      setDisplayedDevices("configured")
                    }}
                  >
                    Configured ({temporaryConfig.vrm.manualPortalIds.length})
                  </CNavLink>
                </CNavItem>
              </CNav>
              <CTabContent>
                <CTabPane role="tabpanel" visible={displayedDevices === "discovered"}>
                  <VRMStatusPane hidden={!showStatusPane} vrmStatus={vrmStatus} />
                  <CForm>
                    <DeviceList
                      hidden={!temporaryConfig.vrm.hasToken}
                      settings={temporaryConfig.vrm}
                      referenceTime={referenceTime}
                      expirySettings={temporaryConfig.vrm.expiry}
                      availablePortalIds={vrmDiscovered}
                      onEnablePortalChange={handleEnablePortalChange}
                      onEnableAllPortalsChange={handleEnableAllPortalsChange}
                      defaultExpiryDuration={showAutomaticExpirySettings}
                      onPortalExpiryChange={handlePortalExpiryChange}
                    />
                  </CForm>
                  <CButton
                    color="primary"
                    onClick={() => handleVRMRefresh()}
                    hidden={!temporaryConfig.vrm.hasToken}
                    disabled={isVRMRefreshInProgress}
                  >
                    {isVRMRefreshInProgress ? "Working..." : "Refresh"}
                  </CButton>{" "}
                </CTabPane>
                <CTabPane role="tabpanel" visible={displayedDevices === "configured"}>
                  <VRMStatusPane
                    hidden={!showStatusPane}
                    vrmStatus={vrmStatus}
                    overrideText="Add Installations by specifying their Portal ID"
                  />
                  <CForm>
                    <EditableDeviceList
                      entries={temporaryConfig.vrm.manualPortalIds}
                      referenceTime={referenceTime}
                      expirySettings={temporaryConfig.vrm.expiry}
                      onEntryValueChange={handlePortalIdChange}
                      onEnableEntryChange={handleEnableHostChange}
                      onEnableAllEntriesChange={handleEnableAllHostsChange}
                      onAddEntry={handleAddPortal}
                      onDeleteEntry={handleDeletePortal}
                      entryTitleText="Portal ID"
                      addEntryButtonText="Add Installation"
                      defaultExpiryDuration={showAutomaticExpirySettings}
                      onPortalExpiryChange={handlePortalExpiryChange}
                    />
                  </CForm>
                </CTabPane>
              </CTabContent>
            </>
          )}
        </CCardBody>
        <CCardFooter>
          <CRow>
            <CCol>
              <CButton
                color="primary"
                onClick={() => {
                  beforeSave(), save({ data: temporaryConfig })
                }}
                disabled={!isSaveEnabled}
              >
                {isSaving ? "Saving..." : "Save"}
              </CButton>
            </CCol>
            <CCol xs="auto">
              <CButton
                color="primary"
                onClick={() => handleVRMLogout()}
                hidden={!temporaryConfig.vrm.hasToken}
                disabled={!temporaryConfig.vrm.hasToken}
              >
                {isVRMLogoutInProgress ? "Working..." : "Logout"}
              </CButton>
            </CCol>
          </CRow>
        </CCardFooter>
      </CCard>
    )
  )
}

interface VRMLoginPaneProps {
  settings: AppVRMConfig
  vrmDiscovered?: string[]
  vrmStatus: VRMStatus
  haveVRMToken: boolean
  handleVRMLogin: (_request: VRMLoginRequest) => void
  handleVRMLogout: () => void
  loginInProgress: boolean
  logoutInProgress: boolean
  loginMethod: VRMLoginMethod
}

interface VRMDetailsState {
  username: string
  password: string
  token: string
  tokenName: string
}

type VRMDetailsStateKeys = keyof VRMDetailsState

function VRMLoginPane(props: VRMLoginPaneProps) {
  const [state, setState] = useState<VRMDetailsState>({
    username: "",
    password: "",
    token: "",
    tokenName: `Venus Influx Loader Token (${new Date().toISOString()})`,
  })

  const isCredentialsLoginEnabled = useFormValidation(() => {
    return state.username !== "" && state.password !== "" && state.tokenName !== ""
  })

  const isTokenLoginEnabled = useFormValidation(() => {
    return state.token !== ""
  })

  function handleFormInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...state }
    const [name, value] = extractParameterNameAndValue<VRMDetailsStateKeys>(event)
    // TODO: fix this
    // @ts-expect-error
    clone[name] = value
    setState(clone)
  }

  return (
    <>
      {!props.haveVRMToken && (
        <>
          <CTabContent>
            <CTabPane role="tabpanel" visible={props.loginMethod === "credentials"}>
              <CForm>
                <div className="mb-3">
                  <CFormLabel htmlFor="username">VRM Username</CFormLabel>
                  <CFormInput
                    type="text"
                    name="username"
                    placeholder=""
                    value={state.username}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
                <div className="mb-3">
                  <CFormLabel htmlFor="password">VRM Password</CFormLabel>
                  <CFormInput
                    type="password"
                    name="password"
                    placeholder=""
                    value={state.password}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
                <div className="mb-3">
                  <CFormLabel htmlFor="tokenName">VRM Token Name</CFormLabel>
                  <CFormInput
                    type="text"
                    name="tokenName"
                    placeholder=""
                    value={state.tokenName}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
                <CButton
                  color="primary"
                  disabled={!isCredentialsLoginEnabled}
                  onClick={() =>
                    props.handleVRMLogin({
                      method: "credentials",
                      username: state.username,
                      password: state.password,
                      tokenName: state.tokenName,
                    })
                  }
                >
                  {props.loginInProgress ? "Working..." : "Login with Username & Password"}
                </CButton>
              </CForm>
            </CTabPane>
            <CTabPane role="tabpanel" visible={props.loginMethod === "token"}>
              <CForm>
                <div className="mb-3">
                  <CFormLabel htmlFor="token">VRM Token</CFormLabel>
                  <CFormInput
                    type="password"
                    name="token"
                    placeholder=""
                    value={state.token}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
                <CButton
                  color="primary"
                  disabled={!isTokenLoginEnabled}
                  onClick={() =>
                    props.handleVRMLogin({
                      method: "token",
                      token: state.token,
                    })
                  }
                >
                  {props.loginInProgress ? "Working..." : "Login with Token"}
                </CButton>
              </CForm>
            </CTabPane>
          </CTabContent>
        </>
      )}
    </>
  )
}

interface VRMStatusPaneProps {
  hidden: boolean
  vrmStatus?: VRMStatus
  overrideText?: string
}

function VRMStatusPane(props: VRMStatusPaneProps) {
  const override = props.overrideText !== undefined && props.vrmStatus && props.vrmStatus.status === "success"
  const color = props.vrmStatus && props.vrmStatus.status === "success" ? "success" : "danger"
  return (
    <div className="pt-3">
      <CAlert hidden={props.hidden} color={color}>
        {override === true && <small>{props.overrideText}</small>}
        {override === false && <small>VRM Status: {props.vrmStatus && props.vrmStatus.message}</small>}
      </CAlert>
    </div>
  )
}

export default VRM
