import React from "react"
import { CFormSelect } from "@coreui/react"
import { useEffect, useState } from "react"
import { VenusMQTTTopic, VenusMQTTTopics } from "../../../shared/types"

export interface MQTTSubscriptionsOptionListProps {
  index: number
  portalId: string
  configuredMQTTSubscriptions: VenusMQTTTopic[]
  onSelectionDidChange: (_event: React.ChangeEvent<HTMLSelectElement>, _index: number, _portalId: string) => void
}

interface MQTTSubscriptionsListOption {
  label: string
  value: string
}

interface MQTTSubscriptionsOptionListOptions {
  default: string
  options: MQTTSubscriptionsListOption[]
}

function generateOptions(configuredMQTTSubscriptions: VenusMQTTTopic[]): MQTTSubscriptionsOptionListOptions {
  let defaultValue = `/#`
  if (configuredMQTTSubscriptions && configuredMQTTSubscriptions.length > 0) {
    defaultValue = configuredMQTTSubscriptions[0]
  }
  const options = VenusMQTTTopics.map((x) => {
    return { label: x, value: x }
  })
  return { default: defaultValue, options: options }
}

export function MQTTSubscriptionsOptionList(props: MQTTSubscriptionsOptionListProps) {
  const [options, setOptions] = useState<MQTTSubscriptionsOptionListOptions>({ default: "", options: [] })
  useEffect(() => {
    setOptions(generateOptions(props.configuredMQTTSubscriptions))
  }, [props.configuredMQTTSubscriptions])
  return (
    <CFormSelect
      options={options.options}
      value={options.default}
      onChange={(event) => props.onSelectionDidChange(event, props.index, props.portalId)}
    />
  )
}
