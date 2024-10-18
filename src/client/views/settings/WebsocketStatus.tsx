import { CAlert } from "@coreui/react"
import { AppWebSocketStatus } from "../../store"

interface WebSocketStatusProps {
  websocketStatus: AppWebSocketStatus
}

export function WebSocketStatus(props: WebSocketStatusProps) {
  if (props.websocketStatus !== "open") {
    return <CAlert color="danger">Not connected to the Venus Influx Loader</CAlert>
  }
  return null
}
