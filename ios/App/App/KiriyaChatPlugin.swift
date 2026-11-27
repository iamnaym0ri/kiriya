import Capacitor
import Security
import UIKit

/// The chat's native helpers (src/lib/chatCrypto/native.js), registered in MainViewController:
/// - setKeys / hasKey / clear: the chat keys in the Keychain the extensions read
///   (KiriyaShared/KiriyaChatCrypto.swift);
/// - setIdentity / getIdentity: each person's private key, this device only and only for the app
///   itself, so a phone that opens with Face ID never needs the passphrase again;
/// - setPrivacy: with the chat lock on, a soft cover hides the messages from the app switcher's
///   snapshot, and notification previews stay "a new message ♡".
@objc(KiriyaChatPlugin)
public class KiriyaChatPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KiriyaChatPlugin"
    public let jsName = "KiriyaChat"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setKeys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPrivacy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private let identityService = "love.kiriya.app.chat-identity"
    private var coverOn = false
    private var cover: UIView?

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(willResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(didBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: chat keys

    @objc func setKeys(_ call: CAPPluginCall) {
        guard let incoming = call.getObject("keys") as? [String: String] else {
            call.reject("Missing keys")
            return
        }
        var stored = KiriyaChatCrypto.load() ?? KiriyaChatCrypto.Stored(current: nil, keys: [:])
        for (id, raw) in incoming where KiriyaChatCrypto.base64URLDecode(raw)?.count == 32 {
            stored.keys[id] = raw
        }
        if let current = call.getString("current") { stored.current = current }
        // A handful of keys at most (one per reset); keep the newest few.
        if stored.keys.count > 12, let current = stored.current {
            stored.keys = stored.keys.filter { $0.key == current || incoming[$0.key] != nil }
        }
        KiriyaChatCrypto.save(stored) ? call.resolve() : call.reject("Keychain error")
    }

    @objc func hasKey(_ call: CAPPluginCall) {
        let id = call.getString("id")
        call.resolve(["has": KiriyaChatCrypto.key(id) != nil])
    }

    @objc func clear(_ call: CAPPluginCall) {
        KiriyaChatCrypto.clear()
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: identityService] as CFDictionary)
        call.resolve()
    }

    // MARK: this person's private key

    private func identityQuery(_ role: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: identityService,
            kSecAttrAccount as String: role,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    @objc func setIdentity(_ call: CAPPluginCall) {
        guard let role = call.getString("role"), ["kiriya", "admin"].contains(role),
              let publicKey = call.getString("publicKey"), let privateKey = call.getString("privateKey"),
              let data = try? JSONSerialization.data(withJSONObject: ["publicKey": publicKey, "privateKey": privateKey])
        else {
            call.reject("Missing identity")
            return
        }
        SecItemDelete(identityQuery(role) as CFDictionary)
        var item = identityQuery(role)
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil) == errSecSuccess ? call.resolve() : call.reject("Keychain error")
    }

    @objc func getIdentity(_ call: CAPPluginCall) {
        guard let role = call.getString("role") else {
            call.resolve([:])
            return
        }
        var query = identityQuery(role)
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data,
              let found = try? JSONSerialization.jsonObject(with: data) as? [String: String]
        else {
            call.resolve([:])
            return
        }
        call.resolve(["publicKey": found["publicKey"] ?? "", "privateKey": found["privateKey"] ?? ""])
    }

    // MARK: the chat lock's privacy cover

    @objc func setPrivacy(_ call: CAPPluginCall) {
        let hidePreviews = call.getBool("hidePreviews") ?? false
        UserDefaults(suiteName: KiriyaChatCrypto.accessGroup)?.set(hidePreviews, forKey: KiriyaChatCrypto.hidePreviewsKey)
        DispatchQueue.main.async {
            self.coverOn = call.getBool("cover") ?? false
            if !self.coverOn { self.removeCover() }
        }
        call.resolve()
    }

    @objc private func willResignActive() {
        guard coverOn, cover == nil, let window = bridge?.viewController?.view.window else { return }
        let view = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterialLight))
        view.frame = window.bounds
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        let tint = UIView(frame: view.bounds)
        tint.backgroundColor = UIColor(red: 0.95, green: 0.91, blue: 0.97, alpha: 0.55)
        tint.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.contentView.addSubview(tint)
        let lock = UIImageView(image: UIImage(systemName: "lock.heart.fill"))
        lock.tintColor = UIColor(red: 0.56, green: 0.39, blue: 0.68, alpha: 1)
        lock.contentMode = .scaleAspectFit
        lock.translatesAutoresizingMaskIntoConstraints = false
        view.contentView.addSubview(lock)
        NSLayoutConstraint.activate([
            lock.centerXAnchor.constraint(equalTo: view.contentView.centerXAnchor),
            lock.centerYAnchor.constraint(equalTo: view.contentView.centerYAnchor),
            lock.widthAnchor.constraint(equalToConstant: 56),
            lock.heightAnchor.constraint(equalToConstant: 56),
        ])
        window.addSubview(view)
        cover = view
    }

    @objc private func didBecomeActive() {
        removeCover()
    }

    private func removeCover() {
        cover?.removeFromSuperview()
        cover = nil
    }
}
