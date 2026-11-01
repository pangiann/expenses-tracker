#!/bin/zsh
# Builds Expenses.app and installs it in ~/Applications.
# Run again only after changing mac/Sources or moving the project folder;
# changes to web/, server/ and data/ need no rebuild.
set -euo pipefail

MAC_DIR="${0:A:h}"
PROJECT_DIR="${MAC_DIR:h}"
DEST="$HOME/Applications/Expenses.app"

# Build in a temporary folder that is deleted afterwards, so Spotlight only ever finds the installed app.
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
OUT="$BUILD_DIR/Expenses.app"

mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"

swiftc -O -swift-version 5 "$MAC_DIR"/Sources/*.swift -o "$OUT/Contents/MacOS/Expenses" -framework Cocoa -framework WebKit
cp "$MAC_DIR/Resources/Expenses.icns" "$OUT/Contents/Resources/Expenses.icns"

cat > "$OUT/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Expenses</string>
  <key>CFBundleDisplayName</key><string>Expenses</string>
  <key>CFBundleIdentifier</key><string>local.expenses-tracker</string>
  <key>CFBundleExecutable</key><string>Expenses</string>
  <key>CFBundleIconFile</key><string>Expenses</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>ExpensesProjectDir</key><string>$PROJECT_DIR</string>
</dict>
</plist>
EOF

codesign --force -s - "$OUT"

rm -rf "$DEST"
mv "$OUT" "$DEST"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST"
echo "Installed $DEST"
