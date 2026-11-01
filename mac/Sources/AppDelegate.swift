import Cocoa

/// App lifecycle: start the server and show the page on launch, save and stop the server on quit.
final class AppDelegate: NSObject, NSApplicationDelegate {
    private static let serverStartTimeout: TimeInterval = 20
    private static let saveBeforeQuitTimeout: TimeInterval = 3

    private let mainWindow = MainWindowController()
    private let localServer: LocalServer

    override init() {
        // mac/build.sh writes the project folder into Info.plist under this key.
        let projectPath = Bundle.main.object(forInfoDictionaryKey: "ExpensesProjectDir") as? String ?? ""
        localServer = LocalServer(projectDirectory: URL(fileURLWithPath: projectPath))
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = MainMenu.build(reloadAction: #selector(reloadPage(_:)), reloadTarget: self)
        mainWindow.show()
        localServer.onUnexpectedExit = { [weak self] exitCode in
            guard let self else { return }
            self.mainWindow.showMessage(
                "The server stopped (exit code \(exitCode)). See \(self.localServer.logFileURL.path). Press ⌘R to restart.")
        }
        startServerAndShowPage()
    }

    /// ⌘R: reload the page, restarting the server first if it isn't running.
    @objc func reloadPage(_ sender: Any?) {
        startServerAndShowPage()
    }

    private func startServerAndShowPage() {
        if localServer.isResponding() {  // already running, for example started from Terminal
            return mainWindow.loadExpensesPage()
        }
        mainWindow.showMessage("Starting…")
        do {
            try localServer.start()
        } catch {
            return mainWindow.showMessage("Could not start the server: \(error.localizedDescription)")
        }
        localServer.waitUntilResponding(timeout: Self.serverStartTimeout) { [weak self] isUp in
            guard let self else { return }
            if isUp {
                self.mainWindow.loadExpensesPage()
            } else {
                self.mainWindow.showMessage(
                    "The server did not start. See \(self.localServer.logFileURL.path).")
            }
        }
    }

    // MARK: Quitting

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    /// Lets the page save its last edit before the app quits.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        mainWindow.flushPendingSave(timeout: Self.saveBeforeQuitTimeout) {
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    func applicationWillTerminate(_ notification: Notification) {
        localServer.stop()
    }
}
