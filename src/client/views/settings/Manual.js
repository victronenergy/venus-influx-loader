import {
  CCard,
  CCardBody,
  CCardHeader,
  CCardFooter,
  CForm,
  CButton,
  CFormCheck,
} from '@coreui/react'

import { useGetConfig, usePutConfig } from '../../hooks/useAdminApi'
import {
  useFormValidation,
  extractParameterNameAndValue,
} from '../../hooks/useFormValidation'
import { EditableHostList } from './EditableHostList'

function Manual() {
  const type = 'manual'

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

  const isSaveEnabled = useFormValidation(() => {
    return (
      config && config[type].hosts.filter((x) => x.hostName === '').length === 0
    )
  })

  function handleEnableChange(event) {
    const clone = { ...config }
    const [name, value] = extractParameterNameAndValue(event)
    clone[type][name] = value
    setConfig(clone)
  }

  function handleHostNameChange(event, index) {
    const clone = { ...config }
    clone[type].hosts[index].hostName = event.target.value
    setConfig(clone)
  }

  function handleEnableHostChange(event, index) {
    const clone = { ...config }
    clone[type].hosts[index].enabled = event.target.checked
    setConfig(clone)
  }

  function handleEnableAllHostsChange(event) {
    const clone = { ...config }
    clone[type].hosts = clone[type].hosts.map((element) => {
      return { hostName: element.hostName, enabled: event.target.checked }
    })
    setConfig(clone)
  }

  function handleAddHost(_event) {
    const clone = { ...config }
    clone[type].hosts.push({ hostName: '', enabled: true })
    setConfig(clone)
  }

  function handleDeleteHost(event, index) {
    const clone = { ...config }
    clone[type].hosts.splice(index, 1)
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
              label="Enable Manual Connection to Venus OS Devices"
              onChange={(event) => handleEnableChange(event)}
              checked={config[type].enabled}
            />
          </CForm>
        </CCardHeader>
        <CCardBody>
          <CForm>
            <EditableHostList
              settings={config[type]}
              onHostNameChange={handleHostNameChange}
              onEnableHostChange={handleEnableHostChange}
              onEnableAllHostsChange={handleEnableAllHostsChange}
              onAddHost={handleAddHost}
              onDeleteHost={handleDeleteHost}
            />
          </CForm>
        </CCardBody>
        <CCardFooter>
          <CButton
            color="primary"
            onClick={() => save({ data: config })}
            disabled={!isSaveEnabled}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </CButton>
        </CCardFooter>
      </CCard>
    )
  )
}

export default Manual
