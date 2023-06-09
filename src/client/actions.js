export function openServerEventsConnection (dispatch) {
  const host =
    window.location.hostname +
    ':' +
    (VENUS_INFLUX_LOADER_ADMIN_API_PORT || window.location.port)
  console.log('openServerEventsConnection: host: ' + host)
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(new URL('/stream', proto + '://' + host))
  ws.onmessage = function (event) {
    const serverEvent = JSON.parse(event.data)
    if (serverEvent.type) {
      dispatch(serverEvent)
    }
  }
  ws.onclose = () => {
    console.log('closed')
    dispatch({
      type: 'WEBSOCKET_CLOSE'
    })
  }
  ws.onerror = error => {
    console.log('error: ' + error)
    dispatch({
      type: 'WEBSOCKET_ERROR'
    })
  }
  ws.onopen = () => {
    console.log('connected')
    dispatch({
      type: 'WEBSOCKET_OPEN',
      data: ws
    })
  }
}
