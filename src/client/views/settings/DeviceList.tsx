import React from "react"
import { CFormCheck, CTable, CTableHead, CTableBody, CTableHeaderCell, CTableDataCell, CTableRow } from "@coreui/react"
import AppDeviceSubscriptionsConfig, {
  AppDataCollectionExpiryConfig,
  AppUPNPConfig,
  AppVRMConfig,
} from "../../../shared/types"
import { DiscoveredDevice } from "../../../shared/state"
import { AutoExpiryOptionList } from "./AutoExpiryOptionList"
import { MQTTSubscriptionsOptionList } from "./MQTTSubscriptionsOptionList"

interface DeviceListProps {
  hidden?: boolean
  settings: AppUPNPConfig | AppVRMConfig
  referenceTime: number
  expirySettings: AppDataCollectionExpiryConfig
  subscriptionSettings: AppDeviceSubscriptionsConfig
  onEnablePortalChange: React.ChangeEventHandler<HTMLInputElement>
  onEnableAllPortalsChange: React.ChangeEventHandler<HTMLInputElement>
  availablePortalIds: DiscoveredDevice[]
  defaultExpiryDuration?: number
  onPortalSubscriptionChange: (_event: React.ChangeEvent<HTMLSelectElement>, _index: number, _portalId: string) => void
  onPortalExpiryChange: (_event: React.ChangeEvent<HTMLSelectElement>, _index: number, _portalId: string) => void
}

export function DeviceList(props: DeviceListProps) {
  return (
    <CTable bordered striped hidden={props.hidden}>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Installation Name</CTableHeaderCell>
          <CTableHeaderCell>Portal ID</CTableHeaderCell>
          <CTableHeaderCell>Subscription</CTableHeaderCell>
          {props.defaultExpiryDuration && <CTableHeaderCell>Auto Expire Data Collection</CTableHeaderCell>}
          <CTableHeaderCell>
            <CFormCheck
              id="enable"
              label=""
              onChange={props.onEnableAllPortalsChange}
              checked={
                props.availablePortalIds &&
                props.availablePortalIds.length > 0 &&
                props.settings.enabledPortalIds.length === props.availablePortalIds.length
              }
            />
          </CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {props.availablePortalIds &&
          props.availablePortalIds.map((element, index) => {
            return (
              <CTableRow key={element.portalId}>
                <CTableDataCell>{element.name}</CTableDataCell>
                <CTableDataCell>{element.portalId}</CTableDataCell>
                <CTableDataCell>
                  <MQTTSubscriptionsOptionList
                    index={index}
                    portalId={element.portalId}
                    configuredMQTTSubscriptions={props.subscriptionSettings[element.portalId]}
                    onSelectionDidChange={props.onPortalSubscriptionChange}
                  />
                </CTableDataCell>
                {props.defaultExpiryDuration && (
                  <CTableDataCell>
                    <AutoExpiryOptionList
                      index={index}
                      portalId={element.portalId}
                      referenceTime={props.referenceTime}
                      configuredExpiryTime={props.expirySettings[element.portalId]}
                      defaultExpiryDuration={props.defaultExpiryDuration}
                      onSelectionDidChange={props.onPortalExpiryChange}
                    />
                  </CTableDataCell>
                )}
                <CTableDataCell>
                  <CFormCheck
                    name="enablePortal"
                    id={element.portalId}
                    label="Enabled"
                    onChange={props.onEnablePortalChange}
                    checked={props.settings.enabledPortalIds.indexOf(element.portalId) !== -1}
                  />
                </CTableDataCell>
              </CTableRow>
            )
          })}
      </CTableBody>
    </CTable>
  )
}
