import React from "react"
import { CCard, CCardBody, CCardHeader, CCardFooter, CForm, CButton, CFormCheck } from "@coreui/react"

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi"
import { SaveError } from "./SaveError"
import { VenusPairingCell, VenusPairingError, VenusPairingHelp, useVenusPairing } from "./VenusPairing"
import { useFormValidation, updateFormField } from "../../hooks/useFormValidation"
import {
  arrayExpiryToKeyed,
  arraySubscriptionsToKeyed,
  EditableDeviceList,
  keyedExpiryToArray,
  keyedSubscriptionsToArray,
  validateEntries,
} from "./EditableDeviceList"
import { useEffect, useState } from "react"
import { AppConfig, AppDeviceConfig, AppInstallationConfig, VenusMQTTTopic } from "../../../shared/types"
import { WebSocketStatus } from "./WebsocketStatus"
import { useSelector } from "react-redux"
import { AppState } from "../../store"

function Manual() {
  // auto load loader config on first page render
  const [{ data: config, loading: _isLoading, error: _loadError }, load, _cancelLoad] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()
  const [isTemporaryConfigDirty, setIsTemporaryConfigDirty] = useState(false)

  const pairing = useVenusPairing("IP")
  // pairing stores the token under the hostName, so only hosts known to the server can be paired,
  // config and temporaryConfig share their hosts array so this has to be a snapshot taken on load
  const [savedHostNames, setSavedHostNames] = useState<string[]>([])

  const defaultExpiryDuration = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)
  function populateDefaultExpiry(config?: AppConfig) {
    if (config && defaultExpiryDuration) {
      config.manual.hosts.forEach((host) => {
        if (config.manual.expiry[host.hostName] === undefined) {
          config.manual.expiry[host.hostName] = referenceTime + defaultExpiryDuration
        }
      })
    }
  }

  const [referenceTime, setReferenceTime] = useState<number>(0)
  const [temporaryExpiry, setTemporaryExpiry] = useState<(number | undefined)[]>([])
  const [temporarySubscriptions, setTemporarySubscriptions] = useState<VenusMQTTTopic[][]>([])
  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  const [entriesValidity, setEntriesValidity] = useState<boolean[]>([])
  useEffect(() => {
    setReferenceTime(Date.now())
    populateDefaultExpiry(config)
    setSavedHostNames(config?.manual.hosts.map((host) => host.hostName) ?? [])
    setTemporaryConfig(config)
    setTemporaryExpiry(keyedExpiryToArray(config?.manual.expiry ?? {}, config?.manual.hosts ?? []))
    setTemporarySubscriptions(keyedSubscriptionsToArray(config?.manual.subscriptions ?? {}, config?.manual.hosts ?? []))
    revalidateEntries()
    setIsTemporaryConfigDirty(false)
  }, [config])

  // reload loader config when notified via websocket
  const loaderSettings = useSelector((state: AppState) => state.settings)
  useEffect(() => {
    load()
  }, [loaderSettings])

  const isSaveEnabled = useFormValidation(() => {
    return (
      temporaryConfig !== undefined &&
      temporaryConfig.manual.hosts.filter((x) => x.hostName === "").length === 0 &&
      entriesValidity.filter((x) => x === false).length === 0 &&
      isTemporaryConfigDirty
    )
  })

  function handleEnableChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    clone.manual = updateFormField(clone.manual, event)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleEnableHostChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts[index].enabled = event.target.checked
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleEnableAllHostsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts = clone.manual.hosts.map((element) => {
      return { ...element, enabled: event.target.checked }
    })
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleAddHost(_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts.push({ hostName: "", enabled: true })
    const newExpiry = [...temporaryExpiry, defaultExpiryDuration ? referenceTime + defaultExpiryDuration : undefined]
    clone.manual.expiry = arrayExpiryToKeyed(newExpiry, clone.manual.hosts)
    setTemporaryExpiry(newExpiry)
    setTemporaryConfig(clone)
    revalidateEntries()
    setIsTemporaryConfigDirty(true)
  }

  function handleSecureHostChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts[index].secure = event.target.checked
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function renderPairingCell(entry: AppDeviceConfig | AppInstallationConfig, index: number) {
    const host = entry as AppDeviceConfig
    if (!host.secure) {
      return null
    }
    const canPair = host.hostName !== "" && entriesValidity[index] !== false && savedHostNames.includes(host.hostName)
    return (
      <VenusPairingCell
        token={pairing.tokenOf(host.hostName)}
        canPair={canPair}
        cannotPairReason="Save the host before pairing"
        busy={pairing.isBusy(host.hostName)}
        onPair={() => pairing.pair(host.hostName)}
        onUnpair={() => pairing.unpair(host.hostName)}
      />
    )
  }

  function handleDeleteHost(
    _event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>,
    index: number,
  ) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts.splice(index, 1)
    const newExpiry = [...temporaryExpiry]
    newExpiry.splice(index, 1)
    clone.manual.expiry = arrayExpiryToKeyed(newExpiry, clone.manual.hosts)
    setTemporaryExpiry(newExpiry)
    setTemporaryConfig(clone)
    revalidateEntries()
    setIsTemporaryConfigDirty(true)
  }

  function handleHostNameChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts[index].hostName = event.target.value
    const newExpiry = [...temporaryExpiry]
    clone.manual.expiry = arrayExpiryToKeyed(newExpiry, clone.manual.hosts)
    setTemporaryConfig(clone)
    revalidateEntries()
    setIsTemporaryConfigDirty(true)
  }

  function handlePortalSubscriptionChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    index: number,
    _portalId: string,
  ) {
    const clone = { ...temporaryConfig!! }
    const value = Array.from(event.target.selectedOptions).map((option) => option.value as VenusMQTTTopic)
    const newSubscriptions = [...temporarySubscriptions]
    newSubscriptions[index] = value
    clone.manual.subscriptions = arraySubscriptionsToKeyed(newSubscriptions, clone.manual.hosts)
    setTemporarySubscriptions(newSubscriptions)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handlePortalExpiryChange(event: React.ChangeEvent<HTMLSelectElement>, index: number, _portalId: string) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    const newExpiry = [...temporaryExpiry]
    newExpiry[index] = value > 0 ? referenceTime + value : 0
    clone.manual.expiry = arrayExpiryToKeyed(newExpiry, clone.manual.hosts)
    setTemporaryExpiry(newExpiry)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function revalidateEntries() {
    setEntriesValidity(validateEntries(config?.manual.hosts.map((entry) => entry.hostName) || []))
  }

  // The websocketStatus needs to be the last of the React use* hooks
  // because we return early when not connected to ws
  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  const hasSecureHosts = temporaryConfig?.manual.hosts.some((host) => host.secure === true) ?? false

  return (
    temporaryConfig && (
      <CCard>
        <CCardHeader>
          <CForm>
            <CFormCheck
              name="enabled"
              id="enabled"
              label="Connect to Venus Devices using their Hostname or IP Address"
              onChange={(event) => handleEnableChange(event)}
              checked={temporaryConfig.manual.enabled}
            />
          </CForm>
        </CCardHeader>
        <CCardBody>
          <VenusPairingHelp hidden={!hasSecureHosts} />
          <VenusPairingError error={pairing.error} />
          <CForm>
            <EditableDeviceList
              entries={temporaryConfig.manual.hosts}
              entriesValidity={entriesValidity}
              referenceTime={referenceTime}
              expirySettings={temporaryExpiry}
              mqttSubscriptionsSettings={temporarySubscriptions}
              onEntryValueChange={handleHostNameChange}
              onEnableEntryChange={handleEnableHostChange}
              onEnableAllEntriesChange={handleEnableAllHostsChange}
              onAddEntry={handleAddHost}
              onDeleteEntry={handleDeleteHost}
              entryTitleText="Host"
              addEntryButtonText="Add Host"
              defaultExpiryDuration={defaultExpiryDuration}
              onPortalExpiryChange={handlePortalExpiryChange}
              onPortalMQTTSubscriptionsChange={handlePortalSubscriptionChange}
              onSecureEntryChange={handleSecureHostChange}
              renderPairingCell={renderPairingCell}
            />
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton color="primary" onClick={() => save({ data: temporaryConfig })} disabled={!isSaveEnabled}>
            {isSaving ? "Saving..." : "Save"}
          </CButton>
          <SaveError error={_saveError} />
        </CCardFooter>
      </CCard>
    )
  )
}

export default Manual
