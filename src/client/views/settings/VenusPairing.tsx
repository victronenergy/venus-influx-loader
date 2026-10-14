import React, { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { CAlert, CButton, CLink } from "@coreui/react"
import { AxiosError } from "axios"
import { VenusTokenInfo } from "../../../shared/api"
import { VenusDeviceType, venusTokenKey } from "../../../shared/venusConfig"
import { useGetVenusTokens, useVenusPair, useVenusUnpair } from "../../hooks/useAdminApi"
import { axiosErrorDetail } from "./SaveError"
import { AppState } from "../../store"

// Secured Venus OS devices (3.80+) hand out MQTT credentials while in pairing mode,
// these components drive that flow per device row in the settings tables.

// GX manual, section "Network security profile"
const gxSecurityDocumentationUrl = "https://www.victronenergy.com/media/pg/Cerbo_GX/en/the-new-user-interface.html"

// Pairing state shared by the Discovery and Manual settings pages: the stored token names,
// which device is being paired right now, and the outcome of the last pair/unpair.
export function useVenusPairing(type: VenusDeviceType) {
  const [{ data: tokens }, loadTokens, _cancelLoad] = useGetVenusTokens()
  const [_pairState, pair, _cancelPair] = useVenusPair()
  const [_unpairState, unpair, _cancelUnpair] = useVenusUnpair()
  const [busyKey, setBusyKey] = useState<string>()
  const [error, setError] = useState<string>()

  // reload when notified via websocket, like the config
  const loaderSettings = useSelector((state: AppState) => state.settings)
  useEffect(() => {
    loadTokens()
  }, [loaderSettings])

  async function run(key: string, request: () => Promise<unknown>) {
    setBusyKey(key)
    setError(undefined)
    try {
      await request()
    } catch (e) {
      setError(`${key}: ${axiosErrorDetail(e as AxiosError)}`)
    }
    setBusyKey(undefined)
    loadTokens()
  }

  return {
    tokenOf: (key: string): VenusTokenInfo | undefined => tokens?.[venusTokenKey(type, key)],
    isBusy: (key: string) => busyKey === key,
    error,
    pair: (key: string) => run(key, () => pair({ data: { type, key } })),
    unpair: (key: string) => run(key, () => unpair({ data: { type, key } })),
  }
}

interface VenusPairingCellProps {
  token?: VenusTokenInfo
  canPair: boolean
  cannotPairReason?: string
  busy: boolean
  onPair: () => void
  onUnpair: () => void
}

export function VenusPairingCell(props: VenusPairingCellProps) {
  if (props.token) {
    return (
      <>
        <div>
          <small>
            Paired as <code>{props.token.tokenName}</code>
          </small>
        </div>
        <div>
          <small className="text-muted">{new Date(props.token.pairedAt).toLocaleString()}</small>{" "}
          <CButton color="secondary" size="sm" variant="outline" disabled={props.busy} onClick={props.onUnpair}>
            Unpair
          </CButton>
        </div>
      </>
    )
  }
  return (
    <>
      <small className="text-danger">Not paired</small>{" "}
      <CButton
        color="primary"
        size="sm"
        disabled={props.busy || !props.canPair}
        title={props.canPair ? undefined : props.cannotPairReason}
        onClick={props.onPair}
      >
        {props.busy ? "Pairing..." : "Pair"}
      </CButton>
    </>
  )
}

export function VenusPairingHelp({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return null
  }
  return (
    <CAlert color="info">
      <small>
        Monitoring secured Venus devices requires a pairing token. Put the device into pairing mode by going to{" "}
        <strong>Settings &gt; Integrations &gt; MQTT Devices &gt; Pairing mode</strong>.{" "}
        <CLink target="_blank" href={gxSecurityDocumentationUrl}>
          Learn more
        </CLink>
      </small>
    </CAlert>
  )
}

export function VenusPairingError({ error }: { error?: string }) {
  if (!error) {
    return null
  }
  return (
    <CAlert color="danger">
      <small>Pairing failed: {error}</small>
    </CAlert>
  )
}
