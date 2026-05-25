import SwiftUI

struct FaviconView: View {
    let name: String
    let isSuccess: Bool

    var body: some View {
        if let url = Bundle.module.url(
            forResource: name,
            withExtension: "webp",
            subdirectory: "Resources/favicons"
        ), let nsImage = NSImage(contentsOf: url) {
            Image(nsImage: nsImage)
                .resizable()
                .interpolation(.high)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .opacity(isSuccess ? 1.0 : 0.4)
                .grayscale(isSuccess ? 0 : 1)
        } else {
            Circle()
                .fill(isSuccess ? Color.green : Color.red)
                .frame(width: 7, height: 7)
        }
    }
}
