#!/usr/bin/env bash
# scripts/package-dmg.sh — Create a distributable DMG from Snaky.app
#
# Prerequisites:
#   Run build.sh first to create build/release/Snaky.app
#
# Output: build/release/Snaky.dmg

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RELEASE_DIR="$PROJECT_DIR/build/release"
APP_BUNDLE="$RELEASE_DIR/Snaky.app"
DMG_OUTPUT="$RELEASE_DIR/Snaky.dmg"
DMG_STAGING="$PROJECT_DIR/build/dmg-staging"

VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP_BUNDLE/Contents/Info.plist" 2>/dev/null || echo "0.0.0")

if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "ERROR: $APP_BUNDLE not found."
    echo "       Run ./scripts/build.sh first."
    exit 1
fi

echo "==> Packaging Snaky v$VERSION into DMG..."

rm -rf "$DMG_STAGING"
rm -f "$DMG_OUTPUT"
mkdir -p "$DMG_STAGING"

echo "==> Copying Snaky.app to staging..."
cp -R "$APP_BUNDLE" "$DMG_STAGING/"

ln -s /Applications "$DMG_STAGING/Applications"

echo "==> Creating DMG..."
hdiutil create \
    -volname "Snaky" \
    -srcfolder "$DMG_STAGING" \
    -ov \
    -format UDZO \
    -fs HFS+ \
    "$DMG_OUTPUT" > /dev/null 2>&1

VERSIONED_OUTPUT="$RELEASE_DIR/Snaky-v$VERSION.dmg"
cp "$DMG_OUTPUT" "$VERSIONED_OUTPUT"

rm -rf "$DMG_STAGING"

DMG_SIZE=$(du -sh "$DMG_OUTPUT" | cut -f1)
echo ""
echo "==> DMG created!"
echo "    Output:    $DMG_OUTPUT"
echo "    Versioned: $VERSIONED_OUTPUT"
echo "    Size:      $DMG_SIZE"
echo "    Version:   $VERSION"
