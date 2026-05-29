import Foundation
import SnakyCore

@main
struct StreamSmokeTest {
    static func main() async {
        let bridge = CLIBridge()
        let start = Date()
        do {
            let stream = try await bridge.streamRun(mode: "split", tier: 1)
            var probeCount = 0
            for try await event in stream {
                let elapsed = String(format: "%6.3fs", Date().timeIntervalSince(start))
                switch event {
                case .meta(let mode, let version, let split, _, _):
                    print("[\(elapsed)] meta mode=\(mode) version=\(version) split=\(split ?? -1)")
                case .probeResult(_, let entry):
                    probeCount += 1
                    let ip = entry.ip ?? "-"
                    let ms = Int(entry.responseTimeMs ?? -1)
                    print("[\(elapsed)] probe #\(probeCount): \(entry.name) ok=\(entry.ok) ip=\(ip) ms=\(ms)")
                case .uniqueIp(let unique):
                    print("[\(elapsed)] unique ip: \(unique.ip) (\(unique.count) hits)")
                case .summary:
                    print("[\(elapsed)] summary received (probes=\(probeCount))")
                case .done(let code):
                    print("[\(elapsed)] done exitCode=\(code)")
                default:
                    break
                }
            }
        } catch {
            print("ERROR: \(error)")
            exit(1)
        }
    }
}
