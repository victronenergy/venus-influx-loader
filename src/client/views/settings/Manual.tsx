import React from "react"
import { CCard, CCardBody, CCardHeader, CCardFooter, CForm, CButton, CFormCheck } from "@coreui/react"

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi"
import { useFormValidation, extractParameterNameAndValue } from "../../hooks/useFormValidation"
import { EditableDeviceList } from "./EditableDeviceList"
import { useEffect, useState } from "react"
import { AppConfig } from "../../../shared/types"
import { WebSocketStatus } from "./WebsocketStatus"
import { useSelector } from "react-redux"
import { AppState } from "../../store"

function Manual() {
  // auto load loader config on first page render
  const [{ data: config, loading: _isLoading, error: _loadError }, load, _cancelLoad] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()
  const [isTemporaryConfigDirty, setIsTemporaryConfigDirty] = useState(false)

  const defaultExpiryDuration = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)

  const [referenceTime, setReferenceTime] = useState<number>(0)
  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setReferenceTime(Date.now())
    setTemporaryConfig(config)
    setIsTemporaryConfigDirty(false)
    setDefaultExpiry()
  }, [config])

  // reload loader config when notified via websocket
  const loaderSettings = useSelector((state: AppState) => state.settings)
  useEffect(() => {
    load()
  }, [loaderSettings])

  function setDefaultExpiry() {
    if (defaultExpiryDuration && temporaryConfig) {
      temporaryConfig.manual.hosts.forEach((device) => {
        if (temporaryConfig.manual.expiry[device.hostName] === undefined) {
          temporaryConfig.manual.expiry[device.hostName] = referenceTime + defaultExpiryDuration
        }
      })
    }
  }

  const isSaveEnabled = useFormValidation(() => {
    return (
      temporaryConfig !== undefined &&
      temporaryConfig.manual.hosts.filter((x) => x.hostName === "").length === 0 &&
      isTemporaryConfigDirty
    )
  })

  function handleEnableChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const [name, value] = extractParameterNameAndValue(event)
    // TODO: fix this
    // @ts-expect-error
    clone.manual[name] = value
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleHostNameChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    const previousHostName = clone.manual.hosts[index].hostName
    const newHostName = event.target.value
    const expiry = clone.manual.expiry[previousHostName]
    clone.manual.hosts[index].hostName = newHostName
    clone.manual.expiry[newHostName] =
      expiry ?? (defaultExpiryDuration ? referenceTime + defaultExpiryDuration : undefined)
    delete clone.manual.expiry[previousHostName]
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
      return { hostName: element.hostName, enabled: event.target.checked }
    })
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleAddHost(_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts.push({ hostName: "", enabled: true })
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleDeleteHost(
    _event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>,
    index: number,
  ) {
    const clone = { ...temporaryConfig!! }
    const previousHostName = clone.manual.hosts[index].hostName
    if (previousHostName) {
      delete clone.manual.expiry[previousHostName]
    }
    clone.manual.hosts.splice(index, 1)
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handlePortalExpiryChange(event: React.ChangeEvent<HTMLSelectElement>, portalId: string) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    if (value > 0) {
      clone.manual.expiry[portalId] = referenceTime + value
    } else {
      clone.manual.expiry[portalId] = 0
    }
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

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
              label="Connect to Venus Devices using their Hostname or IP Address"
              onChange={(event) => handleEnableChange(event)}
              checked={temporaryConfig.manual.enabled}
            />
          </CForm>
        </CCardHeader>
        <CCardBody>
          <CForm>
            <EditableDeviceList
              entries={temporaryConfig.manual.hosts}
              referenceTime={referenceTime}
              expirySettings={temporaryConfig.manual.expiry}
              onEntryValueChange={handleHostNameChange}
              onEnableEntryChange={handleEnableHostChange}
              onEnableAllEntriesChange={handleEnableAllHostsChange}
              onAddEntry={handleAddHost}
              onDeleteEntry={handleDeleteHost}
              entryTitleText="Host"
              addEntryButtonText="Add Host"
              defaultExpiryDuration={defaultExpiryDuration}
              onPortalExpiryChange={handlePortalExpiryChange}
            />
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton color="primary" onClick={() => save({ data: temporaryConfig })} disabled={!isSaveEnabled}>
            {isSaving ? "Saving..." : "Save"}
          </CButton>
        </CCardFooter>
      </CCard>
    )
  )
}

export default Manual
