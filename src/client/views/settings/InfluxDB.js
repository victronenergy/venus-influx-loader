import {
  CCard,
  CCardBody,
  CCardFooter,
  CForm,
  CFormLabel,
  CFormInput,
  CButton,
} from "@coreui/react";

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi";
import {
  useFormValidation,
  extractParameterNameAndValue,
} from "../../hooks/useFormValidation";

function InfluxDB() {
  const type = "influxdb";

  const [
    {
      data: config,
      setData: setConfig,
      loading: _isLoading,
      error: _loadError,
    },
    _load,
    _cancelLoad,
  ] = useGetConfig();
  const [
    { data: _saveResult, loading: isSaving, error: _saveError },
    save,
    _cancelSave,
  ] = usePutConfig();

  const isSaveEnabled = useFormValidation(() => {
    return (
      config &&
      config.influxdb.host !== "" &&
      config.influxdb.port !== "" &&
      config.influxdb.database !== "" &&
      config.influxdb.retention !== ""
    );
  });

  function handleFormInputChange(event) {
    const clone = { ...config };
    const [name, value] = extractParameterNameAndValue(event);
    clone[type][name] = value;
    setConfig(clone);
  }

  return (
    config && (
      <CCard>
        <CCardBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel htmlFor="host">Host</CFormLabel>
              <CFormInput
                type="text"
                name="host"
                placeholder="influxdb"
                value={config.influxdb.host}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="port">Port</CFormLabel>
              <CFormInput
                type="text"
                name="port"
                placeholder="8086"
                value={config.influxdb.port}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="database">Database Name</CFormLabel>
              <CFormInput
                type="text"
                name="database"
                placeholder="venus"
                value={config.influxdb.database}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="retention">Retention</CFormLabel>
              <CFormInput
                type="text"
                name="retention"
                placeholder="30d"
                value={config.influxdb.retention}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="username">Username</CFormLabel>
              <CFormInput
                type="text"
                name="username"
                placeholder=""
                value={config.influxdb.username}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="password">Password</CFormLabel>
              <CFormInput
                type="password"
                name="password"
                placeholder=""
                value={config.influxdb.password}
                onChange={(event) => handleFormInputChange(event)}
              />
            </div>
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton
            color="primary"
            onClick={() => save({ data: config })}
            disabled={!isSaveEnabled}
          >
            {isSaving ? "Saving..." : "Save"}
          </CButton>
        </CCardFooter>
      </CCard>
    )
  );
}

export default InfluxDB;
