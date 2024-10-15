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
import { AppState } from "../../store"
import { LogEntry } from "../../../shared/types"

function Troubleshooting() {
  const log = useSelector((state: AppState) => state.log)
  const isDebugLevelEnabled = useSelector((state: AppState) => state.debug)

  const [{ }, toggleDebugLevel, _cancelToggleDebugLevel] = usePutDebug()

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
                  toggleDebugLevel({ data: { debug: event.target.checked } })
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

interface LogListProps {
  entries: LogEntry[]
}

function LogList(props: LogListProps) {
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
        {props.entries && props.entries.map((entry, index) => {
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

export default Troubleshooting
