import AppKit

private final class SnakyCoreBundleAnchor {}

public enum SnakyCore {
    public static let version = "0.1.0"

    public static var menuBarIcon: NSImage? {
        // Bundle.module's resource layout differs between dev (swift run) and an
        // installed .app bundle, so try multiple lookup strategies.
        let classBundle = Bundle(for: SnakyCoreBundleAnchor.self)
        let candidates: [URL?] = [
            Bundle.module.url(forResource: "menubar-icon", withExtension: "png"),
            Bundle.module.url(forResource: "menubar-icon", withExtension: "png", subdirectory: "Resources"),
            Bundle.module.resourceURL?.appendingPathComponent("menubar-icon.png"),
            Bundle.module.resourceURL?.appendingPathComponent("Resources/menubar-icon.png"),
            classBundle.url(forResource: "menubar-icon", withExtension: "png"),
            classBundle.url(forResource: "menubar-icon", withExtension: "png", subdirectory: "Resources"),
            classBundle.bundleURL.appendingPathComponent("Resources/menubar-icon.png"),
            classBundle.bundleURL.appendingPathComponent("menubar-icon.png")
        ]
        for case let url? in candidates where FileManager.default.fileExists(atPath: url.path) {
            if let image = NSImage(contentsOf: url) {
                image.size = NSSize(width: 18, height: 18)
                image.isTemplate = true
                return image
            }
        }
        return nil
    }
}
