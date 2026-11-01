import Cocoa
import WebKit

/// The app's single window, showing the expenses page in a WebKit view.
final class MainWindowController: NSObject, WKUIDelegate, WKNavigationDelegate {
    let window: NSWindow
    private let webView: WKWebView

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()  // the page keeps nothing in WebKit; data lives in data/
        webView = WKWebView(frame: .zero, configuration: configuration)

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false)
        window.title = "Expenses"
        window.minSize = NSSize(width: 720, height: 500)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("ExpensesMainWindow")  // remembers size and position

        super.init()
        webView.uiDelegate = self
        webView.navigationDelegate = self
    }

    var isShowingExpensesPage: Bool {
        webView.url?.host == LocalServer.pageURL.host
    }

    func show() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func loadExpensesPage() {
        webView.load(URLRequest(url: LocalServer.pageURL))
    }

    /// Replaces the page with a centered status or error message.
    func showMessage(_ message: String) {
        let escapedMessage = message
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
        webView.loadHTMLString("""
            <html><body style="font-family:-apple-system;background:#f4f5f9;color:#6b7288;display:flex;
            align-items:center;justify-content:center;height:100vh;margin:0;font-size:15px;text-align:center;padding:40px">
            \(escapedMessage)</body></html>
            """, baseURL: nil)
    }

    /// Asks the page to write any edit still waiting to be saved. Gives up after `timeout`.
    func flushPendingSave(timeout: TimeInterval, completion: @escaping () -> Void) {
        guard isShowingExpensesPage else { return completion() }
        var hasCompleted = false
        let completeOnce = {
            guard !hasCompleted else { return }
            hasCompleted = true
            completion()
        }
        webView.callAsyncJavaScript(
            "await window.expensesApp?.flushPendingSave(); return true;",
            arguments: [:], in: nil, in: .page) { _ in completeOnce() }
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout, execute: completeOnce)
    }

    // MARK: WKNavigationDelegate

    /// Links that leave the app open in the default browser.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .linkActivated,
           let linkURL = navigationAction.request.url,
           linkURL.host != LocalServer.pageURL.host {
            NSWorkspace.shared.open(linkURL)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // MARK: WKUIDelegate: JavaScript alert() and confirm() as native sheets

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { clickedButton in
            completionHandler(clickedButton == .alertFirstButtonReturn)
        }
    }
}
