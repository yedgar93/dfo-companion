#!/bin/sh
set -eu
PARENT_PID=$1
ARCHIVE=$2
TARGET=$3
VERSION=$4
LOG=$5
REOPEN=$6
exec >> "$LOG" 2>&1
case "$PARENT_PID" in *[!0-9]*|'') exit 1;; esac
case "$TARGET" in /*/DFO\ Companion.app) ;; *) exit 1;; esac
COUNT=0
while /bin/kill -0 "$PARENT_PID" 2>/dev/null; do
 COUNT=$((COUNT+1)); [ "$COUNT" -lt 60 ] || exit 1
 /bin/sleep 1
done
ROOT=$(dirname "$ARCHIVE")
STAGE="$ROOT/unpacked"
/bin/mkdir -p "$STAGE"
/usr/bin/ditto -x -k "$ARCHIVE" "$STAGE"
SOURCE="$STAGE/DFO Companion.app"
SOURCE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$SOURCE/Contents/Info.plist")
SOURCE_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$SOURCE/Contents/Info.plist")
TARGET_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TARGET/Contents/Info.plist")
[ "$SOURCE_ID" = org.dfo-companion.desktop ] && [ "$TARGET_ID" = org.dfo-companion.desktop ] && [ "$SOURCE_VERSION" = "$VERSION" ] || exit 1
/usr/bin/codesign --verify --deep --strict "$SOURCE"
NEW="$TARGET.update-$$"
BACKUP="$TARGET.previous-$$"
[ ! -e "$NEW" ] && [ ! -e "$BACKUP" ] || exit 1
/usr/bin/ditto "$SOURCE" "$NEW"
/bin/mv "$TARGET" "$BACKUP"
if /bin/mv "$NEW" "$TARGET"; then
 [ "$BACKUP" = "$TARGET.previous-$$" ] && /bin/rm -rf -- "$BACKUP"
 [ "$STAGE" = "$ROOT/unpacked" ] && /bin/rm -rf -- "$STAGE"
 /bin/rm -f -- "$ARCHIVE"
 if [ "$REOPEN" = 1 ]; then /usr/bin/open -g "$TARGET"; fi
 echo 'Companion update installed. The game was not changed.'
else
 /bin/mv "$BACKUP" "$TARGET"
 exit 1
fi
