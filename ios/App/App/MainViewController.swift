import Capacitor
import Security
import UIKit
import WebKit

/// The app's screen: Capacitor's web view, plus
/// - iOS's own edge swipe to go back a page (it follows the web view's history, which includes the
///   site's in-app page changes). While a game is open the page turns it off
///   (`window.webkit.messageHandlers.kiriyaSwipeBack.postMessage(false)`, from the play hub's game
///   sheet), so a quick drag from the edge in a game can't close it by accident; `true` turns it
///   back on.
/// - the notification delegate taken back from Capacitor's router, which claims it while the bridge
///   starts (KiriyaNotifications.swift). Taps and "Open" are still forwarded to that router.
/// - the app's own small plugins (KiriyaKeychainPlugin below, and the chat's keys and privacy cover
///   in KiriyaChatPlugin.swift).
/// - the iPhone keyboard's own stickers and Genmoji in the chat's field (iOS 18+): WebKit offers and
///   inserts them ("adaptive image glyphs") only when the web view allows it and the field is a
///   rich contenteditable (src/world/chat/RichField.jsx takes each one out as a picture).
class MainViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        if #available(iOS 18.0, *) {
            configuration.supportsAdaptiveImageGlyph = true
        }
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(KiriyaKeychainPlugin())
        bridge?.registerPluginInstance(KiriyaChatPlugin())
        webView?.allowsBackForwardNavigationGestures = true
        webView?.configuration.userContentController.add(SwipeBackSwitch(owner: self), name: SwipeBackSwitch.name)
        if let router = bridge?.notificationRouter {
            KiriyaNotificationDelegate.shared.attach(router)
        }
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: SwipeBackSwitch.name)
    }
}

/// Receives the page's "kiriyaSwipeBack" messages. Holds the screen weakly: WebKit keeps its
/// message handlers strongly, so pointing it straight at the view controller would never free it.
private final class SwipeBackSwitch: NSObject, WKScriptMessageHandler {
    static let name = "kiriyaSwipeBack"
    private weak var owner: MainViewController?

    init(owner: MainViewController) {
        self.owner = owner
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let enabled = message.body as? Bool else { return }
        owner?.webView?.allowsBackForwardNavigationGestures = enabled
    }
}

/// "Open with Face ID" switched off in her settings (src/world/me, src/lib/native.js): the phone's
/// sign-in secret lives here instead of in the Face ID–protected item, so the app opens without a
/// prompt. One generic-password item, readable whenever the phone has been unlocked once since it
/// started, kept on this device only: never synced to iCloud Keychain and never restored to another
/// phone from a backup. Switching Face ID back on moves the secret back behind biometry and removes
/// this item.
@objc(KiriyaKeychainPlugin)
public class KiriyaKeychainPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KiriyaKeychainPlugin"
    public let jsName = "KiriyaKeychain"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    private let service = "love.kiriya.app.open"

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let account = call.getString("account"), let secret = call.getString("secret"), let data = secret.data(using: .utf8) else {
            call.reject("Missing account or secret")
            return
        }
        SecItemDelete(baseQuery as CFDictionary)
        var item = baseQuery
        item[kSecAttrAccount as String] = account
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        if status == errSecSuccess {
            call.resolve()
        } else {
            call.reject("Keychain error \(status)")
        }
    }

    @objc func get(_ call: CAPPluginCall) {
        var query = baseQuery
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnAttributes as String] = true
        query[kSecReturnData as String] = true
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let found = result as? [String: Any],
              let account = found[kSecAttrAccount as String] as? String,
              let data = found[kSecValueData as String] as? Data,
              let secret = String(data: data, encoding: .utf8)
        else {
            call.resolve(["account": NSNull(), "secret": NSNull()])
            return
        }
        call.resolve(["account": account, "secret": secret])
    }

    @objc func remove(_ call: CAPPluginCall) {
        SecItemDelete(baseQuery as CFDictionary)
        call.resolve()
    }
}
