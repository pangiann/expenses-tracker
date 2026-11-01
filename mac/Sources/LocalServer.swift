import Foundation

/// Starts, checks and stops the Python server (server/main.py) that the page talks to.
final class LocalServer {
    static let port = 8765
    static let pageURL = URL(string: "http://127.0.0.1:\(port)/")!
    private static let healthCheckURL = URL(string: "http://127.0.0.1:\(port)/api/months")!
    private static let pythonExecutable = URL(fileURLWithPath: "/usr/bin/python3")

    let logFileURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/expenses-tracker.log")

    /// Called on the main thread if the server stops by itself (not when we stop it).
    var onUnexpectedExit: ((Int32) -> Void)?

    private let projectDirectory: URL
    private var serverProcess: Process?     // set only when this app started the server
    private var isStoppingOnPurpose = false

    init(projectDirectory: URL) {
        self.projectDirectory = projectDirectory
    }

    /// True when a server answers on the port, whoever started it.
    func isResponding() -> Bool {
        var request = URLRequest(url: Self.healthCheckURL)
        request.timeoutInterval = 1
        let responseReceived = DispatchSemaphore(value: 0)
        var isHealthy = false
        URLSession.shared.dataTask(with: request) { _, response, _ in
            isHealthy = (response as? HTTPURLResponse)?.statusCode == 200
            responseReceived.signal()
        }.resume()
        _ = responseReceived.wait(timeout: .now() + 1.5)
        return isHealthy
    }

    func start() throws {
        let serverScript = projectDirectory.appendingPathComponent("server/main.py")
        guard FileManager.default.fileExists(atPath: serverScript.path) else {
            throw LocalServerError.serverScriptMissing(serverScript.path)
        }

        let process = Process()
        process.executableURL = Self.pythonExecutable
        process.arguments = ["-u", serverScript.path, "--no-browser"]  // -u: write log lines immediately
        process.currentDirectoryURL = projectDirectory
        process.standardInput = FileHandle.nullDevice
        let logFile = try openLogFile()
        process.standardOutput = logFile
        process.standardError = logFile
        process.terminationHandler = { [weak self] finishedProcess in
            DispatchQueue.main.async { self?.handleExit(of: finishedProcess) }
        }

        isStoppingOnPurpose = false
        try process.run()
        serverProcess = process
    }

    /// Polls until the server answers, then calls `completion(true)`; `false` after the timeout.
    func waitUntilResponding(timeout: TimeInterval, completion: @escaping (Bool) -> Void) {
        let deadline = Date().addingTimeInterval(timeout)
        func poll() {
            DispatchQueue.global().async {
                let isUp = self.isResponding()
                DispatchQueue.main.async {
                    if isUp { return completion(true) }
                    if Date() > deadline || self.serverProcess?.isRunning == false { return completion(false) }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: poll)
                }
            }
        }
        poll()
    }

    /// Stops the server if this app started it. A server started elsewhere keeps running.
    func stop() {
        guard let process = serverProcess, process.isRunning else { return }
        isStoppingOnPurpose = true
        process.interrupt()  // SIGINT, the same as Ctrl+C: the server shuts down cleanly
        let deadline = Date().addingTimeInterval(3)
        while process.isRunning && Date() < deadline { usleep(50_000) }
        if process.isRunning { process.terminate() }
    }

    private func handleExit(of finishedProcess: Process) {
        serverProcess = nil
        if !isStoppingOnPurpose { onUnexpectedExit?(finishedProcess.terminationStatus) }
    }

    private func openLogFile() throws -> FileHandle {
        if !FileManager.default.fileExists(atPath: logFileURL.path) {
            FileManager.default.createFile(atPath: logFileURL.path, contents: nil)
        }
        let logFile = try FileHandle(forWritingTo: logFileURL)
        logFile.seekToEndOfFile()
        return logFile
    }
}

enum LocalServerError: LocalizedError {
    case serverScriptMissing(String)

    var errorDescription: String? {
        switch self {
        case .serverScriptMissing(let path):
            return "\(path) not found. Rebuild the app with mac/build.sh."
        }
    }
}
