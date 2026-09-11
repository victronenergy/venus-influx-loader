import { describe, expect, it } from "vitest"
import { updateFormField, type FormControlChangeEvent } from "./useFormValidation"

const change = (target: { name: string; type: string; value?: string; checked?: boolean }) =>
  ({ target }) as unknown as FormControlChangeEvent

describe("updateFormField", () => {
  const target = { enabled: true, host: "localhost", batchWriteInterval: 10 }

  it("stores checkbox state as a boolean", () => {
    expect(updateFormField(target, change({ name: "enabled", type: "checkbox", checked: false, value: "on" }))).toEqual(
      {
        ...target,
        enabled: false,
      },
    )
  })

  it("parses numeric fields with Number()", () => {
    const updated = updateFormField(target, change({ name: "batchWriteInterval", type: "text", value: "30" }))
    expect(updated.batchWriteInterval).toBe(30)
  })

  it("keeps string fields as strings", () => {
    expect(updateFormField(target, change({ name: "host", type: "text", value: "8086" })).host).toBe("8086")
    expect(updateFormField(target, change({ name: "host", type: "select-one", value: "x" })).host).toBe("x")
  })

  it("returns a new object and leaves the original untouched", () => {
    const updated = updateFormField(target, change({ name: "host", type: "text", value: "other" }))
    expect(updated).not.toBe(target)
    expect(target.host).toBe("localhost")
  })
})
