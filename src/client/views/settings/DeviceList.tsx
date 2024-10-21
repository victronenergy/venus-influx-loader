import React from "react"
import { CFormCheck, CTable, CTableHead, CTableBody, CTableHeaderCell, CTableDataCell, CTableRow } from "@coreui/react"
import { AppDataCollectionExpiryConfig, AppUPNPConfig, AppVRMConfig } from "../../../shared/types"
import { DiscoveredDevice } from "../../../shared/state"
import { AutoExpiryOptionList } from "./AutoExpiryOptionList"

interface DeviceListProps {
  hidden?: boolean
  settings: AppUPNPConfig | AppVRMConfig
  referenceTime: number
  expirySettings: AppDataCollectionExpiryConfig
  onEnablePortalChange: React.ChangeEventHandler<HTMLInputElement>
  onEnableAllPortalsChange: React.ChangeEventHandler<HTMLInputElement>
  availablePortalIds: DiscoveredDevice[]
  defaultExpiryDuration?: number
  onPortalExpiryChange: (_event: React.ChangeEvent<HTMLSelectElement>, _portalId: string) => void
}

export function DeviceList(props: DeviceListProps) {
  return (
    <CTable bordered striped hidden={props.hidden}>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Installation Name</CTableHeaderCell>
          <CTableHeaderCell>Portal ID</CTableHeaderCell>
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
          props.availablePortalIds.map((element, _index) => {
            return (
              <CTableRow key={element.portalId}>
                <CTableDataCell>{element.name}</CTableDataCell>
                <CTableDataCell>{element.portalId}</CTableDataCell>
                {props.defaultExpiryDuration && (
                  <CTableDataCell>
                    <AutoExpiryOptionList
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
