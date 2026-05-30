import Foundation
import Testing

@testable import SnakyCore

@Suite struct NdjsonDecoderTests {
    private let decoder = NdjsonDecoder()

    @Test func decodeMeta() throws {
        let line = #"{"event":"meta","data":{"mode":"split","version":"1.0.0","counts":{"split":30}}}"#
        let event = try decoder.decode(line: line)
        guard case .meta(let mode, let version, let split, _, _) = event else {
            Issue.record("expected meta")
            return
        }
        #expect(mode == "split")
        #expect(version == "1.0.0")
        #expect(split == 30)
    }

    @Test func decodeProbeResult() throws {
        // swiftlint:disable:next line_length
        let line = #"{"event":"probe.result","data":{"name":"netease","category":"domestic","method":"http-header","target":"https://x.com","usedFallback":false,"ok":true,"ip":"1.2.3.4","location":"CN","colo":null,"responseTimeMs":182,"index":0}}"#
        let event = try decoder.decode(line: line)
        guard case .probeResult(let index, let entry) = event else {
            Issue.record("expected probeResult")
            return
        }
        #expect(index == 0)
        #expect(entry.name == "netease")
        #expect(entry.ok == true)
        #expect(entry.ip == "1.2.3.4")
    }

    @Test func decodePingResult() throws {
        // swiftlint:disable:next line_length
        let line = #"{"event":"ping.result","data":{"name":"ping-bytedance","tag":"domestic","ok":true,"medianMs":18,"rounds":[18,18,28],"index":3}}"#
        let event = try decoder.decode(line: line)
        guard case .pingResult(let index, let result) = event else {
            Issue.record("expected pingResult")
            return
        }
        #expect(index == 3)
        #expect(result.name == "ping-bytedance")
        #expect(result.medianMs == 18)
        #expect(result.rounds.count == 3)
    }

    @Test func decodeDnsUpdate() throws {
        // swiftlint:disable:next line_length
        let line = #"{"event":"dns.update","data":{"token":"abc","rounds":5,"userIp":"1.2.3.4","userCountry":"US","userCountryCode":"US","dnsServers":[],"count":0,"verdict":"inconclusive"}}"#
        let event = try decoder.decode(line: line)
        guard case .dnsUpdate(let dns) = event else {
            Issue.record("expected dns.update")
            return
        }
        #expect(dns.token == "abc")
        #expect(dns.verdict == .inconclusive)
    }

    @Test func decodeDone() throws {
        let line = #"{"event":"done","data":{"exitCode":2}}"#
        let event = try decoder.decode(line: line)
        guard case .done(let exit) = event else {
            Issue.record("expected done")
            return
        }
        #expect(exit == 2)
    }

    @Test func decodeUnknownEventReturnsUnknown() throws {
        let line = #"{"event":"future","data":{}}"#
        let event = try decoder.decode(line: line)
        guard case .unknown(let name) = event else {
            Issue.record("expected unknown")
            return
        }
        #expect(name == "future")
    }

    @Test func malformedJsonThrows() {
        #expect(throws: (any Error).self) {
            _ = try decoder.decode(line: "not-json")
        }
    }
}
