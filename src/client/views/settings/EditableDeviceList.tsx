import React from "react"
import {
  CFormCheck,
  CTable,
  CTableHead,
  CTableBody,
  CTableHeaderCell,
  CTableDataCell,
  CTableRow,
  CFormInput,
  CButton,
} from "@coreui/react"
import { AppDataCollectionExpiryConfig, AppDeviceConfig, AppInstallationConfig } from "../../../shared/types"
import { AutoExpiryOptionList } from "./AutoExpiryOptionList"
import { DiscoveredDevice } from "../../../shared/state"

interface EditableDeviceListProps {
  hidden?: boolean
  entries: AppDeviceConfig[] | AppInstallationConfig[]
  referenceTime: number
  expirySettings: (number | undefined)[]
  onEntryValueChange: (_event: React.ChangeEvent<HTMLInputElement>, _index: number) => void
  onEnableEntryChange: (_event: React.ChangeEvent<HTMLInputElement>, _index: number) => void
  onEnableAllEntriesChange: (_event: React.ChangeEvent<HTMLInputElement>) => void
  onAddEntry: (_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) => void
  onDeleteEntry: (_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>, _index: number) => void
  entryTitleText: string
  addEntryButtonText: string
  defaultExpiryDuration?: number
  onPortalExpiryChange: (_event: React.ChangeEvent<HTMLSelectElement>, _index: number, _portalId: string) => void
}

export function EditableDeviceList(props: EditableDeviceListProps) {
  return (
    <div>
      <CTable bordered striped hidden={props.hidden}>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>{props.entryTitleText}</CTableHeaderCell>
            {props.defaultExpiryDuration && <CTableHeaderCell>Auto Expire Data Collection</CTableHeaderCell>}
            <CTableHeaderCell>
              <CFormCheck
                id="enable"
                label=""
                onChange={(event) => props.onEnableAllEntriesChange(event)}
                checked={
                  props.entries &&
                  props.entries.length > 0 &&
                  props.entries.filter((x) => x.enabled === false).length === 0
                }
              />
            </CTableHeaderCell>
            <CTableHeaderCell></CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {props.entries &&
            props.entries.map((element, index) => {
              // @ts-expect-error
              const key = element.hostName || element.portalId || ""
              return (
                <CTableRow key={index}>
                  <CTableDataCell>
                    <CFormInput
                      type="text"
                      name="hostName"
                      placeholder=""
                      value={key}
                      onChange={(event) => props.onEntryValueChange(event, index)}
                    />
                  </CTableDataCell>
                  {props.defaultExpiryDuration && (
                    <CTableDataCell>
                      <AutoExpiryOptionList
                        index={index}
                        portalId={key}
                        referenceTime={props.referenceTime}
                        configuredExpiryTime={props.expirySettings[index]}
                        defaultExpiryDuration={props.defaultExpiryDuration}
                        onSelectionDidChange={props.onPortalExpiryChange}
                      />
                    </CTableDataCell>
                  )}
                  <CTableDataCell>
                    <CFormCheck
                      name="enableHost"
                      label="Enabled"
                      onChange={(event) => props.onEnableEntryChange(event, index)}
                      checked={element.enabled}
                    />
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton color="danger" onClick={(event) => props.onDeleteEntry(event, index)}>
                      Delete
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              )
            })}
        </CTableBody>
      </CTable>
      <CButton color="primary" onClick={(event) => props.onAddEntry(event)}>
        {props.addEntryButtonText}
      </CButton>
    </div>
  )
}

export function arrayExpiryToKeyed(
  expiry: (number | undefined)[],
  devices: AppDeviceConfig[] | AppInstallationConfig[],
  existingExpiry: AppDataCollectionExpiryConfig = {},
  discoveredDevices: DiscoveredDevice[] = [],
): AppDataCollectionExpiryConfig {
  const a = discoveredDevices.map((device) => existingExpiry[device.portalId])
  // @ts-expect-error
  const b = Object.fromEntries(devices.map((device, i) => [device.hostName ?? device.portalId, expiry[i]]))
  return { ...a, ...b }
}

export function keyedExpiryToArray(
  expiry: AppDataCollectionExpiryConfig,
  devices: AppDeviceConfig[] | AppInstallationConfig[],
): (number | undefined)[] {
  // @ts-expect-error
  return devices.map((device) => expiry[device.hostName ?? device.portalId])
}
