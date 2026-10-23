# Repository working rules

Before continuing development in a new chat or tool, read `docs/DEVELOPMENT_HANDOFF.md`. Keep it current when findings or integration behavior change.

This is the canonical source for DFO Companion. Keep changes portable between Windows and Apple Silicon Mac. Resolve packaged files relative to the app and installations from the current OS/user environment.

Preserve smooth gameplay: no additional game reads for UI features, maps, comparisons, tooltips, service searches, phone pairing, or updater checks. Reuse the current bounded idle-time snapshots. Never restart or control DFO to install a companion update.

Closing the last window must stop the companion reader and exit the app. Automatic updates may briefly run an installer to replace and reopen only the companion without taking game focus.

Keep fixes local and batch them. Do not increment versions, push, or publish until the user explicitly requests a new release. Once the user requests deployment, increment the patch version with `npm version patch --no-git-tag-version`, commit package.json and package-lock.json with the change, and push main when authorized. GitHub Actions builds both Electron apps and publishes the new version only when both jobs pass. Wait for the release outcome; do not claim it is live while builds are running or failing. Existing managed installs update from that release.

Keep the pinned Ed25519 public key. Its private half lives only in the repository's UPDATE_SIGNING_KEY Actions secret. Never generate a replacement key casually or commit credentials, game archives, character snapshots, logs, caches, or local testing artifacts.
