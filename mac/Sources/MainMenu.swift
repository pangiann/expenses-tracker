import Cocoa

/// The menu bar: Expenses, Edit, View and Window menus.
enum MainMenu {
    static func build(reloadAction: Selector, reloadTarget: AnyObject) -> NSMenu {
        let menuBar = NSMenu()
        menuBar.addItem(menuItem(containing: applicationMenu()))
        menuBar.addItem(menuItem(containing: editMenu()))
        menuBar.addItem(menuItem(containing: viewMenu(reloadAction: reloadAction, reloadTarget: reloadTarget)))

        let windowMenu = windowMenu()
        menuBar.addItem(menuItem(containing: windowMenu))
        NSApp.windowsMenu = windowMenu
        return menuBar
    }

    private static func applicationMenu() -> NSMenu {
        let menu = NSMenu(title: "Expenses")
        menu.addItem(withTitle: "About Expenses",
                     action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Hide Expenses", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Expenses", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        return menu
    }

    /// Without this menu, ⌘C, ⌘V and ⌘Z don't reach the page's text fields.
    private static func editMenu() -> NSMenu {
        let menu = NSMenu(title: "Edit")
        menu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        menu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        menu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        menu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        menu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        return menu
    }

    private static func viewMenu(reloadAction: Selector, reloadTarget: AnyObject) -> NSMenu {
        let menu = NSMenu(title: "View")
        let reloadItem = menu.addItem(withTitle: "Reload", action: reloadAction, keyEquivalent: "r")
        reloadItem.target = reloadTarget
        return menu
    }

    private static func windowMenu() -> NSMenu {
        let menu = NSMenu(title: "Window")
        menu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        menu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        return menu
    }

    private static func menuItem(containing submenu: NSMenu) -> NSMenuItem {
        let item = NSMenuItem()
        item.submenu = submenu
        return item
    }
}
