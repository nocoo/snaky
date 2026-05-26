import Foundation
import Testing

@testable import SnakyCore

struct DnsLeakTests {
    private let decoder = JSONDecoder()

    // MARK: - Model Decoding

    @Test func decodeNoLeakOutput() throws {
        let json = """
        {
          "token": "a1b2c3d4e5f6",
          "rounds": 5,
          "userIp": "104.28.12.34",
          "userCountry": "United States",
          "userCountryCode": "US",
          "dnsServers": [
            {
              "ip": "172.64.36.1",
              "country": "United States",
              "countryCode": "US",
              "city": null,
              "isp": "Cloudflare",
              "asn": 13335,
              "asOrg": "Cloudflare, Inc.",
              "leaked": false
            }
          ],
          "count": 1,
          "verdict": "no_leak"
        }
        """
        let output = try decoder.decode(DnsLeakOutput.self, from: Data(json.utf8))
        #expect(output.verdict == .noLeak)
        #expect(output.token == "a1b2c3d4e5f6")
        #expect(output.rounds == 5)
        #expect(output.userIp == "104.28.12.34")
        #expect(output.userCountryCode == "US")
        #expect(output.dnsServers.count == 1)
        #expect(output.dnsServers[0].ip == "172.64.36.1")
        #expect(output.dnsServers[0].leaked == false)
        #expect(output.dnsServers[0].isp == "Cloudflare")
        #expect(output.count == 1)
    }

    @Test func decodeLeakOutput() throws {
        let json = """
        {
          "token": "f7e8d9c0b1a2",
          "rounds": 5,
          "userIp": "104.28.12.34",
          "userCountry": "United States",
          "userCountryCode": "US",
          "dnsServers": [
            {
              "ip": "114.114.114.114",
              "country": "China",
              "countryCode": "CN",
              "city": "Nanjing",
              "isp": "China Unicom",
              "asn": 4837,
              "asOrg": "CHINA UNICOM China169 Backbone",
              "leaked": true
            }
          ],
          "count": 1,
          "verdict": "leak"
        }
        """
        let output = try decoder.decode(DnsLeakOutput.self, from: Data(json.utf8))
        #expect(output.verdict == .leak)
        #expect(output.dnsServers[0].leaked == true)
        #expect(output.dnsServers[0].countryCode == "CN")
        #expect(output.dnsServers[0].city == "Nanjing")
    }

    @Test func decodeInconclusiveOutput() throws {
        let json = """
        {
          "token": "deadbeef1234",
          "rounds": 5,
          "userIp": null,
          "userCountry": null,
          "userCountryCode": null,
          "dnsServers": [],
          "count": 0,
          "verdict": "inconclusive"
        }
        """
        let output = try decoder.decode(DnsLeakOutput.self, from: Data(json.utf8))
        #expect(output.verdict == .inconclusive)
        #expect(output.userIp == nil)
        #expect(output.userCountryCode == nil)
        #expect(output.dnsServers.isEmpty)
        #expect(output.count == 0) // swiftlint:disable:this empty_count
    }

    // MARK: - CLIBridge DNS Leak

    private struct MockFileChecker: FileExistenceChecker {
        let existingPaths: Set<String>
        func isExecutableFile(atPath path: String) -> Bool { existingPaths.contains(path) }
    }

    private struct MockShellExecutor: ShellExecutor {
        func execute(command: String, timeout: Duration) async throws -> String? { nil }
    }

    private struct MockProcessExecutor: ProcessExecutor {
        let exitCode: Int32
        let stdout: Data
        let stderr: Data

        func run(executablePath: String, arguments: [String], timeout: Duration) async throws -> ProcessOutput {
            ProcessOutput(exitCode: exitCode, stdout: stdout, stderr: stderr)
        }
    }

    private func makeBridge(exitCode: Int32, stdout: Data, stderr: Data = Data()) -> CLIBridge {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: ["/usr/local/bin/snaky"]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { "/usr/local/bin/snaky" }
        )
        let executor = MockProcessExecutor(exitCode: exitCode, stdout: stdout, stderr: stderr)
        return CLIBridge(discovery: discovery, executor: executor)
    }

    @Test func bridgeDnsLeakExitCode0() async throws {
        let json = """
        {"token":"abc","rounds":5,"userIp":"1.2.3.4",\
        "userCountry":null,"userCountryCode":"US",\
        "dnsServers":[],"count":0,"verdict":"no_leak"}
        """
        let bridge = makeBridge(exitCode: 0, stdout: Data(json.utf8))
        let output = try await bridge.invokeDnsLeak()
        #expect(output.verdict == .noLeak)
    }

    @Test func bridgeDnsLeakExitCode1() async throws {
        let json = """
        {"token":"abc","rounds":5,"userIp":"1.2.3.4",\
        "userCountry":null,"userCountryCode":"US",\
        "dnsServers":[{"ip":"8.8.8.8","country":"US",\
        "countryCode":"US","city":null,"isp":"Google",\
        "asn":15169,"asOrg":null,"leaked":true}],\
        "count":1,"verdict":"leak"}
        """
        let bridge = makeBridge(exitCode: 1, stdout: Data(json.utf8))
        let output = try await bridge.invokeDnsLeak()
        #expect(output.verdict == .leak)
    }

    @Test func bridgeDnsLeakExitCode2() async throws {
        let json = """
        {"token":"abc","rounds":5,"userIp":null,\
        "userCountry":null,"userCountryCode":null,\
        "dnsServers":[],"count":0,"verdict":"inconclusive"}
        """
        let bridge = makeBridge(exitCode: 2, stdout: Data(json.utf8))
        let output = try await bridge.invokeDnsLeak()
        #expect(output.verdict == .inconclusive)
    }

    @Test func bridgeDnsLeakExitCode3Fatal() async {
        let bridge = makeBridge(exitCode: 3, stdout: Data(), stderr: Data("Error: invalid args\n".utf8))
        do {
            _ = try await bridge.invokeDnsLeak()
            Issue.record("Expected CLIError.fatal")
        } catch let error as CLIError {
            #expect(error == .fatal("Error: invalid args"))
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test func bridgeDnsLeakCrashed() async {
        let bridge = makeBridge(exitCode: 127, stdout: Data())
        do {
            _ = try await bridge.invokeDnsLeak()
            Issue.record("Expected CLIError.crashed")
        } catch let error as CLIError {
            #expect(error == .crashed(127))
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }
}
