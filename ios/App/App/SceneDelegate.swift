import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        // Opened from a long-press quick action ("Open chat", "Pull a note", "Send a ♡"):
        // @capawesome/capacitor-app-shortcuts hands it to the web page as a `click` event.
        if let shortcutItem = connectionOptions.shortcutItem {
            Self.forward(shortcutItem)
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // A quick action while the app was already running.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        Self.forward(shortcutItem)
        completionHandler(true)
    }

    // The plugin's own names (AppShortcutsPlugin.notificationName / .userInfoShortcutItemKey),
    // spelled out so this file needn't import the plugin's module.
    private static func forward(_ shortcutItem: UIApplicationShortcutItem) {
        NotificationCenter.default.post(name: NSNotification.Name("handleAppShortcutNotification"), object: nil,
                                        userInfo: ["shortcutItem": shortcutItem])
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
