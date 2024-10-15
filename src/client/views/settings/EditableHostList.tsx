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
import { AppManualConfig } from "../../../shared/types"

interface EditableHostListProps {
  hidden?: boolean
  settings: AppManualConfig
  onHostNameChange: (_event: React.ChangeEvent<HTMLInputElement>, _index: number) => void
  onEnableHostChange: (_event: React.ChangeEvent<HTMLInputElement>, _index: number) => void
  onEnableAllHostsChange: (_event: React.ChangeEvent<HTMLInputElement>) => void
  onAddHost: (_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) => void
  onDeleteHost: (_event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>, _index: number) => void
}

function EditableHostList(props: EditableHostListProps) {
  return (
    <div>
      <CTable bordered striped hidden={props.hidden}>
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Host</CTableHeaderCell>
            <CTableHeaderCell>
              <CFormCheck
                id="enable"
                label=""
                onChange={(event) => props.onEnableAllHostsChange(event)}
                checked={
                  props.settings &&
                  props.settings.hosts &&
                  props.settings.hosts.length > 0 &&
                  props.settings.hosts.filter((x) => x.enabled === false).length === 0
                }
              />
            </CTableHeaderCell>
            <CTableHeaderCell></CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {props.settings &&
            props.settings.hosts &&
            props.settings.hosts.map((element, index) => {
              return (
                <CTableRow key={index}>
                  <CTableDataCell>
                    <div className="mb-3">
                      <CFormInput
                        type="text"
                        name="hostName"
                        placeholder=""
                        value={element.hostName}
                        onChange={(event) => props.onHostNameChange(event, index)}
                      />
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CFormCheck
                      name="enableHost"
                      label="Enabled"
                      onChange={(event) => props.onEnableHostChange(event, index)}
                      checked={element.enabled}
                    />
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton color="danger" onClick={(event) => props.onDeleteHost(event, index)}>
                      Delete
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              )
            })}
        </CTableBody>
      </CTable>
      <CButton color="primary" onClick={(event) => props.onAddHost(event)}>
        Add Host
      </CButton>
    </div>
  )
}

export { EditableHostList }
