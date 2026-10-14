import React from "react"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CProgress,
  CCallout,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableRow,
  CContainer,
  CBadge,
  CLink,
} from "@coreui/react"

import CIcon from "@coreui/icons-react"
import { cilLockLocked, cilRss, cilSettings } from "@coreui/icons"
import { AppState } from "../../store"
import { WebSocketStatus } from "../settings/WebsocketStatus"
import ms from "ms"
import { TinyFilterActionButton } from "../troubleshooting/Troubleshooting"

function Dashboard() {
  const {
    measurementRate,
    distinctMeasurementsCount: measurementCount,
    deviceStatistics,
  } = useSelector((state: AppState) => {
    return (
      state.loaderStatistics || {
        measurementRate: 0,
        distinctMeasurementsCount: 0,
        deviceStatistics: [],
      }
    )
  })

  const deviceKeys = Object.keys(deviceStatistics || {}).sort()
  const adjustedMeasurementRate = measurementRate !== 0 ? measurementRate : 0.001

  const navigate = useNavigate()

  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  const handleLabelFilterChange = (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement, MouseEvent>,
    label: string,
  ) => {
    event.preventDefault()
    navigate("../troubleshooting", { replace: true, state: { filter: label } })
  }

  // settings page where this device was configured
  const settingsPage = { UPNP: "../settings/discovery", VRM: "../settings/vrm", IP: "../settings/manual" }

  return (
    <>
      <CCard>
        <CCardHeader>Statistics</CCardHeader>
        <CCardBody>
          <CRow>
            <CCol xs="12" md="6">
              <CCallout color="info">
                <small className="text-muted">Total Measurement Rate (measurements/sec)</small>
                <br />
                <strong className="h4">{measurementRate.toFixed(1)}</strong>
              </CCallout>
            </CCol>
            <CCol xs="12" md="6">
              <CCallout color="info">
                <small className="text-muted">Total Number of Measurements</small>
                <br />
                <strong className="h4">{measurementCount}</strong>
              </CCallout>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
      <br />
      <CCard>
        <CCardHeader>Device Activity</CCardHeader>
        <CCardBody>
          <CTable borderless>
            <CTableBody>
              {deviceKeys.map((key) => {
                const deviceStats = deviceStatistics[key]
                const logLabel = `${deviceStats.type}:${deviceStats.portalId ?? deviceStats.address}`
                return (
                  <CTableRow key={key}>
                    <CTableDataCell>
                      <CContainer>
                        <CRow className="align-items-start mb-1">
                          <CCol>
                            <CIcon
                              className={
                                deviceStats.hasReceivedKeepAliveConfirmation
                                  ? deviceStats.isReceivingData
                                    ? "text-success"
                                    : "text-warning"
                                  : "text-danger"
                              }
                              icon={cilRss}
                              size="lg"
                            />
                            <strong>
                              &nbsp; &nbsp;
                              {deviceStats.name || deviceStats.address}
                              &nbsp; &nbsp;
                            </strong>
                            <CLink
                              href="#"
                              onClick={(event) => handleLabelFilterChange(event, logLabel)}
                              className="text-decoration-none"
                            >
                              <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill">
                                {deviceStats.type} {deviceStats.address}
                                <TinyFilterActionButton isFilterActive={false} height={16} />
                              </CBadge>
                            </CLink>
                            &nbsp; &nbsp;
                            {deviceStats.expiry !== undefined && deviceStats.expiry > 0 && (
                              <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill">
                                Stop in {ms(deviceStats.expiry - Date.now())}
                              </CBadge>
                            )}
                            {deviceStats.secure && (
                              <>
                                &nbsp; &nbsp;
                                <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill">
                                  <CIcon icon={cilLockLocked} size="sm" /> Secured
                                </CBadge>
                              </>
                            )}
                          </CCol>
                          <CCol className="text-end" xs="auto">
                            {deviceStats.hasReceivedKeepAliveConfirmation ? (
                              <>
                                <strong> {deviceStats.measurementRate} </strong>(
                                {((deviceStats.measurementRate / adjustedMeasurementRate) * 100).toFixed(0)}%)
                                <small className="text-muted"> measurements/sec </small>
                              </>
                            ) : null}
                            &nbsp; &nbsp;
                            <CLink
                              href="#"
                              title="Settings"
                              className="text-secondary"
                              onClick={(event) => {
                                event.preventDefault()
                                navigate(settingsPage[deviceStats.type])
                              }}
                            >
                              <CIcon icon={cilSettings} size="lg" />
                            </CLink>
                          </CCol>
                        </CRow>
                        {deviceStats.lastError && (
                          <CRow className="mb-1">
                            <CCol>
                              <small className="text-danger">{deviceStats.lastError}</small>
                            </CCol>
                          </CRow>
                        )}
                        <CRow className="align-items-end">
                          <CCol>
                            <CProgress
                              className="progress-xs"
                              color="warning"
                              value={(deviceStats.measurementRate / adjustedMeasurementRate) * 100}
                            />
                          </CCol>
                        </CRow>
                      </CContainer>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Dashboard
