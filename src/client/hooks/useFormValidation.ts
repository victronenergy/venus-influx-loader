import { useState, useEffect } from "react"

export function useFormValidation(validate: () => boolean) {
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    setIsValid(validate())
  })

  return isValid
}

export function extractParameterNameAndValue<AppConfigNestedKey>(event: React.ChangeEvent<HTMLInputElement>): [AppConfigNestedKey, string | number | boolean] {
  let value: string | number | boolean =
    event.target.type === "checkbox" ? event.target.checked : event.target.value
  // TODO: figure how to better handle this ???
  if (event.target.name === "port") {
    value = Number(value)
  }
  return [event.target.name as AppConfigNestedKey, value]
}