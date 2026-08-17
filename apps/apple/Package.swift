// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AlaveXStreaming",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(name: "AlaveXCore", targets: ["AlaveXCore"]),
        .executable(name: "AlaveXStreaming", targets: ["AlaveXStreaming"]),
    ],
    targets: [
        .target(name: "AlaveXCore"),
        .executableTarget(
            name: "AlaveXStreaming",
            dependencies: ["AlaveXCore"]
        ),
    ]
)
