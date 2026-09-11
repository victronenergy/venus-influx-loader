import React from "react"
import { useState, useEffect } from "react"

export function useFormValidation(validate: () => boolean) {
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    setIsValid(validate())
  })

  return isValid
}

export type FormControlChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>

// Returns a copy of `target` with the field named by the changed form control updated from it.
// The form control's `name` must match a key of `target`; the DOM only gives us that name as a
// string, so this is the single place where a form value crosses into a typed object:
// checkboxes become booleans, fields currently holding a number are parsed with Number(),
// everything else keeps the control's string value.
export function updateFormField<T extends object>(target: T, event: FormControlChangeEvent): T {
  const control = event.target
  const name = control.name as keyof T
  let value: unknown
  if (control.type === "checkbox") {
    value = (control as HTMLInputElement).checked
  } else if (typeof target[name] === "number") {
    value = Number(control.value)
  } else {
    value = control.value
  }
  return { ...target, [name]: value as T[keyof T] }
}
