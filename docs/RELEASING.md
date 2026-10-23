# Release setup

GitHub Actions builds Windows and Apple Silicon Mac apps on every push to main. When a release is explicitly requested, increase the package.json version (see [AGENTS.md](../AGENTS.md)). Both jobs must pass before a complete release and its update metadata are published. Existing releases are never overwritten.

No paid Apple account is required. The Mac runner applies a free ad-hoc signature. Every release also includes an Ed25519-signed manifest containing artifact names, sizes and SHA-256 hashes. The app pins the public verification key in `assets/update-public-key.json`; `UPDATE_SIGNING_KEY` is encrypted in repository Actions secrets. Never rotate that key without a migration release trusted by the old key.

Mac updates verify the release signature and ZIP hash, download in the background, stop only the companion, verify the unpacked app identity/version and macOS signature, replace the installed app atomically, delete the old app, and reopen the new one without taking game focus. Install into a writable Applications folder such as ~/Applications. Windows uses electron-updater with the NSIS installer. DFO is never restarted.

The companion checks about one second after startup and every five minutes. It shows download progress and a five-second explanation before automatically closing and reopening to install, using the dashboard font. A normal window close quits its reader too. During an automatic update a short-lived installer may run after the window closes; it exits after replacement and relaunch.

For a release, increment `version` in package.json, commit and push main (or push its matching vX.Y.Z tag). Users install one release manually; later versions update themselves.

Optional Apple Developer/Windows signing credentials are supported by the build config, but are not required for the free update path. Do not embed repository tokens, private keys, game archives or character caches in the app.
