import SwiftUI

struct SkeletonView: View {
    @State private var animating = false

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { index in
                skeletonCard(lines: index == 0 ? 3 : 2)
            }
        }
        .opacity(animating ? 0.6 : 1.0)
        .animation(
            .easeInOut(duration: 1.0).repeatForever(autoreverses: true),
            value: animating
        )
        .onAppear { animating = true }
    }

    private func skeletonCard(lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Theme.cardBorder)
                    .frame(width: 80, height: 12)
                Spacer()
                RoundedRectangle(cornerRadius: 4)
                    .fill(Theme.cardBorder)
                    .frame(width: 30, height: 16)
            }
            ForEach(0..<lines, id: \.self) { _ in
                HStack(spacing: 8) {
                    Circle()
                        .fill(Theme.cardBorder)
                        .frame(width: 7, height: 7)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Theme.cardBorder)
                        .frame(height: 10)
                    Spacer()
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Theme.cardBorder)
                        .frame(width: 50, height: 10)
                }
            }
        }
        .card()
    }
}
