# DFO Companion

A desktop companion for DFO Online, for **Windows** and **Apple Silicon Macs**. Equipment, inventory search and comparisons, quests, town and 3D dungeon maps, nearest services, and an optional paired phone view.

The dashboard reuses bounded idle-time snapshots. UI actions, maps, service searches, comparisons, and update checks do not add game reads. The companion never closes the game.

## Downloads

Get the latest Windows installer or Mac app from [Releases](https://github.com/yedgar93/dfo-companion/releases). Both include Electron and the Daggerfall app icon; a separate Node installation is not needed.

Mac builds use free ad-hoc signing in GitHub Actions. No paid Apple account is required. The first installation may need macOS's normal Open Anyway confirmation.

## Development

For work from a new computer or AI tool, start with [the development handoff](docs/DEVELOPMENT_HANDOFF.md) and [repository working rules](AGENTS.md). They record the game integration findings, performance requirements, past regressions, current limitations, and release workflow.

Install Node 22.15 or newer, clone the repository, then run `npm ci` and `npm start`.

- `npm test` runs isolated tests with mocked game data and temporary local servers.
- `npm run test:visual` checks desktop/phone interactions using synthetic fixtures in offscreen Electron and writes reviewable captures to `visual-results/`. It never connects to the game.
- `npm run test:mobile` runs touch-enabled WebKit and Chromium fixture checks at three phone sizes; install engines first with `npx playwright install webkit chromium`. Captures and JSON results go to `visual-results/mobile/`. These are emulation checks, not physical iPhone verification.
- `npm run test:mobile:live` checks the installed Companion’s paired, cached phone view without game controls or full refreshes. Keep live captures private.
- `npm run dist:win` builds a Windows Electron installer on Windows.
- `npm run dist:mac` builds an Apple Silicon Electron app, ZIP and DMG on macOS.
- Runtime locations are discovered from the current OS and user account; assets are resolved relative to the app. No developer machine paths are required.

## Releases and updates

Every push to main runs tests and packages both platforms in GitHub Actions. Increment `version` in `package.json` for a new release. When both platform jobs pass, the workflow publishes that version and its update metadata. A push with the same version only creates workflow artifacts; it never overwrites an existing release.

The app checks GitHub Releases after startup and every five minutes. New versions download automatically, replace the installed app, remove the old copy, and reopen the companion without taking game focus. Checks and downloads never read or restart DFO. Mac releases are verified against an Ed25519 public key embedded in the app; the private release-signing key is encrypted in GitHub Actions secrets. Windows uses the NSIS updater. Closing the companion normally stops its reader and leaves it closed. See [release setup](docs/RELEASING.md).

## Scope

This is an unofficial community companion. Original game archives, character snapshots, connection tokens, and extracted game installations are not included. Artwork is read from the user's installed game and cached locally. The Daggerfall icon is used for identification; original game artwork remains owned by its respective rights holders. Third-party code and font notices are retained.
