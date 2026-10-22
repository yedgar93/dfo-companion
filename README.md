# DFO Companion

A desktop companion for DFO Online, for **Windows** and **Apple Silicon Macs**. Equipment, inventory search and comparisons, quests, town and 3D dungeon maps, nearest services, and an optional paired phone view.

The dashboard reuses bounded idle-time snapshots. UI actions, maps, service searches, comparisons, and update checks do not add game reads. The companion never closes the game.

## Downloads

Get the latest Windows installer or Mac app from [Releases](https://github.com/yedgar93/dfo-companion/releases). Both include Electron and the Daggerfall app icon; a separate Node installation is not needed.

Mac builds are ad-hoc signed until Apple Developer signing credentials are configured. Use macOS's normal Open Anyway flow if prompted. Automatic Mac installation of updates is unavailable until a consistent Developer ID signature is configured; update checks can still link to downloads.

## Development

Install Node 22.15 or newer, clone the repository, then run `npm ci` and `npm start`.

- `npm test` runs isolated tests with mocked game data and temporary local servers.
- `npm run dist:win` builds a Windows Electron installer on Windows.
- `npm run dist:mac` builds an Apple Silicon Electron app, ZIP and DMG on macOS.
- Runtime locations are discovered from the current OS and user account; assets are resolved relative to the app. No developer machine paths are required.

## Releases and updates

Every push to main runs tests and packages both platforms in GitHub Actions. Increment `version` in `package.json` for a new release. When both platform jobs pass, the workflow publishes that version and its update metadata. A push with the same version only creates workflow artifacts; it never overwrites an existing release.

The app checks GitHub Releases after startup and every six hours. Checks and downloads never read the game. Choose **Download update** in the app menu when convenient; a downloaded supported update installs when you quit the companion. The game stays running. See [release setup](docs/RELEASING.md) for signing secrets and limitations.

## Scope

This is an unofficial community companion. Original game archives, character snapshots, connection tokens, and extracted game installations are not included. Artwork is read from the user's installed game and cached locally. The Daggerfall icon is used for identification; original game artwork remains owned by its respective rights holders. Third-party code and font notices are retained.
