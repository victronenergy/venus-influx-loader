import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import {
  CAlert,
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
} from "@coreui/react";

import CIcon from "@coreui/icons-react";
import { cilRss } from "@coreui/icons";

function Dashboard() {
  const { measurementRate, measurementCount, deviceStatistics } = useSelector(
    (state) => {
      return (
        state.serverStatistics || {
          measurementRate: 0,
          measurementCount: 0,
          deviceStatistics: [],
        }
      );
    },
  );
  const websocketStatus = useSelector((state) => state.websocketStatus);

  return (
    <div>
      {websocketStatus === "open" && (
        <div>
          <CCard>
            <CCardHeader>Statistics</CCardHeader>
            <CCardBody>
              <CRow>
                <CCol xs="12" md="6">
                  <CCallout color="info">
                    <small className="text-muted">
                      Total Measurement Rate (measurements/second)
                    </small>
                    <br />
                    <strong className="h4">{measurementRate.toFixed(1)}</strong>
                  </CCallout>
                </CCol>
                <CCol xs="12" md="6">
                  <CCallout color="info">
                    <small className="text-muted">
                      Total Number of Measurements
                    </small>
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
                  {Object.keys(deviceStatistics || {}).map((portalId) => {
                    const deviceStats = deviceStatistics[portalId];
                    return (
                      <CTableRow key={portalId}>
                        <CTableDataCell>
                          <CContainer>
                            <CRow className="align-items-start">
                              <CCol>
                                <CIcon
                                  className="text-muted"
                                  icon={cilRss}
                                  size="lg"
                                />{" "}
                                {deviceStats.name}
                              </CCol>
                              <CCol xs="auto">
                                <strong> {deviceStats.measurementRate} </strong>
                                (
                                {(
                                  (deviceStats.measurementRate /
                                    measurementRate) *
                                  100
                                ).toFixed(0)}
                                %)
                              </CCol>
                            </CRow>
                            <CRow className="align-items-end">
                              <CCol>
                                <CProgress
                                  className="progress-xs"
                                  color="warning"
                                  value={
                                    (deviceStats.measurementRate /
                                      measurementRate) *
                                    100
                                  }
                                />
                              </CCol>
                            </CRow>
                          </CContainer>
                        </CTableDataCell>
                      </CTableRow>
                    );
                  })}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </div>
      )}

      {websocketStatus !== "open" && (
        <CAlert color="danger">Not connected to the server</CAlert>
      )}
    </div>
  );
}

Dashboard.propTypes = {
  serverStatistics: PropTypes.object,
  websocketStatus: PropTypes.string,
};

export default Dashboard;
