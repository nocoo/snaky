import AppKit
import SnakyCore
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: StatusItemController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = StatusItemController()
        if ProcessInfo.processInfo.environment["SNAKY_AUTOSHOW"] == "1" {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.statusItem?.autoShow()
            }
        }
    }
}
