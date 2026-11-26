// Converts a WOFF/WOFF2 (or any font CoreText can read) into a plain TrueType .ttf by copying every
// table CoreText decodes. Used once to make the Letter card's bundled fonts (macOS only).
// usage: woff2ttf <in.woff2> <out.ttf>
import CoreText
import Foundation

let args = CommandLine.arguments
guard args.count == 3,
      let desc = (CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: args[1]) as CFURL) as? [CTFontDescriptor])?.first
else { fatalError("usage: woff2ttf in out") }
let font = CTFontCreateWithFontDescriptor(desc, 0, nil)
// The array holds raw tag values (not CFNumbers).
let tagArray = CTFontCopyAvailableTables(font, [])!
let tags = (0..<CFArrayGetCount(tagArray)).map { UInt32(UInt(bitPattern: CFArrayGetValueAtIndex(tagArray, $0))) }.sorted()
var tables: [(UInt32, Data)] = []
for tag in tags {
    if let d = CTFontCopyTable(font, CTFontTableTag(tag), []) as Data? { tables.append((tag, d)) }
}
func be32(_ v: UInt32) -> [UInt8] { [UInt8(v >> 24 & 255), UInt8(v >> 16 & 255), UInt8(v >> 8 & 255), UInt8(v & 255)] }
func be16(_ v: UInt16) -> [UInt8] { [UInt8(v >> 8 & 255), UInt8(v & 255)] }
func checksum(_ d: [UInt8]) -> UInt32 {
    var sum: UInt32 = 0; var i = 0
    while i < d.count { var w: UInt32 = 0; for k in 0..<4 { w = w << 8 | UInt32(i + k < d.count ? d[i + k] : 0) }; sum = sum &+ w; i += 4 }
    return sum
}
let n = UInt16(tables.count)
var p: UInt16 = 1; var e: UInt16 = 0; while p * 2 <= n { p *= 2; e += 1 }
var out: [UInt8] = be32(0x00010000) + be16(n) + be16(p * 16) + be16(e) + be16(n * 16 - p * 16)
var offset = 12 + 16 * tables.count
var body: [UInt8] = []
var headOffset = -1
for (tag, data) in tables {
    var bytes = [UInt8](data)
    if tag == 0x68656164 { // 'head': zero checkSumAdjustment before summing
        for k in 8..<12 { bytes[k] = 0 }
        headOffset = offset
    }
    out += be32(tag) + be32(checksum(bytes)) + be32(UInt32(offset)) + be32(UInt32(bytes.count))
    var padded = bytes; while padded.count % 4 != 0 { padded.append(0) }
    body += padded; offset += padded.count
}
out += body
if headOffset >= 0 {
    let adj = 0xB1B0AFBA &- checksum(out)
    let b = be32(adj); for k in 0..<4 { out[headOffset + 8 + k] = b[k] }
}
try! Data(out).write(to: URL(fileURLWithPath: args[2]))
print("wrote", args[2], out.count, "bytes,", tables.count, "tables:", tables.map { String(bytes: be32($0.0), encoding: .ascii)! }.joined(separator: " "))
