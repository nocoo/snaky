#!/usr/bin/env bash
# scripts/release-gh.sh — Build, sign, package DMG, and create GitHub release
#
# Usage:
#   ./scripts/release-gh.sh
#   ./scripts/release-gh.sh --skip-build --skip-package
#   ./scripts/release-gh.sh --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$PROJECT_DIR/build/release"
APP_BUNDLE="$RELEASE_DIR/Snaky.app"
DMG_PATH="$RELEASE_DIR/Snaky.dmg"

SKIP_BUILD=false
SKIP_PACKAGE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-package)
            SKIP_PACKAGE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip-build] [--skip-package] [--dry-run]"
            exit 1
            ;;
    esac
done

VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PROJECT_DIR/Sources/Snaky/Resources/Info.plist" 2>/dev/null || echo "0.0.0")
TAG="v$VERSION"
VERSIONED_DMG="$RELEASE_DIR/Snaky-$TAG.dmg"

echo "==> Releasing Snaky $TAG"

if [[ "$SKIP_BUILD" == false ]]; then
    "$SCRIPT_DIR/build.sh"
fi

if [[ "$SKIP_PACKAGE" == false ]]; then
    "$SCRIPT_DIR/package-dmg.sh"
fi

if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "ERROR: $APP_BUNDLE not found."
    exit 1
fi

if [[ ! -f "$DMG_PATH" ]]; then
    echo "ERROR: $DMG_PATH not found."
    exit 1
fi

cp "$DMG_PATH" "$VERSIONED_DMG"

if [[ "$DRY_RUN" == true ]]; then
    echo "==> Dry run"
    echo "    Tag: $TAG"
    echo "    DMG: $VERSIONED_DMG"
    exit 0
fi

if gh release view "$TAG" >/dev/null 2>&1; then
    echo "==> Uploading to existing release $TAG..."
    gh release upload "$TAG" "$VERSIONED_DMG" --clobber
else
    echo "==> Creating release $TAG..."
    gh release create "$TAG" "$VERSIONED_DMG" \
        --title "$TAG" \
        --notes "Snaky macOS v$VERSION — Menu bar network probe & latency tester"
fi

echo ""
echo "==> GitHub release ready"
echo "    Tag:   $TAG"
echo "    Asset: $VERSIONED_DMG"
