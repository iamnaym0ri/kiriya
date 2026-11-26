import Foundation
MainActor.assumeIsolated { runProbe(out: CommandLine.arguments[1]) }
