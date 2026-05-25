import SwiftUI

enum Theme {
    static let panelBackground = Color(red: 0.05, green: 0.06, blue: 0.09)
    static let cardBackground = Color(red: 0.10, green: 0.12, blue: 0.16)
    static let cardBorder = Color.white.opacity(0.06)
    static let sectionTitle = Color(red: 0.30, green: 0.82, blue: 0.77)
    static let badgeBackground = Color(red: 0.35, green: 0.30, blue: 0.15)
    static let badgeText = Color(red: 0.85, green: 0.72, blue: 0.35)
    static let primaryText = Color.white.opacity(0.92)
    static let secondaryText = Color.white.opacity(0.55)
    static let tertiaryText = Color.white.opacity(0.35)
}

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Theme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Theme.cardBorder, lineWidth: 1)
            )
    }
}

extension View {
    func card() -> some View {
        modifier(CardModifier())
    }
}

struct Badge: View {
    let text: String
    var color: Color = Theme.badgeText
    var background: Color = Theme.badgeBackground

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

struct SectionHeader: View {
    let icon: String
    let title: String
    var badge: String?

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.sectionTitle)
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.sectionTitle)
            Spacer()
            if let badge {
                Badge(text: badge)
            }
        }
    }
}
