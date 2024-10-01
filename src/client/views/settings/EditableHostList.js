import PropTypes from "prop-types"
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

function EditableHostList(props) {
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
                  props.settings.hosts.filter((x) => x.enabled === false)
                    .length === 0
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
                        onChange={(event) =>
                          props.onHostNameChange(event, index)
                        }
                      />
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CFormCheck
                      name="enableHost"
                      label="Enabled"
                      onChange={(event) =>
                        props.onEnableHostChange(event, index)
                      }
                      checked={element.enabled}
                    />
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton
                      color="danger"
                      onClick={(event) => props.onDeleteHost(event, index)}
                    >
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

EditableHostList.propTypes = {
  hidden: PropTypes.bool,
  settings: PropTypes.object,
  onHostNameChange: PropTypes.func,
  onEnableHostChange: PropTypes.func,
  onEnableAllHostsChange: PropTypes.func,
  onAddHost: PropTypes.func,
  onDeleteHost: PropTypes.func,
}

export { EditableHostList }
