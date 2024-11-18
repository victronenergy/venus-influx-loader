import React from "react"
import { useEffect, useState } from "react"
import {
  CCard,
  CCardBody,
  CCardFooter,
  CForm,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CButton,
  CCol,
  CRow,
} from "@coreui/react"

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi"
import { useFormValidation, extractParameterNameAndValue } from "../../hooks/useFormValidation"
import { AppConfig } from "../../../shared/types"
import { useSelector } from "react-redux"
import { WebSocketStatus } from "./WebsocketStatus"
import { AppState } from "../../store"

function InfluxDB() {
  const [{ data: config, loading: _isLoading, error: _loadError }, _load, _cancelLoad] = useGetConfig()
  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePutConfig()
  const [isTemporaryConfigDirty, setIsTemporaryConfigDirty] = useState(false)

  const [temporaryConfig, setTemporaryConfig] = useState<AppConfig>()
  useEffect(() => {
    setTemporaryConfig(config)
    setIsTemporaryConfigDirty(false)
  }, [config])

  const isSaveEnabled = useFormValidation(() => {
    return (
      temporaryConfig !== undefined &&
      temporaryConfig.influxdb.host !== "" &&
      temporaryConfig.influxdb.port !== "" &&
      temporaryConfig.influxdb.database !== "" &&
      temporaryConfig.influxdb.retention !== "" &&
      isTemporaryConfigDirty
    )
  })

  function handleFormInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const clone = { ...temporaryConfig!!! }
    const [name, value] = extractParameterNameAndValue(event)
    // TODO: fix this
    // @ts-expect-error
    clone.influxdb[name] = value
    setTemporaryConfig(clone)
    setIsTemporaryConfigDirty(true)
  }

  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  return (
    temporaryConfig && (
      <CCard>
        <CCardBody>
          <CForm>
            <CRow>
              <CCol sm>
                <div className="mb-3">
                  <CFormLabel htmlFor="protocol">Protocol</CFormLabel>
                  <CFormSelect
                    id="protocol"
                    name="protocol"
                    value={temporaryConfig.influxdb.protocol}
                    onChange={(event) => handleFormInputChange(event)}
                  >
                    <option value="http">http</option>
                    <option value="https">https</option>
                  </CFormSelect>
                </div>
              </CCol>
              <CCol sm>
                <div className="mb-3">
                  <CFormLabel htmlFor="host">Host</CFormLabel>
                  <CFormInput
                    type="text"
                    name="host"
                    placeholder="influxdb"
                    value={temporaryConfig.influxdb.host}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
              </CCol>
              <CCol sm>
                <div className="mb-3">
                  <CFormLabel htmlFor="port">Port</CFormLabel>
                  <CFormInput
                    type="text"
                    name="port"
                    placeholder="8086"
                    value={temporaryConfig.influxdb.port}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
              </CCol>
              <CCol sm>
                <div className="mb-3">
                  <CFormLabel htmlFor="path">Path</CFormLabel>
                  <CFormInput
                    type="text"
                    name="path"
                    placeholder=""
                    value={temporaryConfig.influxdb.path}
                    onChange={(event) => handleFormInputChange(event)}
                  />
                </div>
              </CCol>
            </CRow>
            <div className="mb-3">
              <CFormLabel htmlFor="database">Database Name</CFormLabel>
              <CFormInput
                type="text"
                name="database"
                placeholder="venus"
                value={temporaryConfig.influxdb.database}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="retention">Retention</CFormLabel>
              <CFormInput
                type="text"
                name="retention"
                placeholder="30d"
                value={temporaryConfig.influxdb.retention}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="username">Username</CFormLabel>
              <CFormInput
                type="text"
                name="username"
                placeholder=""
                value={temporaryConfig.influxdb.username}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="password">Password</CFormLabel>
              <CFormInput
                type="password"
                name="password"
                placeholder=""
                value={temporaryConfig.influxdb.password}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton color="primary" onClick={() => save({ data: temporaryConfig })} disabled={!isSaveEnabled}>
            {isSaving ? "Saving..." : "Save"}
          </CButton>
        </CCardFooter>
      </CCard>
    )
  )
}

export default InfluxDB
