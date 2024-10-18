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
  const [{ data: config, loading: _isLoading, error: _loadError }, _load, _cancelLoad] = useGetConfig()

  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()

  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setTemporaryConfig(config)
  }, [config])

  const isSaveEnabled = useFormValidation(() => {
    return temporaryConfig !== undefined && temporaryConfig.manual.hosts.filter((x) => x.hostName === "").length === 0
  })

  const showAutomaticExpirySettings = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)

  function handleEnableChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const [name, value] = extractParameterNameAndValue(event)
    // TODO: fix this
    // @ts-expect-error
    clone.manual[name] = value
    setTemporaryConfig(clone)
  }

  function handleHostNameChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts[index].hostName = event.target.value
    setTemporaryConfig(clone)
  }

  function handleEnableHostChange(event: React.ChangeEvent<HTMLInputElement>, index: number) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts[index].enabled = event.target.checked
    setTemporaryConfig(clone)
  }

  function handleEnableAllHostsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts = clone.manual.hosts.map((element) => {
      return { hostName: element.hostName, enabled: event.target.checked }
    })
    setTemporaryConfig(clone)
  }

  function handleAddHost(_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts.push({ hostName: "", enabled: true })
    setTemporaryConfig(clone)
  }

  function handleDeleteHost(
    _event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>,
    index: number,
  ) {
    const clone = { ...temporaryConfig!! }
    clone.manual.hosts.splice(index, 1)
    setTemporaryConfig(clone)
  }

  function handlePortalExpiryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    // TODO
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
              onEntryValueChange={handleHostNameChange}
              onEnableEntryChange={handleEnableHostChange}
              onEnableAllEntriesChange={handleEnableAllHostsChange}
              onAddEntry={handleAddHost}
              onDeleteEntry={handleDeleteHost}
              entryTitleText="Host"
              addEntryButtonText="Add Host"
              showAutomaticExpirySettings={showAutomaticExpirySettings}
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
