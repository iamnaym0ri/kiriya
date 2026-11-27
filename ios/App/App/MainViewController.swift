import Capacitor
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
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
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
