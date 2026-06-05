import AppKit
import SnakyCore
import SwiftUI

@MainActor
final class StatusItemController {
    private let statusItem: NSStatusItem
    private let panel: NSPanel
    private let viewModel = AppViewModel(bridge: CLIBridge())
    private let dnsLeakViewModel = DnsLeakViewModel(bridge: CLIBridge())
    private var eventMonitor: Any?

    init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.isVisible = true
        statusItem.behavior = []

        panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 451, height: 818),
            styleMask: [.nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: true
        )
        panel.isFloatingPanel = true
        panel.level = .statusBar
        panel.hasShadow = true
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let hostingView = NSHostingView(
            rootView: PopoverContentView(viewModel: viewModel, dnsLeakViewModel: dnsLeakViewModel)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        )
        panel.contentView = hostingView

        if let button = statusItem.button {
            if let icon = SnakyCore.menuBarIcon {
                button.image = icon
                NSLog("[Snaky] menubar icon loaded from SnakyCore: size=\(icon.size) isTemplate=\(icon.isTemplate)")
            } else {
                let fallback = NSImage(systemSymbolName: "network", accessibilityDescription: "Snaky")
                fallback?.isTemplate = true
                button.image = fallback
                NSLog("[Snaky] menubar icon FALLBACK to SF Symbol (SnakyCore.menuBarIcon was nil)")
            }
            button.imagePosition = .imageOnly
            button.action = #selector(togglePanel)
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        } else {
            NSLog("[Snaky] ERROR: statusItem.button is nil")
        }
        logStatusItemDiagnostics()
    }

    private func logStatusItemDiagnostics() {
        NSLog("[Snaky] statusItem isVisible=\(statusItem.isVisible) length=\(statusItem.length)")
        if let btn = statusItem.button {
            NSLog("[Snaky] button frame=\(btn.frame) window=\(String(describing: btn.window?.frame))")
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard let self else { return }
            NSLog("[Snaky] +2s isVisible=\(self.statusItem.isVisible) length=\(self.statusItem.length)")
            if let btn = self.statusItem.button {
                NSLog("[Snaky] +2s button frame=\(btn.frame) window=\(String(describing: btn.window?.frame))")
            }
        }
    }

    @objc private func togglePanel(_ sender: NSStatusBarButton) {
        let event = NSApp.currentEvent
        if event?.type == .rightMouseUp {
            showContextMenu(sender)
        } else if panel.isVisible {
            hidePanel()
        } else {
            showPanel(sender)
        }
    }

    func autoShow() {
        guard let button = statusItem.button else { return }
        showPanel(button)
    }

    private func showPanel(_ sender: NSStatusBarButton) {
        guard let buttonWindow = sender.window else { return }
        let buttonFrame = buttonWindow.frame
        let panelWidth = panel.frame.width
        let panelHeight = panel.frame.height

        let originX = buttonFrame.midX - panelWidth / 2
        let originY = buttonFrame.minY - panelHeight - 4

        panel.setFrameOrigin(NSPoint(x: originX, y: originY))
        panel.makeKeyAndOrderFront(nil)

        eventMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown]
        ) { [weak self] _ in
            self?.hidePanel()
        }
    }

    private func hidePanel() {
        panel.orderOut(nil)
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
            eventMonitor = nil
        }
    }

    private func showContextMenu(_ sender: NSStatusBarButton) {
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Refresh", action: #selector(refresh), keyEquivalent: "r"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit Snaky", action: #selector(quit), keyEquivalent: "q"))
        for item in menu.items {
            item.target = self
        }
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc private func refresh() {
        viewModel.refresh()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
