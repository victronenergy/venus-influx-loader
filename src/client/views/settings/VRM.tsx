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
  CLink,
  CInputGroup,
} from "@coreui/react"

import { useGetConfig, usePutConfig, useVRMLogin, useVRMLogout, useVRMRefresh } from "../../hooks/useAdminApi"
import { useFormValidation, extractParameterNameAndValue } from "../../hooks/useFormValidation"
import { DeviceList } from "./DeviceList"
import AppDeviceSubscriptionsConfig, {
  AppConfig,
  AppVRMConfig,
  AppVRMConfigKey,
  VenusMQTTTopic,
} from "../../../shared/types"
import { AppState } from "../../store"
import { VRMDeviceType, VRMLoginRequest } from "../../../shared/api"
import { VRMStatus } from "../../../shared/state"
import { WebSocketStatus } from "./WebsocketStatus"
import {
  arrayExpiryToKeyed,
  arraySubscriptionsToKeyed,
  EditableDeviceList,
  keyedExpiryToArray,
  keyedSubscriptionsToArray,
} from "./EditableDeviceList"
import ms from "ms"

function VRM() {
  // auto load loader config on first page render
  const [{ data: config, loading: _isLoading, error: _loadError }, loadConfig, _cancelLoadConfig] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()
  const [isTemporaryConfigDirty, setIsTemporaryConfigDirty] = useState(false)

  const defaultExpiryDuration = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)
  function populateDefaultExpiry(config?: AppConfig) {
    if (config && defaultExpiryDuration) {
      vrmDiscovered.forEach((device) => {
        if (config.vrm.expiry[device.portalId] === undefined) {
          config.vrm.expiry[device.portalId] = referenceTime + defaultExpiryDuration
        }
      })
      config.vrm.manualPortalIds.forEach((device) => {
        if (config.vrm.expiry[device.portalId] === undefined) {
          config.vrm.expiry[device.portalId] = referenceTime + defaultExpiryDuration
        }
      })
    }
  }

  const vrmDiscovered = useSelector((state: AppState) => state.vrmDiscovered)
  const vrmStatus = useSelector((state: AppState) => state.vrmStatus)

  const [referenceTime, setReferenceTime] = useState<number>(0)
  const [temporaryExpiry, setTemporaryExpiry] = useState<(number | undefined)[]>([])
  const [temporarySubscriptions, setTemporarySubscriptions] = useState<AppDeviceSubscriptionsConfig>({})
  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setReferenceTime(Date.now())
    populateDefaultExpiry(config)
    setTemporaryConfig(config)
    setTemporaryExpiry(keyedExpiryToArray(config?.vrm.expiry ?? {}, config?.vrm.manualPortalIds ?? []))
    setTemporarySubscriptions(
      keyedSubscriptionsToArray(config?.vrm.subscriptions ?? {}, config?.vrm.manualPortalIds ?? []),
    )
    setIsTemporaryConfigDirty(false)
  }, [config, vrmDiscovered, defaultExpiryDuration])

  // reload loader config when notified via websocket
  const loaderSettings = useSelector((state: AppState) => state.settings)
  useEffect(() => {
    loadConfig()
  }, [loaderSettings])

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

  function beforeSave() {
    if (temporaryConfig && !temporaryConfig.vrm.enabled) {
      vrmDiscovered.forEach((device) => delete temporaryConfig.vrm.expiry[device.portalId])
    }
  }

  const isSaveEnabled = useFormValidation(() => {
    return (
      temporaryConfig !== undefined &&
      temporaryConfig.vrm.manualPortalIds.filter((x) => x.portalId === "").length === 0 &&
      isTemporaryConfigDirty
    )
  })

  async function handleVRMLogin(request: VRMLoginRequest) {
    try {
      await vrmLogin({ data: request })
      setShowStatusPane(false)
    } catch {
      setShowStatusPane(true)
    }
  }

  async function handleVRMLogout() {
    try {
      await vrmLogout({})
    } catch {
      /* empty */
    }
  }

  async function handleVRMRefresh() {
    try {
      await vrmRefresh({})
    } catch {
      /* empty */
    }
  }

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
    setIsTemporaryConfigDirty(true)
  }

  function handleEnableDiscoveredPortalChange(event: React.ChangeEvent<HTMLInputElement>) {
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
    setIsTemporaryConfigDirty(true)
  }

  function handleEnableAllDiscoveredPortalsChange(event: React.ChangeEvent<HTMLInputElement>) {
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
    setIsTemporaryConfigDirty(true)
  }

  function handleEnableConfiguredPortalChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds[index].enabled = event.target.checked
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleEnableAllConfiguredPortalsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds = clone.vrm.manualPortalIds.map((element) => {
      return { portalId: element.portalId, enabled: event.target.checked }
    })
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleAddPortal(_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds.push({ portalId: "", enabled: true })
    const newExpiry = [...temporaryExpiry, defaultExpiryDuration ? referenceTime + defaultExpiryDuration : undefined]
    clone.vrm.expiry = arrayExpiryToKeyed(newExpiry, clone.vrm.manualPortalIds, clone.vrm.expiry, vrmDiscovered)
    setTemporaryExpiry(newExpiry)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleDeletePortal(
    _event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>,
    index: number,
  ) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds.splice(index, 1)
    const newExpiry = [...temporaryExpiry]
    newExpiry.splice(index, 1)
    clone.vrm.expiry = arrayExpiryToKeyed(newExpiry, clone.vrm.manualPortalIds, clone.vrm.expiry, vrmDiscovered)
    setTemporaryExpiry(newExpiry)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handlePortalIdChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.vrm.manualPortalIds[index].portalId = event.target.value
    const newExpiry = [...temporaryExpiry]
    clone.vrm.expiry = arrayExpiryToKeyed(newExpiry, clone.vrm.manualPortalIds, clone.vrm.expiry, vrmDiscovered)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleDiscoveredPortalExpiryChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    _index: number,
    portalId: string,
  ) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    if (value > 0) {
      clone.vrm.expiry[portalId] = referenceTime + value
    } else {
      clone.vrm.expiry[portalId] = 0
    }
    clone.vrm.expiry = arrayExpiryToKeyed(temporaryExpiry, clone.vrm.manualPortalIds, clone.vrm.expiry, vrmDiscovered)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleConfiguredPortalExpiryChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    index: number,
    _portalId: string,
  ) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    const newExpiry = [...temporaryExpiry]
    newExpiry[index] = value > 0 ? referenceTime + value : 0
    clone.vrm.expiry = arrayExpiryToKeyed(newExpiry, clone.vrm.manualPortalIds, clone.vrm.expiry, vrmDiscovered)
    setTemporaryExpiry(newExpiry)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleDiscoveredPortalSubscriptionChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    _index: number,
    portalId: string,
  ) {
    const clone = { ...temporaryConfig!! }
    const value = String(event.target.value) as VenusMQTTTopic
    if (value) {
      clone.vrm.subscriptions[portalId] = [value]
    } else {
      delete clone.vrm.subscriptions[portalId]
    }
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleConfiguredPortalSubscriptionChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    index: number,
    _portalId: string,
  ) {
    const clone = { ...temporaryConfig!! }
    const value = String(event.target.value) as VenusMQTTTopic
    const newSubscriptions = { ...temporarySubscriptions!! }
    newSubscriptions[index] = [value]
    clone.vrm.subscriptions = arraySubscriptionsToKeyed(
      newSubscriptions,
      clone.vrm.manualPortalIds,
      clone.vrm.subscriptions,
      vrmDiscovered,
    )
    setTemporarySubscriptions(newSubscriptions)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

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
            <CInputGroup>
              <CFormCheck
                name="enabled"
                id="enabled"
                label="Connect to Venus Devices via VRM"
                onChange={(event) => handleEnableChange(event)}
                checked={temporaryConfig.vrm.enabled}
                className="flex-grow-1"
              />
              {temporaryConfig.vrm.hasToken && <span className="text-secondary">VRM Token: {vrmStatus.tokenInfo}</span>}
              {temporaryConfig.vrm.hasToken && vrmStatus.tokenExpires && (
                <>
                  <span className="text-secondary">, &nbsp;</span>
                  <span
                    className={
                      vrmStatus.tokenExpires < 7 * 24 * 60 * 60 * 1000
                        ? "text-danger"
                        : vrmStatus.tokenExpires < 30 * 24 * 60 * 60 * 1000
                          ? "text-warning"
                          : "text-secondary"
                    }
                  >
                    expires in: {ms(vrmStatus.tokenExpires, { long: true })}
                  </span>
                </>
              )}
            </CInputGroup>
          </CForm>
        </CCardHeader>
        <CCardBody>
          <VRMStatusPane hidden={!showStatusPane} vrmStatus={vrmStatus} />
          <VRMLoginPane
            settings={temporaryConfig.vrm}
            handleVRMLogin={handleVRMLogin}
            handleVRMLogout={handleVRMLogout}
            haveVRMToken={temporaryConfig.vrm.hasToken}
            loginInProgress={isVRMLoginInProgress}
            logoutInProgress={isVRMLogoutInProgress}
            vrmStatus={vrmStatus}
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
                    My Installations ({vrmDiscovered.length})
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
                    Other ({temporaryConfig.vrm.manualPortalIds.length})
                  </CNavLink>
                </CNavItem>
              </CNav>
              <CTabContent>
                <CTabPane role="tabpanel" visible={displayedDevices === "discovered"}>
                  <VRMStatusPane hidden={false} vrmStatus={vrmStatus} />
                  <CForm>
                    <DeviceList
                      hidden={!temporaryConfig.vrm.hasToken}
                      settings={temporaryConfig.vrm}
                      referenceTime={referenceTime}
                      expirySettings={temporaryConfig.vrm.expiry}
                      mqttSubscriptionsSettings={temporaryConfig.vrm.subscriptions}
                      availablePortalIds={vrmDiscovered}
                      onEnablePortalChange={handleEnableDiscoveredPortalChange}
                      onEnableAllPortalsChange={handleEnableAllDiscoveredPortalsChange}
                      defaultExpiryDuration={defaultExpiryDuration}
                      onPortalExpiryChange={handleDiscoveredPortalExpiryChange}
                      onPortalMQTTSubscriptionsChange={handleDiscoveredPortalSubscriptionChange}
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
                    hidden={false}
                    vrmStatus={vrmStatus}
                    overrideText="Add Installations by specifying their Portal ID"
                  />
                  <CForm>
                    <EditableDeviceList
                      entries={temporaryConfig.vrm.manualPortalIds}
                      referenceTime={referenceTime}
                      expirySettings={temporaryExpiry}
                      mqttSubscriptionsSettings={temporarySubscriptions}
                      onEntryValueChange={handlePortalIdChange}
                      onEnableEntryChange={handleEnableConfiguredPortalChange}
                      onEnableAllEntriesChange={handleEnableAllConfiguredPortalsChange}
                      onAddEntry={handleAddPortal}
                      onDeleteEntry={handleDeletePortal}
                      entryTitleText="Portal ID"
                      addEntryButtonText="Add Installation"
                      defaultExpiryDuration={defaultExpiryDuration}
                      onPortalExpiryChange={handleConfiguredPortalExpiryChange}
                      onPortalMQTTSubscriptionsChange={handleConfiguredPortalSubscriptionChange}
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
}

interface VRMDetailsState {
  token: string
}

type VRMDetailsStateKeys = keyof VRMDetailsState

function VRMLoginPane(props: VRMLoginPaneProps) {
  const [state, setState] = useState<VRMDetailsState>({
    token: "",
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
          <CForm>
            <div className="mb-3">
              <CFormLabel htmlFor="token">
                VRM Token (
                <CLink target="_blank" href="https://vrm.victronenergy.com/access-tokens">
                  Get Yours Here
                </CLink>
                )
              </CFormLabel>
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
              {props.loginInProgress ? "Working..." : "Login with VRM Token"}
            </CButton>
          </CForm>
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
  if (props.hidden == false) {
    return (
      <div className="pt-3">
        <CAlert hidden={props.hidden} color={color}>
          {override === true && <small>{props.overrideText}</small>}
          {override === false && <small>VRM Status: {props.vrmStatus && props.vrmStatus.message}</small>}
        </CAlert>
      </div>
    )
  } else {
    return null
  }
}

export default VRM
