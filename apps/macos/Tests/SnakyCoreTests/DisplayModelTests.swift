import Testing

@testable import SnakyCore

struct DisplayModelTests {
    // MARK: - LatencyColor

    @Test func latencyColorGreen() {
        #expect(LatencyColor.from(ms: 0) == .green)
        #expect(LatencyColor.from(ms: 100) == .green)
        #expect(LatencyColor.from(ms: 200) == .green)
    }

    @Test func latencyColorYellow() {
        #expect(LatencyColor.from(ms: 201) == .yellow)
        #expect(LatencyColor.from(ms: 500) == .yellow)
        #expect(LatencyColor.from(ms: 1000) == .yellow)
    }

    @Test func latencyColorRed() {
        #expect(LatencyColor.from(ms: 1001) == .red)
        #expect(LatencyColor.from(ms: 5000) == .red)
    }

    @Test func latencyColorNone() {
        #expect(LatencyColor.from(ms: nil) == .none)
    }

    // MARK: - ProbeRowModel

    @Test func probeRowMapping() {
        let entry = ProbeEntry(
            name: "anthropic",
            category: "ai",
            method: .cftrace,
            target: "anthropic.com",
            resolvedTarget: nil,
            ok: true,
            ip: "104.18.32.7",
            location: "JP",
            colo: "NRT",
            responseTimeMs: 45,
            usedFallback: false,
            error: nil
        )
        let row = ProbeRowModel(from: entry)
        #expect(row.name == "anthropic")
        #expect(row.ip == "104.18.32.7")
        #expect(row.location == "JP")
        #expect(row.colo == "NRT")
        #expect(row.latencyText == "45ms")
        #expect(row.latencyColor == .green)
        #expect(row.isSuccess == true)
        #expect(row.errorCode == nil)
        #expect(row.usedFallback == false)
    }

    @Test func probeRowNullLocation() {
        let entry = ProbeEntry(
            name: "netease",
            category: "domestic",
            method: .httpHeader,
            target: "https://example.com",
            resolvedTarget: nil,
            ok: true,
            ip: "1.2.3.4",
            location: nil,
            colo: nil,
            responseTimeMs: 120,
            usedFallback: false,
            error: nil
        )
        let row = ProbeRowModel(from: entry)
        #expect(row.location == "—")
        #expect(row.colo == "—")
    }

    @Test func probeRowFallback() {
        let entry = ProbeEntry(
            name: "chatgpt",
            category: "ai",
            method: .cftrace,
            target: "chatgpt.com",
            resolvedTarget: "chatgpt.com.cdn.cloudflare.net",
            ok: true,
            ip: "104.18.32.7",
            location: "JP",
            colo: "NRT",
            responseTimeMs: 95,
            usedFallback: true,
            error: nil
        )
        let row = ProbeRowModel(from: entry)
        #expect(row.usedFallback == true)
        #expect(row.resolvedTarget == "chatgpt.com.cdn.cloudflare.net")
    }

    @Test func probeRowFailure() {
        let entry = ProbeEntry(
            name: "broken",
            category: "ai",
            method: .cftrace,
            target: "broken.com",
            resolvedTarget: nil,
            ok: false,
            ip: nil,
            location: nil,
            colo: nil,
            responseTimeMs: nil,
            usedFallback: false,
            error: ProbeError(code: .dnsFailed, message: "DNS lookup failed")
        )
        let row = ProbeRowModel(from: entry)
        #expect(row.isSuccess == false)
        #expect(row.errorCode == "DNS_FAILED")
        #expect(row.ip == "—")
        #expect(row.latencyText == "—")
        #expect(row.latencyColor == .none)
    }

    // MARK: - PingRowModel

    @Test func pingRoundDots() {
        let result = PingResult(
            name: "ping-test",
            tag: "international",
            ok: true,
            medianMs: 120,
            rounds: [130, -1, 120, -1, 110],
            error: nil
        )
        let row = PingRowModel(from: result)
        #expect(row.dots.count == 5)
        #expect(row.dots[0].isSuccess == true)
        #expect(row.dots[1].isSuccess == false)
        #expect(row.dots[2].isSuccess == true)
        #expect(row.dots[3].isSuccess == false)
        #expect(row.dots[4].isSuccess == true)
    }

    @Test func pingRowSuccess() {
        let result = PingResult(
            name: "ping-cf",
            tag: "international",
            ok: true,
            medianMs: 52,
            rounds: [60, 52, 51],
            error: nil
        )
        let row = PingRowModel(from: result)
        #expect(row.medianText == "52ms")
        #expect(row.latencyColor == .green)
        #expect(row.isSuccess == true)
        #expect(row.errorCode == nil)
    }

    @Test func pingRowAllFailed() {
        let result = PingResult(
            name: "ping-dead",
            tag: "domestic",
            ok: false,
            medianMs: nil,
            rounds: [-1, -1, -1],
            error: ProbeError(code: .allFailed, message: "All rounds failed")
        )
        let row = PingRowModel(from: result)
        #expect(row.medianText == "—")
        #expect(row.latencyColor == .none)
        #expect(row.isSuccess == false)
        #expect(row.errorCode == "ALL_FAILED")
        #expect(row.dots.allSatisfy { !$0.isSuccess })
    }
}
