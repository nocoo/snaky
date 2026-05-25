import AppKit

public enum SnakyCore {
    public static let version = "0.1.0"

    public static var menuBarIcon: NSImage? {
        guard let url = Bundle.module.url(
            forResource: "menubar-icon",
            withExtension: "png",
            subdirectory: "Resources"
        ) else { return nil }
        guard let image = NSImage(contentsOf: url) else { return nil }
        image.size = NSSize(width: 18, height: 18)
        image.isTemplate = true
        return image
    }
}
