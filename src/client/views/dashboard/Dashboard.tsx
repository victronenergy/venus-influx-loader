import { useSelector } from "react-redux"
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
} from "@coreui/react"

import CIcon from "@coreui/icons-react"
import { cilRss } from "@coreui/icons"
import { AppState } from "../../store"
import { WebSocketStatus } from "../settings/WebsocketStatus"
import ms from "ms"

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

  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  return (
    <>
      <CCard>
        <CCardHeader>Statistics</CCardHeader>
        <CCardBody>
          <CRow>
            <CCol xs="12" md="6">
              <CCallout color="info">
                <small className="text-muted">Total Measurement Rate (measurements/second)</small>
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
                return (
                  <CTableRow key={key}>
                    <CTableDataCell>
                      <CContainer>
                        <CRow className="align-items-start mb-1">
                          <CCol>
                            <CIcon
                              className={deviceStats.isConnected ? "text-success" : "text-danger"}
                              icon={cilRss}
                              size="lg"
                            />
                            <strong>
                              &nbsp; &nbsp;
                              {deviceStats.name || deviceStats.address}
                              &nbsp; &nbsp;
                            </strong>
                            <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill">
                              {deviceStats.type} {deviceStats.address}
                            </CBadge>
                            &nbsp; &nbsp;
                            {deviceStats.expiry !== undefined && deviceStats.expiry > 0 && (
                              <CBadge textBgColor="light" textColor="secondary" shape="rounded-pill">
                                Stop in {ms(deviceStats.expiry - Date.now())}
                              </CBadge>
                            )}
                          </CCol>
                          <CCol className="text-end" xs="auto">
                            <strong> {deviceStats.measurementRate} </strong>(
                            {((deviceStats.measurementRate / adjustedMeasurementRate) * 100).toFixed(0)}
                            %)
                          </CCol>
                        </CRow>
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
