import Foundation
import Testing

@testable import SnakyCore

struct ModelDecodingTests {
    private let decoder = JSONDecoder()

    private func loadFixture(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else {
            throw FixtureError.notFound(name)
        }
        return try Data(contentsOf: url)
    }

    private enum FixtureError: Error {
        case notFound(String)
    }

    // MARK: - FullOutput

    @Test func decodeFullOutputModeAll() throws {
        let data = try loadFixture("full-output-all-success")
        let output = try decoder.decode(FullOutput.self, from: data)
        #expect(output.mode == .all)
        #expect(output.probe != nil)
        #expect(output.ping != nil)
    }

    @Test func decodeFullOutputModeProbe() throws {
        let data = try loadFixture("full-output-probe-only")
        let output = try decoder.decode(FullOutput.self, from: data)
        #expect(output.mode == .probe)
        #expect(output.probe != nil)
        #expect(output.ping == nil)
    }

    @Test func decodeFullOutputModePing() throws {
        let data = try loadFixture("full-output-ping-only")
        let output = try decoder.decode(FullOutput.self, from: data)
        #expect(output.mode == .ping)
        #expect(output.probe == nil)
        #expect(output.ping != nil)
    }

    // MARK: - ProbeEntry

    @Test func decodeProbeEntrySuccess() throws {
        let data = try loadFixture("full-output-all-success")
        let output = try decoder.decode(FullOutput.self, from: data)
        let entry = try #require(output.probe?.results.first)
        #expect(entry.name == "anthropic")
        #expect(entry.category == "ai")
        #expect(entry.method == .cftrace)
        #expect(entry.target == "anthropic.com")
        #expect(entry.ok == true)
        #expect(entry.ip == "104.18.32.7")
        #expect(entry.location == "JP")
        #expect(entry.colo == "NRT")
        #expect(entry.responseTimeMs == 45)
        #expect(entry.usedFallback == false)
        #expect(entry.resolvedTarget == nil)
        #expect(entry.error == nil)
    }

    @Test func decodeProbeEntryHttpHeader() throws {
        let data = try loadFixture("full-output-all-success")
        let output = try decoder.decode(FullOutput.self, from: data)
        let entry = try #require(output.probe?.results.last)
        #expect(entry.method == .httpHeader)
        #expect(entry.location == nil)
        #expect(entry.colo == nil)
        #expect(entry.ip == "167.220.233.44")
    }

    @Test func decodeProbeEntryWithFallback() throws {
        let data = try loadFixture("full-output-with-fallback")
        let output = try decoder.decode(FullOutput.self, from: data)
        let entry = try #require(output.probe?.results.first)
        #expect(entry.usedFallback == true)
        #expect(entry.resolvedTarget == "chatgpt.com.cdn.cloudflare.net")
        #expect(entry.ok == true)
        #expect(entry.ip == "104.18.32.7")
    }

    @Test func decodeProbeEntryFailureDNS() throws {
        let data = try loadFixture("full-output-partial-failure")
        let output = try decoder.decode(FullOutput.self, from: data)
        let results = try #require(output.probe?.results)
        let entry = try #require(results.first(where: { $0.name == "qualcomm-cn" }))
        #expect(entry.ok == false)
        #expect(entry.responseTimeMs == nil)
        #expect(entry.error?.code == .dnsFailed)
        #expect(entry.error?.message.contains("ENOTFOUND") == true)
        #expect(entry.ip == nil)
    }

    @Test func decodeProbeEntryFailureWithTime() throws {
        let data = try loadFixture("full-output-partial-failure")
        let output = try decoder.decode(FullOutput.self, from: data)
        let results = try #require(output.probe?.results)
        let entry = try #require(results.first(where: { $0.name == "timeout-ep" }))
        #expect(entry.ok == false)
        #expect(entry.responseTimeMs == 5000)
        #expect(entry.error?.code == .timeout)
    }

    // MARK: - ProbeSummary

    @Test func decodeProbeSummary() throws {
        let data = try loadFixture("full-output-partial-failure")
        let output = try decoder.decode(FullOutput.self, from: data)
        let summary = try #require(output.probe?.summary)
        #expect(summary.total == 3)
        #expect(summary.succeeded == 1)
        #expect(summary.failed == 2)
    }

    // MARK: - UniqueIps

    @Test func decodeUniqueIps() throws {
        let data = try loadFixture("full-output-all-success")
        let output = try decoder.decode(FullOutput.self, from: data)
        let ips = try #require(output.probe?.uniqueIps)
        #expect(ips.count == 2)
        #expect(ips[0].ip == "104.18.32.7")
        #expect(ips[0].location == "JP")
        #expect(ips[0].count == 1)
        #expect(ips[1].location == nil)
    }

    // MARK: - PingResult

    @Test func decodePingResultSuccess() throws {
        let data = try loadFixture("full-output-all-success")
        let output = try decoder.decode(FullOutput.self, from: data)
        let ping = try #require(output.ping?.results.first)
        #expect(ping.name == "ping-cloudflare")
        #expect(ping.tag == "international")
        #expect(ping.ok == true)
        #expect(ping.medianMs == 52)
        #expect(ping.rounds == [60, 52, 51, 53, 50])
        #expect(ping.error == nil)
    }

    @Test func decodePingResultPartial() throws {
        let data = try loadFixture("full-output-partial-failure")
        let output = try decoder.decode(FullOutput.self, from: data)
        let pings = try #require(output.ping?.results)
        let partial = try #require(pings.first(where: { $0.name == "ping-partial" }))
        #expect(partial.ok == true)
        #expect(partial.medianMs == 120)
        #expect(partial.rounds.contains(-1))
        #expect(partial.error == nil)
    }

    @Test func decodePingResultAllFailed() throws {
        let data = try loadFixture("full-output-partial-failure")
        let output = try decoder.decode(FullOutput.self, from: data)
        let pings = try #require(output.ping?.results)
        let failed = try #require(pings.first(where: { $0.name == "ping-broken" }))
        #expect(failed.ok == false)
        #expect(failed.medianMs == nil)
        #expect(failed.rounds.allSatisfy { $0 == -1 })
        #expect(failed.error?.code == .allFailed)
    }

    // MARK: - ErrorCode round-trip

    @Test func decodeAllErrorCodes() throws {
        let codes: [(String, ErrorCode)] = [
            ("TIMEOUT", .timeout),
            ("DNS_FAILED", .dnsFailed),
            ("CONNECTION_REFUSED", .connectionRefused),
            ("TLS_ERROR", .tlsError),
            ("HTTP_ERROR", .httpError),
            ("PARSE_ERROR", .parseError),
            ("REDIRECT", .redirect),
            ("HEADER_MISSING", .headerMissing),
            ("ALL_FAILED", .allFailed),
            ("UNKNOWN", .unknown),
        ]
        for (raw, expected) in codes {
            let json = Data(#"{"code":"\#(raw)","message":"test"}"#.utf8)
            let error = try decoder.decode(ProbeError.self, from: json)
            #expect(error.code == expected)
            #expect(error.message == "test")
        }
    }

    // MARK: - ProbeMethod

    @Test func decodeProbeMethodCftrace() throws {
        let json = Data(#""cftrace""#.utf8)
        let method = try decoder.decode(ProbeMethod.self, from: json)
        #expect(method == .cftrace)
    }

    @Test func decodeProbeMethodHttpHeader() throws {
        let json = Data(#""http-header""#.utf8)
        let method = try decoder.decode(ProbeMethod.self, from: json)
        #expect(method == .httpHeader)
    }
}
