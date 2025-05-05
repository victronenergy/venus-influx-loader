import React from "react"
import { useState } from "react"
import { CCard, CCardBody, CCardFooter, CForm, CFormLabel, CFormInput, CButton } from "@coreui/react"

import { usePostSecurity } from "../../hooks/useAdminApi"
import { useFormValidation, extractParameterNameAndValue } from "../../hooks/useFormValidation"
import { WebSocketStatus } from "./WebsocketStatus"
import { useSelector } from "react-redux"
import { AppState } from "../../store"

interface SecurityState {
  username: string
  password: string
  password1: string
}

type SecurityStateKeys = keyof SecurityState

function Security() {
  const [state, setState] = useState({
    username: "",
    password: "",
    password1: "",
  })
  const [isStateDirty, setIsStateDirty] = useState(false)

  const [{ data: _saveResult, loading: isSaving, error: _saveError }, save, _cancelSave] = usePostSecurity()

  const isSaveEnabled = useFormValidation(() => {
    return state.username !== "" && state.password !== "" && state.password === state.password1 && isStateDirty
  })

  function handleFormInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const clone = { ...state }
    const [name, value] = extractParameterNameAndValue<SecurityStateKeys>(event)
    // TODO: fix this
    // @ts-expect-error
    clone[name] = value
    setState(clone)
    setIsStateDirty(true)
  }

  // The websocketStatus needs to be the last of the React use* hooks
  // because we return early when not connected to ws
  const websocketStatus = useSelector((state: AppState) => state.websocketStatus)
  if (websocketStatus !== "open") {
    return <WebSocketStatus websocketStatus={websocketStatus} />
  }

  return (
    <CCard>
      <CCardBody>
        <CForm>
          <div className="mb-3">
            <CFormLabel htmlFor="username">Username</CFormLabel>
            <CFormInput
              type="text"
              name="username"
              placeholder="admin"
              value={state.username}
              onChange={(event) => handleFormInputChange(event)}
            />
          </div>
          <div className="mb-3">
            <CFormLabel htmlFor="password">New Password</CFormLabel>
            <CFormInput
              type="password"
              name="password"
              placeholder="admin"
              value={state.password}
              onChange={(event) => handleFormInputChange(event)}
            />
          </div>
          <div className="mb-3">
            <CFormLabel htmlFor="password1">Confirm New Password</CFormLabel>
            <CFormInput
              type="password1"
              name="password1"
              placeholder="admin"
              value={state.password1}
              onChange={(event) => handleFormInputChange(event)}
            />
          </div>
        </CForm>
      </CCardBody>
      <CCardFooter>
        <CButton color="primary" onClick={() => save({ data: state })} disabled={!isSaveEnabled}>
          {isSaving ? "Saving..." : "Save"}
        </CButton>
      </CCardFooter>
    </CCard>
  )
}

export default Security
