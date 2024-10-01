import PropTypes from "prop-types"
import { useSelector } from "react-redux"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CInputGroup,
  CFormCheck,
  CTable,
  CTableHead,
  CTableBody,
  CTableHeaderCell,
  CTableDataCell,
  CTableRow,
} from "@coreui/react"

import { usePutDebug } from "../../hooks/useAdminApi"

function Troubleshooting() {
  const log = useSelector((state) => state.log)
  const isDebugLevelEnabled = useSelector((state) => state.debug)

  const [
    { _data, _loading, _error },
    toggleDebugLevel,
    _cancelToggleDebugLevel,
  ] = usePutDebug()

  return (
    log &&
    log.entries && (
      <CCard>
        <CCardHeader>
          <CForm>
            <CInputGroup>
              <CFormCheck
                id="debug"
                label="Enable debugging"
                checked={isDebugLevelEnabled}
                onChange={(event) =>
                  toggleDebugLevel({ data: { value: event.target.checked } })
                }
              />
            </CInputGroup>
          </CForm>
        </CCardHeader>
        <CCardBody>
          <LogList entries={log.entries} />
        </CCardBody>
      </CCard>
    )
  )
}

function LogList(props) {
  return (
    <CTable bordered>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Time</CTableHeaderCell>
          <CTableHeaderCell>Type</CTableHeaderCell>
          <CTableHeaderCell>Label</CTableHeaderCell>
          <CTableHeaderCell>Message</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {props.entries &&
          props.entries.map((entry, index) => {
            let levelClass
            if (entry.level === "error") {
              levelClass = "text-danger"
            } else if (entry.level === "info") {
              levelClass = "text-info"
            } else if (entry.level === "warn") {
              levelClass = "text-warning"
            } else {
              levelClass = "text-success"
            }

            return (
              <CTableRow key={index}>
                <CTableDataCell>{entry.timestamp}</CTableDataCell>
                <CTableDataCell>
                  <p className={levelClass}>{entry.level}</p>
                </CTableDataCell>
                <CTableDataCell>{entry.label}</CTableDataCell>
                <CTableDataCell>{entry.message}</CTableDataCell>
              </CTableRow>
            )
          })}
      </CTableBody>
    </CTable>
  )
}

LogList.propTypes = {
  entries: PropTypes.array,
}

export default Troubleshooting
