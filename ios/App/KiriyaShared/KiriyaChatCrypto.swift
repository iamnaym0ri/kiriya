import CryptoKit
import Foundation
import Security

// The chat's end-to-end encryption, native side (docs/refactor/CHAT-CRYPTO.md). The web app derives
// the chat key and hands its bytes to the Keychain (ios/App/App/KiriyaChatPlugin.swift), in an item
// whose access group is the App Group, so the notification extension can open a message's preview,
// the widgets the last message, and a reply typed into a notification can be sealed before it goes.
// Formats match src/lib/chatCrypto/core.js exactly:
//   sealed value   base64url( nonce[12] ‖ ciphertext ‖ tag[16] )  (CryptoKit's "combined")
//   AAD            "kiriya.love/chat/v1|<field>|<sender>|<kind>"   field: message | media | notify
//   plaintext      JSON { "c": clientId, "t": text }, padded with spaces to 32-byte steps
// Target membership: App, KiriyaWidgets, KiriyaNotificationService, KiriyaNotificationContent.
// Self-contained on purpose: the service extension doesn't compile KiriyaShared.swift.

enum KiriyaChatCrypto {
    static let accessGroup = "group.love.kiriya.app"
    static let keysService = "love.kiriya.app.chat-keys"
    static let keysAccount = "keys"
    /// App Group flag the chat lock sets: notification previews stay "a new message ♡".
    static let hidePreviewsKey = "chatHidePreviews"

    struct Stored: Codable {
        var current: String?
        var keys: [String: String]
    }

    // MARK: - Keychain

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keysService,
            kSecAttrAccount as String: keysAccount,
            kSecAttrAccessGroup as String: accessGroup,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    static func load() -> Stored? {
        var query = baseQuery
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Stored.self, from: data)
    }

    @discardableResult
    static func save(_ stored: Stored) -> Bool {
        guard let data = try? JSONEncoder().encode(stored) else { return false }
        SecItemDelete(baseQuery as CFDictionary)
        var item = baseQuery
        item[kSecValueData as String] = data
        // Readable while the phone is locked (after its first unlock), so previews open on the Lock
        // Screen; never synced to iCloud, never restored onto another phone.
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    static func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    static func key(_ id: String?) -> SymmetricKey? {
        guard let id, let stored = load(), let text = stored.keys[id], let raw = base64URLDecode(text), raw.count == 32 else { return nil }
        return SymmetricKey(data: raw)
    }

    static var currentKeyId: String? { load()?.current }

    static var previewsHidden: Bool { UserDefaults(suiteName: accessGroup)?.bool(forKey: hidePreviewsKey) ?? false }

    // MARK: - Sealing and opening

    static func aad(_ field: String, sender: String, kind: String) -> Data {
        Data("kiriya.love/chat/v1|\(field)|\(sender)|\(kind)".utf8)
    }

    static func open(_ sealed: String, key: SymmetricKey, aad: Data) -> [String: Any]? {
        guard let bytes = base64URLDecode(sealed), bytes.count >= 28,
              let box = try? AES.GCM.SealedBox(combined: bytes),
              let plain = try? AES.GCM.open(box, using: key, authenticating: aad),
              let object = try? JSONSerialization.jsonObject(with: plain) as? [String: Any]
        else { return nil }
        return object
    }

    static func seal(_ value: [String: Any], key: SymmetricKey, aad: Data) -> String? {
        guard var plain = try? JSONSerialization.data(withJSONObject: value) else { return nil }
        let size = ((plain.count + 1 + 31) / 32) * 32
        plain.append(contentsOf: [UInt8](repeating: 0x20, count: size - plain.count))
        guard let box = try? AES.GCM.seal(plain, using: key, authenticating: aad), let combined = box.combined else { return nil }
        return base64URLEncode(combined)
    }

    /// The words of a sealed chat notification (server/lib/chatKeys.js sealedNotification):
    /// `sealed` = { k: key id, s: sender, t: kind, c: clientId, n: sealed preview | b: sealed body }.
    static func preview(_ sealed: [String: Any]) -> String? {
        guard let keyId = sealed["k"] as? String, let sender = sealed["s"] as? String, let kind = sealed["t"] as? String,
              let key = key(keyId) else { return nil }
        let clientId = sealed["c"] as? String
        if let n = sealed["n"] as? String, let opened = open(n, key: key, aad: aad("notify", sender: sender, kind: kind)) {
            guard clientId == nil || opened["c"] as? String == clientId else { return nil }
            return opened["t"] as? String
        }
        if let b = sealed["b"] as? String, let opened = open(b, key: key, aad: aad("message", sender: sender, kind: kind)) {
            guard clientId == nil || opened["c"] as? String == clientId else { return nil }
            let text = (opened["t"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return kind == "text" ? String(text.prefix(180)) : nil
        }
        return nil
    }

    /// A reply typed into a notification, sealed like the app seals one: the body, plus the preview
    /// her phone's notification shows. Nil when there's no chat key here (the chat isn't sealed yet).
    static func sealReply(_ text: String, clientId: String, sender: String) -> (body: String, enc: [String: Any])? {
        guard let id = currentKeyId, let key = key(id),
              let body = seal(["c": clientId, "t": text], key: key, aad: aad("message", sender: sender, kind: "text")),
              let notify = seal(["c": clientId, "t": String(text.prefix(180))], key: key, aad: aad("notify", sender: sender, kind: "text"))
        else { return nil }
        return (body, ["v": 1, "k": id, "n": notify])
    }

    // MARK: - base64url

    static func base64URLDecode(_ text: String) -> Data? {
        var value = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while value.count % 4 != 0 { value.append("=") }
        return Data(base64Encoded: value)
    }

    static func base64URLEncode(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
