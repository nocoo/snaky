// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "Snaky",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .target(
            name: "SnakyCore",
            path: "Sources/SnakyCore"
        ),
        .executableTarget(
            name: "Snaky",
            dependencies: ["SnakyCore"],
            path: "Sources/Snaky"
        ),
        .testTarget(
            name: "SnakyCoreTests",
            dependencies: ["SnakyCore"],
            path: "Tests/SnakyCoreTests",
            resources: [
                .copy("Fixtures")
            ]
        )
    ]
)
