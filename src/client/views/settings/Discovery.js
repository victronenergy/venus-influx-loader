import { useSelector } from "react-redux"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCardFooter,
  CForm,
  CButton,
  CFormCheck,
} from "@coreui/react"

import { useGetConfig, usePutConfig } from "../../hooks/useAdminApi"
import {
  useFormValidation,
  extractParameterNameAndValue,
} from "../../hooks/useFormValidation"
import { DeviceList } from "./DeviceList"

function Discovery() {
  const type = "upnp"

  const [
    {
      data: config,
      setData: setConfig,
      loading: _isLoading,
      error: _loadError,
    },
    _load,
    _cancelLoad,
  ] = useGetConfig()
  const [
    { data: _saveResult, loading: isSaving, error: _saveError },
    save,
    _cancelSave,
  ] = usePutConfig()

  const upnpDiscovered = useSelector((state) => state.upnpDiscovered)

  const isSaveEnabled = useFormValidation(() => {
    return config
  })

  function handleEnableChange(event) {
    const clone = { ...config }

    const [name, value] = extractParameterNameAndValue(event)
    clone[type][name] = value
    if (!value) {
      clone[type].enabledPortalIds = []
    }

    setConfig(clone)
  }

  function handleEnablePortalChange(event) {
    const clone = { ...config }
    const [_name, value] = extractParameterNameAndValue(event)

    const list = clone[type].enabledPortalIds
    if (!value) {
      const idx = list.indexOf(event.target.id)
      if (idx !== -1) {
        list.splice(idx, 1)
      }
    } else {
      list.push(event.target.id)
    }
    clone[type].enabledPortalIds = list

    setConfig(clone)
  }

  function handleEnableAllPortalsChange(event) {
    const clone = { ...config }

    if (event.target.checked) {
      clone[type].enabledPortalIds = upnpDiscovered.map((element) => {
        return element.portalId ? element.portalId : element
      })
    } else {
      clone[type].enabledPortalIds = []
    }

    setConfig(clone)
  }

  return (
    config && (
      <CCard>
        <CCardHeader>
          <CForm>
            <CFormCheck
              name="enabled"
              id="enabled"
              label="Enable Connection to Nearby Venus OS Devices"
              onChange={(event) => handleEnableChange(event)}
              checked={config[type].enabled}
            />
          </CForm>
        </CCardHeader>
        <CCardBody>
          <CForm>
            <DeviceList
              settings={config[type]}
              availablePortalIds={upnpDiscovered}
              onEnablePortalChange={(event) => handleEnablePortalChange(event)}
              onEnableAllPortalsChange={(event) =>
                handleEnableAllPortalsChange(event)
              }
            />
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
  )
}

export default Discovery
