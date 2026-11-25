import Capacitor
import UIKit

/// The app's screen: Capacitor's web view, plus
/// - iOS's own edge swipe to go back a page (it follows the web view's history, which includes the
///   site's in-app page changes), and
/// - the notification delegate taken back from Capacitor's router, which claims it while the bridge
///   starts (KiriyaNotifications.swift). Taps and "Open" are still forwarded to that router.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        if let router = bridge?.notificationRouter {
            KiriyaNotificationDelegate.shared.attach(router)
        }
    }
}
