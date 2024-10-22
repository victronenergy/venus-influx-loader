import React from "react"
import { CFormSelect } from "@coreui/react"
import ms from "ms"
import { useEffect, useState } from "react"

export interface AutoExpiryOptionListProps {
  index: number
  referenceTime: number
  portalId: string
  configuredExpiryTime?: number
  defaultExpiryDuration?: number
  value?: number
  onSelectionDidChange: (_event: React.ChangeEvent<HTMLSelectElement>, _index: number, _portalId: string) => void
}

interface AutoExpiryOptionListOption {
  label: string
  value: string
}

interface AutoExpiryOptionListOptions {
  default: string
  options: AutoExpiryOptionListOption[]
}

function generateOptions(
  referenceTime: number,
  configuredExpiryTime?: number,
  defaultExpiryDuration?: number,
): AutoExpiryOptionListOptions {
  const durations = ["0", "1d", "7d", "14d", "30d", "60d", "180d", "1y"].map((duration) => ms(duration))
  var selected = durations[0]
  if (defaultExpiryDuration && !durations.includes(defaultExpiryDuration)) {
    durations.push(defaultExpiryDuration)
    selected = defaultExpiryDuration
    durations.sort((a, b) => a - b)
  }
  if (configuredExpiryTime !== undefined) {
    const x = configuredExpiryTime - referenceTime
    selected = findClosestDuration(durations, x)
    if (selected === 0 && x > 0) {
      durations.push(x)
      selected = x
      durations.sort((a, b) => a - b)
    }
  }
  const options: AutoExpiryOptionListOption[] = durations.map((duration) => {
    return {
      label: duration > 0 ? `After ${ms(duration, { long: true })}` : "Never",
      value: `${duration}`,
    }
  })
  const result: AutoExpiryOptionListOptions = {
    default: `${selected}`,
    options: options,
  }
  return result
}

function findClosestDuration(durations: number[], targetDuration: number) {
  const oneDay = ms("1d")
  return durations.find((d) => Math.abs(d - targetDuration) <= oneDay) ?? 0
}

export function AutoExpiryOptionList(props: AutoExpiryOptionListProps) {
  const [options, setOptions] = useState<AutoExpiryOptionListOptions>({ default: "", options: [] })
  useEffect(() => {
    setOptions(generateOptions(props.referenceTime, props.configuredExpiryTime, props.defaultExpiryDuration))
  }, [props.referenceTime, props.configuredExpiryTime, props.defaultExpiryDuration])
  return (
    <CFormSelect
      options={options.options}
      value={options.default}
      onChange={(event) => props.onSelectionDidChange(event, props.index, props.portalId)}
    />
  )
}
