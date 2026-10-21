import React from "react"
import { CFormText } from "@coreui/react"
import { AxiosError } from "axios"

// Shows why PUT /config failed, the server answers 400 with a plain text explanation
// (for example an invalid InfluxDB setting stored in config.json) or 500 when it can not save.
// the server answers errors with a plain text explanation, fall back to the transport error
export function axiosErrorDetail(error: AxiosError): string {
  return typeof error.response?.data === "string" ? error.response.data : error.message
}

export function SaveError({ error }: { error: AxiosError | null | undefined }) {
  if (!error) {
    return null
  }
  return <CFormText className="text-danger ms-3">Saving failed: {axiosErrorDetail(error)}</CFormText>
}
