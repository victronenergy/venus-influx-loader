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
  CBadge,
  CCardFooter,
} from "@coreui/react"

import { usePutDebug } from "../../hooks/useAdminApi"
import { AppState } from "../../store"
import { LogEntry } from "../../../shared/types"
import { WebSocketStatus } from "../settings/WebsocketStatus"
import ms from "ms"
import { useEffect, useRef, useState } from "react"

function Troubleshooting() {
  const log = useSelector((state: AppState) => state.log)
  const isDebugLevelEnabled = useSelector((state: AppState) => state.debug)

  const [, toggleDebugLevel, _cancelToggleDebugLevel] = usePutDebug()

  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  // scroll to bottom on new messages
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [log])

  // re-render every 5 seconds to update timestamps
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    log &&
    log.entries && (
      <CCard className="flex-grow-1 d-flex flex-column">
        <CCardHeader>
          <CForm>
            <CInputGroup>
              <CFormCheck
                id="debug"
                label="Enable debugging"
                checked={isDebugLevelEnabled}
                onChange={(event) => toggleDebugLevel({ data: { debug: event.target.checked } })}
              />
            </CInputGroup>
          </CForm>
        </CCardHeader>
        <CCardBody className="d-flex flex-column p-0" style={{ height: "1rem" }}>
          <div className="overflow-auto always-scroll" ref={containerRef}>
            <LogList entries={log.entries} />
          </div>
        </CCardBody>
        <CCardFooter>Last update: {lastUpdated.toLocaleString()}</CCardFooter>
      </CCard>
    )
  )
}

interface LogListProps {
  entries: LogEntry[]
}

function LogList(props: LogListProps) {
  return (
    <CTable hover className="m-0 mb-3 p-0 lh-1">
      <CTableHead color="primary" style={{ position: "sticky", top: "0" }}>
        <CTableRow>
          <CTableHeaderCell>Time</CTableHeaderCell>
          <CTableHeaderCell>Label</CTableHeaderCell>
          <CTableHeaderCell>Message</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {props.entries &&
          props.entries.map((entry, index) => {
            let levelColor
            if (entry.level === "error") {
              levelColor = "danger"
            } else if (entry.level === "info") {
              levelColor = "info"
            } else if (entry.level === "warn") {
              levelColor = "warning"
            } else {
              levelColor = "success"
            }

            let timeStamp = new Date(entry.timestamp)
            let relative = timeStamp.getTime() - Date.now()

            return (
              <CTableRow key={index}>
                <CTableDataCell>
                  <CBadge shape="rounded-pill" color={levelColor} size="sm" className="me-1">
                    {ms(relative)}
                  </CBadge>
                  <CBadge shape="rounded-pill" color={levelColor} size="sm" className="me-1">
                    {entry.level}
                  </CBadge>
                  <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill" size="sm">
                    {entry.timestamp}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill" size="sm">
                    {entry.label}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <div className="small text-body-primary">{entry.message}</div>
                </CTableDataCell>
              </CTableRow>
            )
          })}
      </CTableBody>
    </CTable>
  )
}

export default Troubleshooting
