import React from "react"
import { useSelector } from "react-redux"
import { CCard, CCardBody, CCardHeader, CCardFooter, CForm, CButton, CFormCheck } from "@coreui/react"

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi"
import { useFormValidation, extractParameterNameAndValue } from "../../hooks/useFormValidation"
import { DeviceList } from "./DeviceList"
import { useEffect, useState } from "react"
import { AppConfig } from "../../../shared/types"
import { AppState } from "../../store"
import { WebSocketStatus } from "./WebsocketStatus"

function Discovery() {
  const [{ data: config, loading: _isLoading, error: _loadError }, _load, _cancelLoad] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()

  const showAutomaticExpirySettings = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)

  const upnpDiscovered = useSelector((state: AppState) => state.upnpDiscovered)

  const [referenceTime, setReferenceTime] = useState<number>(0)
  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setReferenceTime(Date.now())
    setTemporaryConfig(config)
    setDefaultExpiry()
  }, [config, upnpDiscovered, showAutomaticExpirySettings])

  function setDefaultExpiry() {
    if (showAutomaticExpirySettings && temporaryConfig) {
      upnpDiscovered.forEach((device) => {
        if (temporaryConfig.upnp.expiry[device.portalId] === undefined) {
          temporaryConfig.upnp.expiry[device.portalId] = referenceTime + showAutomaticExpirySettings
        }
      })
    }
  }

  function beforeSave() {
    if (temporaryConfig && !temporaryConfig.upnp.enabled) {
      temporaryConfig.upnp.expiry = {}
    }
  }

  const isSaveEnabled = useFormValidation(() => {
    return temporaryConfig !== undefined
  })

  function handleEnableChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const [name, value] = extractParameterNameAndValue(event)
    // TODO: fix this
    // @ts-expect-error
    clone.upnp[name] = value
    if (!value) {
      clone.upnp.enabledPortalIds = []
    }
    setTemporaryConfig(clone)
  }

  function handleEnablePortalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const [_name, value] = extractParameterNameAndValue(event)
    const list = clone.upnp.enabledPortalIds
    if (!value) {
      const idx = list.indexOf(event.target.id)
      if (idx !== -1) {
        list.splice(idx, 1)
      }
    } else {
      list.push(event.target.id)
    }
    clone.upnp.enabledPortalIds = list
    setTemporaryConfig(clone)
  }

  function handleEnableAllPortalsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    if (event.target.checked) {
      clone.upnp.enabledPortalIds = upnpDiscovered.map((element) => {
        return element.portalId
      })
    } else {
      clone.upnp.enabledPortalIds = []
    }
    setTemporaryConfig(clone)
  }

  function handlePortalExpiryChange(event: React.ChangeEvent<HTMLSelectElement>, portalId: string) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    if (value > 0) {
      clone.upnp.expiry[portalId] = referenceTime + value
    } else {
      clone.upnp.expiry[portalId] = 0
    }
    setTemporaryConfig(clone)
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
              label="Connection to Venus Devices Nearby"
              onChange={(event) => handleEnableChange(event)}
              checked={temporaryConfig.upnp.enabled}
            />
          </CForm>
        </CCardHeader>
        <CCardBody>
          <CForm>
            <DeviceList
              settings={temporaryConfig.upnp}
              referenceTime={referenceTime}
              expirySettings={temporaryConfig.upnp.expiry}
              availablePortalIds={upnpDiscovered}
              onEnablePortalChange={handleEnablePortalChange}
              onEnableAllPortalsChange={handleEnableAllPortalsChange}
              defaultExpiryDuration={showAutomaticExpirySettings}
              onPortalExpiryChange={handlePortalExpiryChange}
            />
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton
            color="primary"
            onClick={() => {
              beforeSave(), save({ data: temporaryConfig })
            }}
            disabled={!isSaveEnabled}
          >
            {isSaving ? "Saving..." : "Save"}
          </CButton>
        </CCardFooter>
      </CCard>
    )
  )
}

export default Discovery
