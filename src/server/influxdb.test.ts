import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InfluxDBBackend } from "./influxdb.js"
import { Server } from "./server.js"

function createBackend(batchWriteInterval?: number) {
  const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
  const server = {
    getLogger: () => logger,
    on: vi.fn(),
    config: { influxdb: { batchWriteInterval } },
  } as unknown as Server
  const backend = new InfluxDBBackend(server)
  const writePoints = vi.fn().mockResolvedValue(undefined)
  backend.isConnected = true
  backend.influxClient = { writePoints } as any
  return { backend, writePoints }
}

describe("InfluxDBBackend.store", () => {
  describe("with immediate writes", () => {
    let backend: InfluxDBBackend
    let writePoints: ReturnType<typeof vi.fn>

    beforeEach(() => {
      ;({ backend, writePoints } = createBackend())
      backend.batchWriteInterval = 0
    })

    it.each([undefined, null, ""])("skips %j", async (value) => {
      await backend.store("portal", "name", "0", "system/Serial", value)
      expect(writePoints).not.toHaveBeenCalled()
    })

    it.each([{ a: 1 }, true, [1]])("skips non-numeric payload %j", async (value) => {
      await backend.store("portal", "name", "0", "system/Serial", value)
      expect(writePoints).not.toHaveBeenCalled()
    })

    it("stores numbers in the value field", async () => {
      await backend.store("portal", "name", "288", "solarcharger/Dc/0/Voltage", 12.5)
      expect(writePoints).toHaveBeenCalledOnce()
      expect(writePoints.mock.calls[0][0]).toEqual([
        {
          timestamp: expect.any(Date),
          measurement: "solarcharger/Dc/0/Voltage",
          tags: { portalId: "portal", instanceNumber: "288", name: "name" },
          fields: { value: 12.5 },
        },
      ])
    })

    it("stores strings in the stringValue field", async () => {
      await backend.store("portal", "name", "0", "system/Serial", "abc")
      expect(writePoints.mock.calls[0][0][0].fields).toEqual({ stringValue: "abc" })
    })

    it("falls back to the portalId when the name is empty", async () => {
      await backend.store("portal", "", "0", "system/Serial", 1)
      expect(writePoints.mock.calls[0][0][0].tags.name).toBe("portal")
    })

    it("does nothing when not connected", async () => {
      backend.isConnected = false
      await backend.store("portal", "name", "0", "system/Serial", 1)
      expect(writePoints).not.toHaveBeenCalled()
    })

    it("drops the batch, reconnects and rethrows when the write fails", async () => {
      writePoints.mockRejectedValueOnce(new Error("boom"))
      backend.start = vi.fn().mockResolvedValue(undefined)
      await expect(backend.store("portal", "name", "0", "system/Serial", 1)).rejects.toThrow("boom")
      expect(backend.accumulatedPoints).toEqual([])
      expect(backend.start).toHaveBeenCalledOnce()
    })
  })

  describe("with batching", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("accumulates points and flushes once the interval has passed", async () => {
      const { backend, writePoints } = createBackend(10)
      expect(backend.batchWriteInterval).toBe(10_000)

      for (let i = 0; i < 3; i++) {
        await backend.store("portal", "name", "0", "m", i)
      }
      expect(writePoints).not.toHaveBeenCalled()
      expect(backend.accumulatedPoints).toHaveLength(3)

      vi.advanceTimersByTime(10_001)
      await backend.store("portal", "name", "0", "m", 3)
      expect(writePoints).toHaveBeenCalledOnce()
      expect(writePoints.mock.calls[0][0]).toHaveLength(4)
      expect(backend.accumulatedPoints).toEqual([])
    })
  })
})
