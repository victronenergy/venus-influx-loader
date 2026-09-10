import { Dispatch } from "redux"
import { AppStateAction } from "../shared/state"

export function openServerEventsConnection(dispatch: Dispatch<AppStateAction>) {
  const host = window.location.host

  console.log("openServerEventsConnection: host: " + host)
  const proto = window.location.protocol === "https:" ? "wss" : "ws"
  const ws = new WebSocket(new URL("/stream", `${proto}://${host}`))
  ws.onmessage = function (event) {
    const serverEvent = JSON.parse(event.data)
    if (serverEvent.type) {
      dispatch(serverEvent)
    }
  }
  ws.onclose = () => {
    console.log("closed")
    dispatch({
      type: "WEBSOCKET_CLOSE",
    })
  }
  ws.onerror = (error) => {
    console.log(`error: ${JSON.stringify(error)}`)
    dispatch({
      type: "WEBSOCKET_ERROR",
    })
  }
  ws.onopen = () => {
    console.log("connected")
    dispatch({
      type: "WEBSOCKET_OPEN",
      data: ws,
    })
  }
}
