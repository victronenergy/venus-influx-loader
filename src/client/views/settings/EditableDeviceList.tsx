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
import { AppDeviceConfig, AppInstallationConfig } from "../../../shared/types"
import { AutoExpiryOptionList } from "./AutoExpiryOptionList"

interface EditableDeviceListProps {
  hidden?: boolean
  entries: AppDeviceConfig[] | AppInstallationConfig[]
  onEntryValueChange: (_event: React.ChangeEvent<HTMLInputElement>, _index: number) => void
  onEnableEntryChange: (_event: React.ChangeEvent<HTMLInputElement>, _index: number) => void
  onEnableAllEntriesChange: (_event: React.ChangeEvent<HTMLInputElement>) => void
  onAddEntry: (_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) => void
  onDeleteEntry: (_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>, _index: number) => void
  entryTitleText: string
  addEntryButtonText: string
  showAutomaticExpirySettings?: number
  onPortalExpiryChange: React.ChangeEventHandler<HTMLSelectElement>
}

export function EditableDeviceList(props: EditableDeviceListProps) {
  return (
    <div>
      <CTable bordered striped hidden={props.hidden}>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>{props.entryTitleText}</CTableHeaderCell>
            {props.showAutomaticExpirySettings && <CTableHeaderCell>Auto Expire Data Collection</CTableHeaderCell>}
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
              return (
                <CTableRow key={index}>
                  <CTableDataCell>
                    <CFormInput
                      type="text"
                      name="hostName"
                      placeholder=""
                      // @ts-expect-error
                      value={element.hostName || element.portalId}
                      onChange={(event) => props.onEntryValueChange(event, index)}
                    />
                  </CTableDataCell>
                  {props.showAutomaticExpirySettings && (
                    <CTableDataCell>
                      <AutoExpiryOptionList
                        showAutomaticExpirySettings={props.showAutomaticExpirySettings}
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
