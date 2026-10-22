# Release setup

The public release feed is `yedgar93/dfo-companion` on GitHub. The Actions workflow requires only its scoped `GITHUB_TOKEN` for ordinary build artifacts and releases. No GitHub token is embedded in the app.

For signed, notarized Mac builds add these repository Actions secrets:

- `MAC_CSC_LINK`: base64 Apple Developer ID Application certificate (.p12)
- `MAC_CSC_KEY_PASSWORD`: certificate password
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`: notarization account

For Windows signing optionally add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

Without Apple credentials, Mac builds are ad-hoc signed and distributed for manual installation; the app checks for releases and opens their download page, but never attempts an unsupported automatic Mac installation. Windows NSIS updates support download and install-on-companion-quit. No update restarts or sends commands to DFO.

Change package.json version (for example 0.4.0 to 0.4.1), commit, and push main. The first successful push of a version publishes a release only after Windows and Mac builds both pass. Ordinary commits on that version upload workflow artifacts without altering its published release. Release metadata is published with the complete set of installers, ZIPs, DMGs, hashes and blockmaps.

The local manually assembled Mac package used before this repository is not an automatic-update-capable installation. Install one repository release once to switch to the managed update channel.
