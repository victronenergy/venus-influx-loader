import React, { Component, useState } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCardFooter,
  CForm,
  CFormLabel,
  CFormInput,
  CButton,
  CFormCheck,
  CCallout,
  CContainer,
  CRow,
  CCol,
  CAlert,
} from '@coreui/react'

import { useGetConfig, usePutConfig, useVRMLogin, useVRMLogout, useVRMRefresh } from '../../hooks/useAdminApi'
import { useFormValidation, extractParameterNameAndValue } from '../../hooks/useFormValidation'
import { DeviceList } from './DeviceList'

function VRM (props) {
  const type = 'vrm'

  const [{ data: config, setData: setConfig, loading: isLoading, error: loadError }, load, cancelLoad] = useGetConfig()
  const [{ data: saveResult, loading: isSaving, error: saveError }, save, cancelSave] = usePutConfig()

  const vrmDiscovered = useSelector(state => state.vrmDiscovered)
  const vrmStatus = useSelector(state => state.vrmStatus)

  const [{ data: vrmLoginResult, loading: isVRMLoginInProgress, error: vrmLoginError }, vrmLogin, cancelVrmLogin] = useVRMLogin()
  const [{ data: vrmLogoutResult, loading: isVRMLogoutInProgress, error: vrmLogoutError }, vrmLogout, cancelVrmLogout] = useVRMLogout()
  const [{ data: vrmRefreshResult, loading: isVRMRefreshInProgress, error: vrmRefreshError }, vrmRefresh, cancelVrmRefresh] = useVRMRefresh()

  const isSaveEnabled = useFormValidation(() => {
    return (
      config
    )
  })

  function handleEnableChange (event) {
    const clone = { ...config }

    const [name, value] = extractParameterNameAndValue(event)
    clone[type][name] = value
    if (!value) {
      clone[type].enabledPortalIds = []
    }

    setConfig(clone)
  }

  function handleEnablePortalChange (event) {
    const clone = { ...config }
    const [name, value] = extractParameterNameAndValue(event)

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

  function handleEnableAllPortalsChange (event) {
    const clone = { ...config }

    console.log(`clone[type]: ${JSON.stringify(clone[type])}`)

    if (event.target.checked) {
      clone[type].enabledPortalIds = vrmDiscovered.map((element) => {
        return (element.portalId ? element.portalId : element)
      })
    } else {
      clone[type].enabledPortalIds = []
    }

    console.log(`clone[type]: ${JSON.stringify(clone[type])}`)

    setConfig(clone)
  }

  function handleVRMLogin (username, password, tokenName) {
    vrmLogin({data: {username: username, password: password, tokenName: tokenName}})
    .then(() => {
      const clone = { ...config }
      clone[type].hasToken = true
      setConfig(clone)
    })
  }

  function handleVRMLogout () {
    vrmLogout({})
    .then(() => {
      const clone = { ...config }
      clone[type].hasToken = false
      setConfig(clone)
    })
  }

  function handleVRMRefresh () {
    vrmRefresh({})
  }

  return (
    config && (
      <CCard>
        <CCardHeader>
          <CForm>
            <CFormCheck name="enabled" id="enabled" label="Enable Connection to Venus OS Devices via VRM"
              onChange={event => handleEnableChange(event)}
              checked={config[type].enabled}
            />
          </CForm>
        </CCardHeader>
        <CCardBody>
          <VRMDetails
            settings={config[type]}
            handleVRMLogin={handleVRMLogin}
            handleVRMLogout={handleVRMLogout}
            haveVRMToken={config[type].hasToken}
            loginInProgress={isVRMLoginInProgress}
            logoutInProgress={isVRMLogoutInProgress}
            vrmStatus={vrmStatus}
          />
          <CForm>
            <DeviceList
              hidden={!config[type].hasToken}
              settings={config[type]}
              availablePortalIds={vrmDiscovered}
              onEnablePortalChange={handleEnablePortalChange}
              onEnableAllPortalsChange={handleEnableAllPortalsChange}
            />
          </CForm>
          <CButton color='primary' onClick={() => handleVRMRefresh()}
            hidden={!config[type].hasToken} disabled={isVRMRefreshInProgress}>
            {isVRMRefreshInProgress ? 'Working...' : 'Refresh'}
          </CButton>
          {' '}
          <CButton color='primary' onClick={() => handleVRMLogout()}
            hidden={!config[type].hasToken}
            disabled={!config[type].hasToken}>
            {isVRMLogoutInProgress ? 'Working...' : 'Logout'}
          </CButton>
          <VRMStatus
            hidden={!config[type].hasToken}
            status={vrmStatus} />
        </CCardBody>
        <CCardFooter>
        <CButton color='primary' onClick={() => save({ data: config })} disabled={!isSaveEnabled}>
            {isSaving ? 'Saving...' : 'Save'}
          </CButton>
        </CCardFooter>
      </CCard>
    )
  )
}

VRM.propTypes = {
  vrmDiscovered: PropTypes.array,
  vrmStatus: PropTypes.object,
}

function VRMDetails (props) {
  const [state, setState] = useState({
    username: '',
    password: '',
    tokenName: `Venus Influx Loader Token (${(new Date()).toISOString()})`
  })

  const vrmStatus = useSelector(state => state.vrmStatus)

  const isLoginEnabled = useFormValidation(() => {
    return (state.username !== '' && state.password !== '' && state.tokenName !== '')
  })

  function handleFormInputChange (event) {
    const clone = { ...state }
    const [name, value] = extractParameterNameAndValue(event)
    clone[name] = value
    setState(clone)
  }

  return (
    <div>
      {!props.haveVRMToken && (
        <CForm>
          <div className="mb-3">
            <CFormLabel htmlFor="username">VRM Username</CFormLabel>
            <CFormInput type="text" name="username" placeholder=""
              value={state.username}
              onChange={(event) => handleFormInputChange(event)}
            />
          </div>
          <div className="mb-3">
            <CFormLabel htmlFor="password">VRM Password</CFormLabel>
            <CFormInput type="password" name="password" placeholder=""
              value={state.password}
              onChange={(event) => handleFormInputChange(event)}
            />
          </div>
          <div className="mb-3">
            <CFormLabel htmlFor="tokenName">VRM Token Name</CFormLabel>
            <CFormInput type="text" name="tokenName" placeholder=""
              value={state.tokenName}
              onChange={(event) => handleFormInputChange(event)}
            />
          </div>
          <CButton color='primary'
            disabled={!isLoginEnabled}
            onClick={() => props.handleVRMLogin(state.username, state.password, state.tokenName)}
          >
            {props.loginInProgress ? 'Working...' : 'Login'}
          </CButton>
        </CForm>
      )
      }
    </div>
  )
}

VRMDetails.propTypes = {
  settings: PropTypes.object,
  haveVRMToken: PropTypes.bool,
  handleVRMLogin: PropTypes.func,
  handleVRMLogout: PropTypes.func,
  loginInProgress: PropTypes.bool,
  logoutInProgress: PropTypes.bool,
  vrmStatus: PropTypes.object,
}

function VRMStatus (props) {
  return (
    <div className="pt-3">
      <CAlert hidden={props.hidden} color={props.status && props.status.status === 'success' ? 'success' : 'danger'}>
        <small>VRM Status: {props.status && props.status.message}</small>
      </CAlert>
    </div>
  )
}

VRMStatus.propTypes = {
  hidden: PropTypes.bool,
  status: PropTypes.object,
}

export default VRM
