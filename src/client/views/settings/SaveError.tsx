import React from "react"
import { CFormText } from "@coreui/react"
import { AxiosError } from "axios"

// Shows why PUT /config failed, the server answers 400 with a plain text explanation
// (for example an invalid InfluxDB setting stored in config.json) or 500 when it can not save.
export function SaveError({ error }: { error: AxiosError | null | undefined }) {
  if (!error) {
    return null
  }
  const detail = typeof error.response?.data === "string" ? error.response.data : error.message
  return <CFormText className="text-danger ms-3">Saving failed: {detail}</CFormText>
}
