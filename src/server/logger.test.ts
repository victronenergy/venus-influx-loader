import { describe, expect, it, vi } from "vitest"
import { LogStorageTransport, createRootLogger } from "./logger"
import { LogEntry } from "../shared/types"
import { Server } from "./server"

const entry = (message: string): LogEntry => ({ timestamp: "t", level: "info", label: "test", message })

describe("LogStorageTransport", () => {
  it("keeps only the most recent entries and emits each one", () => {
    const server = { emit: vi.fn() } as unknown as Server
    const transport = new LogStorageTransport(server, { size: 3 })
    const callback = vi.fn()

    for (const message of ["a", "b", "c", "d"]) {
      transport.log(entry(message), callback)
    }

    expect(transport.entries.map((e) => e.message)).toEqual(["b", "c", "d"])
    expect(callback).toHaveBeenCalledTimes(4)
    expect(server.emit).toHaveBeenCalledTimes(4)
    expect(server.emit).toHaveBeenLastCalledWith("loaderevent", { type: "LOG", data: entry("d") })
  })

  it("defaults to 100 entries", () => {
    const transport = new LogStorageTransport({ emit: vi.fn() } as unknown as Server, {})
    expect(transport.size).toBe(100)
  })
})

describe("createRootLogger", () => {
  it("stores labelled entries above the configured level", async () => {
    const server = { emit: vi.fn() } as unknown as Server
    const { rootLogger, logTransport } = createRootLogger(server, "info")
    const logger = rootLogger.child({ label: "unit" })

    logger.debug("hidden")
    logger.info("hello %s", "world")
    await new Promise((resolve) => setImmediate(resolve))

    expect(logTransport.entries).toHaveLength(1)
    expect(logTransport.entries[0]).toMatchObject({ level: "info", label: "unit", message: "hello world" })
    expect(typeof logTransport.entries[0].timestamp).toBe("string")
  })
})
