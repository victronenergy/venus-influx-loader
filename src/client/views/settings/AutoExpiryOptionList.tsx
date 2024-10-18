import React from "react"
import { CFormSelect } from "@coreui/react"
import ms from "ms"
import { useEffect, useState } from "react"

export interface AutoExpiryOptionListProps {
  showAutomaticExpirySettings?: number
  value?: number
  onSelectionDidChange: React.ChangeEventHandler<HTMLSelectElement>
}

interface AutoExpiryOptionListOption {
  label: string
  value: string
}

interface AutoExpiryOptionListOptions {
  default: string
  options: AutoExpiryOptionListOption[]
}

function generateOptions(defaultExpiryDuration?: number): AutoExpiryOptionListOptions {
  const defaults = ["0", "1d", "7d", "14d", "30d", "60d", "180d", "1y"].map((duration) => ms(duration))
  var selected = defaults[0]
  if (defaultExpiryDuration && !defaults.includes(defaultExpiryDuration)) {
    defaults.push(defaultExpiryDuration)
    selected = defaultExpiryDuration
    defaults.sort((a, b) => a - b)
  }
  const options: AutoExpiryOptionListOption[] = defaults.map((duration) => {
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

export function AutoExpiryOptionList(props: AutoExpiryOptionListProps) {
  const [options, setOptions] = useState<AutoExpiryOptionListOptions>({ default: "", options: [] })
  useEffect(() => {
    setOptions(generateOptions(props.showAutomaticExpirySettings))
  }, [props.showAutomaticExpirySettings])
  return (
    <CFormSelect
      options={options.options}
      value={props.value || options.default}
      onChange={props.onSelectionDidChange}
    />
  )
}
