import SwiftUI

public struct PopoverContentView: View {
    @ObservedObject var viewModel: AppViewModel

    public init(viewModel: AppViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        Text("Snaky")
            .frame(width: 360, height: 600)
    }
}
