import React from "react"
import { useSelector } from "react-redux"
import { CCard, CCardBody, CCardHeader, CCardFooter, CForm, CButton, CFormCheck } from "@coreui/react"

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi"
import { SaveError } from "./SaveError"
import { VenusPairingCell, VenusPairingError, VenusPairingHelp, useVenusPairing } from "./VenusPairing"
import { DiscoveredDevice } from "../../../shared/state"
import { useFormValidation, updateFormField } from "../../hooks/useFormValidation"
import { DeviceList } from "./DeviceList"
import { useEffect, useState } from "react"
import { AppConfig, VenusMQTTTopic } from "../../../shared/types"
import { AppState } from "../../store"
import { WebSocketStatus } from "./WebsocketStatus"

function Discovery() {
  // auto load loader config on first page render
  const [{ data: config, loading: _isLoading, error: _loadError }, load, _cancelLoad] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()
  const [isTemporaryConfigDirty, setIsTemporaryConfigDirty] = useState(false)

  const pairing = useVenusPairing("UPNP")

  const [referenceTime, setReferenceTime] = useState<number>(0)
  const defaultExpiryDuration = useSelector((state: AppState) => state.uiSettings.showAutomaticExpirySettings)
  function populateDefaultExpiry(config?: AppConfig) {
    if (config && defaultExpiryDuration) {
      upnpDiscovered.forEach((device) => {
        if (config.upnp.expiry[device.portalId] === undefined) {
          config.upnp.expiry[device.portalId] = referenceTime + defaultExpiryDuration
        }
      })
    }
  }

  const upnpDiscovered = useSelector((state: AppState) => state.upnpDiscovered)

  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setReferenceTime(Date.now())
    populateDefaultExpiry(config)
    setTemporaryConfig(config)
    setIsTemporaryConfigDirty(false)
  }, [config, upnpDiscovered, defaultExpiryDuration])

  // reload loader config when notified via websocket
  const loaderSettings = useSelector((state: AppState) => state.settings)
  useEffect(() => {
    load()
  }, [loaderSettings])

  function beforeSave() {
    if (temporaryConfig && !temporaryConfig.upnp.enabled) {
      temporaryConfig.upnp.expiry = {}
    }
  }

  const isSaveEnabled = useFormValidation(() => {
    return temporaryConfig !== undefined && isTemporaryConfigDirty
  })

  function handleEnableChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    clone.upnp = updateFormField(clone.upnp, event)
    if (!clone.upnp.enabled) {
      clone.upnp.enabledPortalIds = []
    }
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handleEnablePortalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const value = event.target.checked
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
    setIsTemporaryConfigDirty(true)
  }

  function handleSecurePortalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...temporaryConfig!! }
    const portalId = event.target.value
    const list = clone.upnp.securePortalIds.filter((x) => x !== portalId)
    if (event.target.checked) {
      list.push(portalId)
    }
    clone.upnp.securePortalIds = list
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  // the server pairs using the discovered address, nothing has to be saved first
  function renderPairingCell(device: DiscoveredDevice) {
    if (!temporaryConfig?.upnp.securePortalIds.includes(device.portalId)) {
      return null
    }
    return (
      <VenusPairingCell
        token={pairing.tokenOf(device.portalId)}
        canPair={true}
        busy={pairing.isBusy(device.portalId)}
        onPair={() => pairing.pair(device.portalId)}
        onUnpair={() => pairing.unpair(device.portalId)}
      />
    )
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
    setIsTemporaryConfigDirty(true)
  }

  function handlePortalSubscriptionChange(
    event: React.ChangeEvent<HTMLSelectElement>,
    _index: number,
    portalId: string,
  ) {
    const clone = { ...temporaryConfig!! }
    const value = Array.from(event.target.selectedOptions).map((option) => option.value as VenusMQTTTopic)
    if (value) {
      clone.upnp.subscriptions[portalId] = value
    } else {
      delete clone.upnp.subscriptions[portalId]
    }
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  function handlePortalExpiryChange(event: React.ChangeEvent<HTMLSelectElement>, _index: number, portalId: string) {
    const clone = { ...temporaryConfig!! }
    const value = Number(event.target.value)
    if (value > 0) {
      clone.upnp.expiry[portalId] = referenceTime + value
    } else {
      clone.upnp.expiry[portalId] = 0
    }
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  // The websocketStatus needs to be the last of the React use* hooks
  // because we return early when not connected to ws
  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  const hasSecureDevices = temporaryConfig
    ? upnpDiscovered.some((device) => temporaryConfig.upnp.securePortalIds.includes(device.portalId))
    : false

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
          <VenusPairingHelp hidden={!hasSecureDevices} />
          <VenusPairingError error={pairing.error} />
          <CForm>
            <DeviceList
              settings={temporaryConfig.upnp}
              referenceTime={referenceTime}
              expirySettings={temporaryConfig.upnp.expiry}
              mqttSubscriptionsSettings={temporaryConfig.upnp.subscriptions}
              availablePortalIds={upnpDiscovered}
              onEnablePortalChange={handleEnablePortalChange}
              onEnableAllPortalsChange={handleEnableAllPortalsChange}
              defaultExpiryDuration={defaultExpiryDuration}
              onPortalExpiryChange={handlePortalExpiryChange}
              onPortalMQTTSubscriptionsChange={handlePortalSubscriptionChange}
              securePortalIds={temporaryConfig.upnp.securePortalIds}
              onSecurePortalChange={handleSecurePortalChange}
              renderPairingCell={renderPairingCell}
            />
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton
            color="primary"
            onClick={() => {
              ;(beforeSave(), save({ data: temporaryConfig }))
            }}
            disabled={!isSaveEnabled}
          >
            {isSaving ? "Saving..." : "Save"}
          </CButton>
          <SaveError error={_saveError} />
        </CCardFooter>
      </CCard>
    )
  )
}

export default Discovery
