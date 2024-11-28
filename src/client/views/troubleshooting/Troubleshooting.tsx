import { useSelector } from "react-redux"
import { useLocation } from "react-router-dom"
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
  CLink,
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

  const location = useLocation()
  const { filter } = location.state || {}

  // label filter
  const [labelFilter, setLabelFilter] = useState<string | undefined>(filter)

  const handleLabelFilterChange = (label?: string) => {
    if (label === labelFilter) {
      setLabelFilter(undefined)
    } else {
      setLabelFilter(label)
    }
  }

  // scroll to bottom on new messages
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [log, labelFilter])

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
            <CInputGroup className="d-flex align-items-center">
              <CFormCheck
                id="debug"
                label="Enable debugging"
                checked={isDebugLevelEnabled}
                onChange={(event) => toggleDebugLevel({ data: { debug: event.target.checked } })}
                className="flex-grow-1"
              />
              {labelFilter && (
                <CLink
                  href="#troubleshooting"
                  onClick={() => handleLabelFilterChange()}
                  className="text-decoration-none"
                >
                  <CBadge color="primary" shape="rounded-pill" size="sm">
                    {labelFilter}
                  </CBadge>
                </CLink>
              )}
            </CInputGroup>
          </CForm>
        </CCardHeader>
        <CCardBody className="d-flex flex-column p-0" style={{ height: "1rem" }}>
          <div className="overflow-auto always-scroll" ref={containerRef}>
            <LogList
              entries={log.entries}
              labelFilter={labelFilter}
              handleLabelFilterChange={handleLabelFilterChange}
            />
          </div>
        </CCardBody>
        <CCardFooter className="text-secondary">Last update: {lastUpdated.toLocaleString()}</CCardFooter>
      </CCard>
    )
  )
}

interface LogListProps {
  entries: LogEntry[]
  labelFilter?: string
  handleLabelFilterChange: (_label?: string) => void
}

function LogList(props: LogListProps) {
  return (
    <CTable hover className="m-0 mb-3 p-0 lh-1">
      <CTableHead color="primary" style={{ position: "sticky", top: "0" }}>
        <CTableRow>
          <CTableHeaderCell className="small text-nowrap" style={{ width: "1%" }}>
            Time
          </CTableHeaderCell>
          <CTableHeaderCell className="small text-nowrap" style={{ width: "8rem" }}>
            Label
          </CTableHeaderCell>
          <CTableHeaderCell className="small">Message</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {props.entries &&
          props.entries
            .filter((entry) => (props.labelFilter ? entry.label == props.labelFilter : entry))
            .map((entry, index) => {
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
                    <CLink
                      href="#troubleshooting"
                      onClick={() => props.handleLabelFilterChange(entry.label)}
                      className="text-decoration-none"
                    >
                      <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill" size="sm">
                        {entry.label}
                      </CBadge>
                    </CLink>
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
