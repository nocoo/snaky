import SwiftUI

struct DnsLeakView: View {
    var body: some View {
        ContentUnavailableView(
            "Coming Soon",
            systemImage: "network.badge.shield.half.filled",
            description: Text("DNS leak detection will appear here")
        )
    }
}
