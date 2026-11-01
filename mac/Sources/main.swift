// Expenses: a native macOS window around the expenses tracker web page.
// Build and install with mac/build.sh.

import Cocoa

let application = NSApplication.shared
let appDelegate = AppDelegate()
application.delegate = appDelegate
application.setActivationPolicy(.regular)
application.run()
