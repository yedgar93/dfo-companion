# DFO Companion: development handoff

Last reconciled: 2026-10-22. Current release source: **0.4.10**; the last fully verified packaged baseline was **0.4.9** for Windows x64 and Apple Silicon macOS. This is a durable handoff for a new developer, chat, or AI tool; it does not require access to the original conversation or original development computer.

Read this file, `AGENTS.md`, `README.md`, and `docs/RELEASING.md` before changing the application. Inspect the current source and latest release: this document records findings at the baseline, not a promise that future game versions have identical internals. Keep this document updated as findings change.

## Repository and portable setup

- Public canonical repository: https://github.com/yedgar93/dfo-companion
- Default development branch: `main`.
- `0.4.10` release source commit: `15b87de8d58ef60f62425162811f7edb68188c12`.
- Clone on the current machine; no original developer checkout, external skill, local screenshot, private snapshot, or removable drive is required.
- Node >=22.15: `npm ci`, `npm test`, `npm run build`, `npm start`.
- `npm run dist:win` builds Windows x64 NSIS on Windows.
- `npm run dist:mac` builds Apple Silicon arm64 ZIP and DMG on macOS. Intel Mac support was explicitly declined.
- GitHub Actions supplies both native build environments. Do not require a Windows developer to produce a native Mac build locally.
- Runtime dependencies are pinned in the lockfile. Read `package.json` rather than installing arbitrary latest versions.
- Never hard-code a developer username, drive, installed game path, cache location, or original artwork folder. OS-relative discovery and app-relative resources apply to development builds too.
- The requested app icon is the Daggerfall dragon D, already in repository assets. Preserve Windows icon, Mac Dock/Finder icon, and dashboard identification.

## Product requirements and collaboration rules

The companion is a separate Electron application window, visually an extension of DFO: game font, compact controls, game-style borders, real equipment artwork and layered paperdoll. The user does not want a browser tab, generic web styling, or an oversized header.

Critical requirements:

1. Smooth gameplay takes priority. Previous companion reads were the cause of severe recurring game stutters; closing the companion eliminated them. Do not attribute this to the game server without evidence.
2. Keep automatic live updates. Making the user manually refresh is not an acceptable performance fix. The explicit Refresh all button is an optional safe-time action, not the normal update mechanism.
3. UI calculations, searches, comparisons, alerts, camera movement, and service lookup reuse existing snapshots/local metadata. No additional inspector polling, game scans, or synchronous full map copies for UI features.
4. No ongoing AI calls or token use in the finished dashboard. This does not limit development effort.
5. Never close, restart, modify, or take control of DFO to install a companion update. Game launch is an explicit Connection-page action and refuses an already-running game.
6. Closing the last companion window must stop its reader and exit the companion, including on Mac. No persistent background reader after normal close.
7. Keep the interface inside the viewport; use internal scrolling/collapsible content. Show item details on hover and keyboard focus without requiring repeated clicks.
8. Keep manual dungeon camera orientation until the user clicks Face objective. **Do not add an idle-time camera reset.** A proposed 15-second reset was explicitly cancelled.
9. Batch fixes locally. **Do not bump versions or publish for every small fix. The user will explicitly request a release.** Documentation requested in the repo may be committed/pushed without creating a new app version.
10. Verify actual running/packaged behavior before saying fixed/live. A source edit, test preview, build artifact, and published release are different states. Avoid repetitive status messages and unsupported claims of live verification.

## Architecture and file guide

| Area | Main files | Responsibility |
| --- | --- | --- |
| Electron window/lifecycle | `desktop/main.cjs`, `desktop/service.mjs`, `desktop/window-state.cjs` | Own window, helper process, identity handshake, bounds, shutdown, updater feedback |
| Automatic updates | `desktop/updates.cjs`, `desktop/mac-updater.cjs`, `desktop/mac-install-update.sh` | Check/download/status, signed Mac replacement, Windows NSIS integration |
| Legacy migration | `desktop/legacy-helper.mjs` | Retire only positively identified old companion helpers; never broad process killing |
| Game discovery/start | `src/portable-startup.mjs` | Current-user/OS installation discovery; guarded explicit launch |
| Game transport/proof | `src/transport.mjs`, `src/cached-module.mjs`, `src/automatic-profile.mjs`, `src/review-compatibility.mjs`, `src/reviewed-bundles.json` | Identify correct game renderer and source-matched own-player references |
| Snapshot acquisition | `src/reader.mjs`, `src/dashboard-fast-reader.mjs`, `src/dashboard-dungeon-reader.mjs` | Bounded own-field copies, idle slices, geometry/marker events |
| Projection/caching | `src/dashboard-worker.mjs`, `src/dashboard-model.mjs` | Cache latest result, derive UI data, preserve freshness/scene identity |
| Local HTTP + phone | `src/dashboard-server.mjs`, `src/dashboard-phone.mjs`, `src/dashboard-qr.mjs` | Allowlisted resources, local API, paired private-network view |
| Browser UI | `src/dashboard.html`, `src/dashboard-ui.mjs`, `src/dashboard.css`, `src/dashboard-mobile.*` | Pages, interaction, compact responsive layout |
| Character record | `src/dashboard-character.mjs` | Skills, class modifiers, standing and reputation from snapshots |
| Equipment | `src/dashboard-items.mjs`, `src/dashboard-alerts.mjs` | Search, sorting, compatible-slot comparisons, quiet alerts |
| Maps | `src/dashboard-map-ui.mjs`, `src/dashboard-map-model.mjs`, `src/dashboard-interior-ui.mjs`, `src/dashboard-interior-model.mjs`, `src/dashboard-dungeon-route.mjs` | Town/region view, 3D explored dungeon, camera/trail/routes |
| Quest data | `src/quest-tracker.mjs`, `src/journal.mjs` | Current tracker versus historical journal; destinations |
| Artwork | `src/item-icon-assets.mjs`, `src/paperdoll-assets.mjs`, `src/paperdoll-plan.mjs`, `src/local-art.mjs`, `src/archive-io.mjs` | Icon mapping, texture decode, real layered preview, local-original discovery |
| Offline data | `src/service-catalog.json`, `src/vendor/dfo-formats/*`, metadata JSON files | Services, classic image formats, reviewed static mappings |
| Bundle/build | `scripts/build-bundle.mjs`, `scripts/build-icons.mjs`, `electron-builder.cjs` | Embed resources, build label/icon, package both platforms |

Do not develop against old manually assembled packages or unrelated historical checkouts. Generated `desktop/DFO-Companion.mjs`, icons/build identity files, caches, and `dist/` are build outputs, not alternative canonical sources.

## Game connection and performance findings

DFO Online is not interchangeable with classic Daggerfall or Daggerfall Unity. Current minified module names, export aliases and patch hashes change. Verify behavior against the installed game's executed source. Historical aliases in comments are evidence for a specific build, not stable APIs.

- Optional official-game startup uses loopback diagnostic address `127.0.0.1`, port **9223**. Never expose the game inspector on the network.
- Game page identity is checked, including the `dagger://game/play/index.html` context. Do not attach to arbitrary browser pages or another application's listener.
- Connection setup proves source/realm/player ownership before retaining references. `automatic-profile.mjs` derives profiles from reviewed structural fingerprints, requiring unique matches. Do not bypass ambiguity merely to accept every game update.
- `compatibility.mjs` has a historical supported version constant. An installed package version alone is not proof of the actual executed game-store patch or an already-running renderer.
- Reinspect on genuine scene/context invalidation, not every movement sample. In-game updates/relaunches can drop launch flags; they cannot be added to an already-running process.
- Own-player reads use own data descriptors. Do not invoke getters or arbitrary game methods to obtain convenient computed values. Preserve refusal of peer/nonplayer surfaces, collection bounds, redaction and unavailable values.
- Core position/vitals updates target **500 ms**, backing off toward **4000 ms** if copies are expensive. Current guard doubles the interval after >2 ms copies, and cautiously recovers after sustained <0.5 ms copies. These are source constants, not guaranteed latency under load.
- Detail inventory data is assembled in idle slices, initially **8 items** per slice, shrinking if a slice exceeds 1 ms; the detail cycle pauses about **4 seconds** between completed copies. Idle work may defer when frame budget is low. UI/HTTP refresh frequency is not the same as a game read.
- Renderer-owned push/binding updates avoid recurring heavy inspector evaluations. Keep pose/vitals independent of full inventory, quest and artwork work.
- Town geometry is copied incrementally and reused for the same tile/blocks. Current metadata handoff waits for scene readiness, rather than scanning everything synchronously at a location change.
- Dungeon geometry copies only revealed automap parts, in chunks of at most **1024 numbers**, with per-part and total bounds. Current total bound is **1,000,000 numbers**. Do not turn this into whole-scene/entity traversal.
- Dungeon marker work begins around 1 second and backs off when costly. Scene keys/serials reject stale events from a previous dungeon.
- Native Map operations are used in reviewed copies where needed to avoid game overrides; no arbitrary game accessors should be called.
- Character social/legal/guild fields were added to the existing base snapshot. Changed faction reputations are bounded to 96 output rows / 1024 visited entries, with a partial flag. Do not mislabel these as an unbounded complete faction database.
- A synthetic 1024-faction base-copy benchmark was approximately 0.06 ms median / 0.13 ms p95 on one development machine. This is **not** proof of live game frame performance on every machine.

If stuttering returns: inspect existing guard timings, lane, copy costs, scene-change work and repeated source setup before changing intervals. Reproduce movement and inside/outside transitions. Do not solve it by disabling automatic data.

## Freshness, identity and local server

- Companion HTTP backend: **127.0.0.1:9234**. Optional phone listener normally uses **9235** on a private LAN interface, with subnet/session restrictions.
- `/api/live` is a compact cached state used for UI updates. `/api/state` supplies detail data when its version changes. `/api/brief` is a small cached answer view. These must not trigger extra game sampling.
- `/api/identity` includes an instance token. Electron verifies its own helper's random token before opening the window. This prevents silently opening an older helper on the same port.
- Local mutations are narrowly validated POST requests: explicit `/api/game/start` and rate-limited `/api/refresh`. Do not add arbitrary expressions, file paths or process controls to them.
- Pairing QR/link/code expires and rotates. The Connection page refreshes it automatically on expiry/visibility; phone-pairing refresh does not read DFO.
- Last-known data is useful but must be marked stale. Connection success is a verified character read, **not multiplayer server-health telemetry**.
- Runtime cache root is OS/user-relative `DFOCompanion` beneath local app data/cache, with optional environment override. Read `dashboard-resources.mjs` for exact resolution.

## Maps, navigation and quest findings

### Town and wilderness

- Town maps support zoom, pan, following position, pinned buildings, and a named destination. Keep destination visible when following; manual exploration must remain possible.
- Label sizes/placement were repeatedly problematic. Keep labels compact, avoid collisions with the pinned name, and make markers/list entries unambiguously correspond. Do not rely on a large floating name alone.
- Pinned destinations use the actual building name rather than just Objective, and stand out in the building list.
- Nearest-service finder belongs in its own row **under map controls, outside the map**, not over the compass or above the quest banner.
- Finder must work in wilderness too. The offline catalogue contains roughly 6000 locations and 31 categories, including shops, banks, inns, stables, guilds, knightly orders, temples and covens. Use catalogue evidence/coverage limits; do not invent a guild affiliation for an unidentified generic hall.
- A straight bearing line is not a walkable route. Label that distinction.
- Town changes and entering/leaving buildings must update automatically, even if the UI is on another page. Do not keep a stale dungeon image after travel.

### Dungeon

- Current 3D view is explored dungeon geometry, not a screenshot and not a full hidden dungeon reveal. Supports drag orbit, shift-drag pan, wheel zoom, plan/floor controls, Fit dungeon, Follow Me and Face objective.
- Walked trail is distinct from an objective route. A straight distance/marker does not establish connected corridors.
- Paths are estimated only across known connected explored geometry. Reject walls, disconnected floors and unexplored gaps. Preserve an explicit unresolved route instead of drawing a misleading line.
- Objective coordinates come from the game's existing objective-marker source; entrance/exit comes from the game's own marker and discovery state, not a guessed first triangle.
- User discovered that quest targets/markers were present in a **private dungeon instance**, whereas earlier public-instance visits lacked them. This was a concrete finding for those quests, not proof that all public instances always lack quest content.
- Exact guidance selected in the game does not guarantee that the current instance exposes a target. Do not give repeated nonexistent-target directions.
- Player arrow heading must use the same 3D projection as the camera, including rotation wraparound. Manual camera orbit previously made the arrow spin incorrectly.
- Manual orbit/pan persists. Face objective explicitly resumes objective-facing behavior. No 15-second idle reset.
- Separate 2D town and 3D dungeon canvases. A canvas already acquired as 2D cannot be repurposed as WebGL. This caused false waiting-for-interior-position messages and stuck transitions.
- Use scene identity and fresh pose first; a legitimate outside/dead/travel state should not claim an interior coordinate exists. Never conflate an invalidated dungeon with a still-loading map.

### Quest tracker

- Distinguish the game's active tracked objective from journal focus and old journal text. Preserve source/freshness labels.
- Show current step and confirmed destination; historical completed entries must not become a current navigation target.
- A target name alone is not verified position evidence. If giving navigation, fixed bearings and landmarks age better than left/right from an old snapshot while the user is moving.
- The earlier star/escort/courier conversations contained mistaken or superseded gameplay advice. Do **not** encode those recommendations or player-specific NPC destinations as companion mechanics.

## Equipment, artwork and character data

### Equipment and comparisons

- Compatible slot and hand rules matter: two-handed weapons can displace a shield, alternate hands and paired jewellery slots need careful comparison, and class/material restrictions must be respected.
- Green arrow = known-stat upgrade, amber = trade-off, question mark = insufficient data. Do not use one grey arrow for all cases. Equipped slot buttons also indicate a better compatible item in the pack.
- Condition-only improvement is not a stat upgrade. Compare underlying equipment and identify Upgrade after repair when applicable. Do not hide a true upgrade solely because the incoming piece is worn.
- Preserve explicit gains/losses/unknowns and displaced-item effects. Missing base stats are not zero and magical suffixes alone do not prove an upgrade.
- Inventory supports sorting and bonus/name search. Swap previews and destination pinning operate locally and never equip items in DFO.
- Quiet alerts are dashboard-only, no sound or notification spam. Existing thresholds: health <30%, worn combat gear condition <=20%, and carrying >=90% only when weights/capacity are verified. Preserve cooldown/recovery/dismiss semantics.

### Lantern

This regression occurred twice and has a concrete source-level explanation:

- `player.lightSource` is the currently **lit** light, not the entire equipment state.
- A lantern hung on the belt has own item field `beltLantern === true`, template index **248**, and remains equipped while unlit.
- Companion maps the active light, or a belt lantern when there is no active light, to synthetic slot **27 (Light)**. Preserve active-light precedence to avoid duplicate slot contents.
- Do not equip every spare lantern in inventory. Removing the belt flag must remove the unlit item from the slot.
- Tests cover both full copies and sliced inventory. No getter or game equipment mutation is involved.

### Artwork

- Use actual game item artwork and real layered paperdoll, not generic replacement icons or a cropped screenshot. Keep accessories in a compact single row.
- The dashboard uses DFO Enhanced Plus's exact embedded gauntlet cursor frames. The paperdoll backdrop and character are composited separately so the backdrop covers the full portrait viewport; the subtle idle breath affects only the upper character layer while the legs and feet remain fixed. This is presentation-only, respects reduced-motion preferences, and adds no game reads or redraw polling. The header reads `Daggerfall Online Companion`; its packaged-version button invokes the existing manual update check through a narrow sandboxed preload bridge.
- Sources include installed game ASAR sprite PNGs and original ARENA2 indexed files (palette + TEXTURE archives). Custom DFO items are not all in the classic template catalogue.
- Electron virtualizes ASAR filesystem paths. Ordinary fs opening the game `app.asar` can produce EISDIR. `archive-io.mjs` uses Electron `original-fs` when appropriate and normal fs outside Electron. Preserve this abstraction.
- `item-icon-assets.mjs` maps item template/material/race/gender/dye, decodes/crops transparent indexed pixels and caches PNGs. Use the reviewed template records, not name-based art guesses.
- Graded gems **1900..1931** reuse ordinary gem images, base index `(templateIndex - 1900) % 8`. Perfect Turquoise previously had no art because its graded ID was unmapped.
- Fifteen additional source-matched custom template records were added in 0.4.5, including Materials Bag (600) and Field Repair Kit (692). After a later missing-art report for Dwarven Thunderlock, Dwemer Pellet and Fishing-Net, the existing bounded owned-template detail copy began carrying each game's own world/player texture fields into the item snapshot. Unknown/custom templates therefore use the same registered template art as the installed game rather than requiring a companion template list. Dwarven Thunderlock retains its source-reviewed inventory-only record override (560/1 instead of its paperdoll layer 560/0). Some special image-provider rules may still require source review; do not claim every image has been verified on an actual packaged Mac/PC build.
- Game native config lives beneath OS application support/app data in **Daggerfall JavaScript/config.json** (or the game's `DAGGER_USER_DATA` override), with `arena2Path` when a native original folder was selected.
- **In-game imported originals may have no arena2Path at all** (`arena2InGame` mode). The companion cannot infer an arbitrary original folder from that. In 0.4.5, the Electron menu gained **Locate game artwork…**, validating ART_PAL.COL and TEXTURE.216 and remembering the selection in companion user data, without changing game settings.
- The companion automatically reads the desktop game's pinned `Daggerfall JavaScript/config.json` and its `arena2Path`; the menu chooser is only a fallback. If a remembered companion override is stale or incomplete, discovery continues to the game's current configured folder instead of stopping at the first config file.
- `DFO_COMPANION_ART_CONFIG` passes the companion's selected config path to its own helper. `local-art.mjs` checks that before the game profile, handles filename case, bounds reads, and does not recursively scan disks.
- Current item icon asset loader is **local-only** (`rawFiles(..., {cacheOnly:true})`, which still permits configured disk originals). It uses texture addresses already included in the existing bounded detail snapshot; it does not add an artwork poll, inspector evaluation, or IndexedDB asset read. Do not reintroduce those reads for inventory icons.
- DFO vendor stand-in archives can exceed three digits (Foraging uses 11600-11606). Installed-ASAR sprite lookup accepts those archive names and source-known aliases such as `gun-icon.png` / `gun-ammo.png`; ARENA2 fallback remains limited to real three-digit `TEXTURE.*` archives.
- A missing raw texture/palette must not discard available vendor icons. A missing ASAR sprite index must not prevent local-original fallback. Handle each source independently.
- Icon cache namespace is `item-icons-v4-*` (v3 → v4 when Campfire 541 and the rest items 1700-1706 were mapped). Only complete results for supported plans are persisted; partial in-memory results retry after ~30 seconds. Changes to decoder/mappings may require cache namespace invalidation. A null unsupported plan is different from a failed supported plan.
- Some older paperdoll/map raw-asset code still contains a bounded IndexedDB fallback; do not mistake that for authorization to call it from new UI features. Audit call sites when investigating frame stalls.

### Character tab (0.4.5+, usable after 0.4.6 route fix)

- Current/base attributes, current/base skills grouped by career primary/major/minor/miscellaneous, vitals, gold, armour and carrying summary.
- Reviewed career flags decode class advantages/disadvantages, weapon expertise/restrictions, material/shield/armour restrictions, resistances/immunities/weaknesses, healing/absorption, and magery modifiers. Do not reinterpret them using generic Elder Scrolls assumptions.
- Standing fields: `sGroupReputations`, `legalRep`, `guildMemberships`, and bounded nonzero `factionRep.dict` rows with own id/name/rep.
- Social group order currently shown: Commoners, Merchants, Scholars, Nobility, Underworld.
- Membership records may use separate mortal/vampire banks. Preserve both, probation flags, and recorded numeric ranks. Current UI does **not** resolve all rank titles or authoritative live promotion requirements.
- Legal region names are derived from the offline catalogue. Unknown region IDs remain explicit.
- This is not yet a complete reproduction of every game sheet/standing feature. Racial passive completeness, transformed racial modifiers, full zero-reputation faction browsing, promotion conditions, and additional derived combat/effect stats need source review and tests before claiming parity.
- Missing values must be Unavailable/waiting, not fabricated zeros. Character data reuses existing snapshots; do not add a dedicated stat-refresh inspector loop.

## Desktop updates, lifecycle and security

- Startup is Connection by default; first fresh live character automatically switches to Pack **once**. Further manual page choices remain usable. Old UI-reload session data must not put a disconnected startup on Pack.
- Window normal bounds/maximized state are persisted. Restore monitor/position including negative coordinates; clamp onto a remaining monitor if a display was disconnected.
- Automatic restart uses an inactive reopen, not game focus theft. Do not add always-on-top as a workaround.
- Automatic update check: about **1 second after launch**, then every **5 minutes**. Development/unpackaged apps do not auto-update.
- Update UI: Checking, download percentage, a **5-second** explanatory pre-restart notice, then Installing. Use `var(--game-font)` rather than a new system font. No confirmation click required.
- Last-window-close shuts down the owned helper gracefully, with bounded kill fallbacks for its exact PID only. Mac must not remain as a hidden running reader.
- Legacy helpers require positive identity, listener ownership, user identity and exact companion executable/command verification before termination. Never kill all Electron/Node processes, use process-tree kills indiscriminately, or terminate a game process.
- Mac uses a custom updater because no paid Apple Developer account/notarization is desired. Ad-hoc OS signing is distinct from the cryptographic release signature.
- Pinned Ed25519 public key: `assets/update-public-key.json`; private key exists only as **UPDATE_SIGNING_KEY** in GitHub Actions secrets. Never casually regenerate or rotate it: existing installed clients trust the old public key.
- Mac checks repository/version/asset identity, signed SHA-256 and size, downloads to its own cache, verifies unpacked app identity/version/ad-hoc signature, waits for the old companion PID, replaces atomically, removes backup/staging/archive, then reopens only the companion. Installation from AppTranslocation is refused; use a writable Applications location.
- Windows uses electron-updater + NSIS. Preserve verified download before restart and existing update metadata generation.
- No repository credentials or signing secrets in code, logs, documentation or releases. Do not print credential-manager output in debugging.

## Build, route and test pitfalls learned here

**Important regression:** 0.4.5 bundled `dashboard-character.mjs` but omitted its allowlisted HTTP route. The browser could not load the static import, so **the entire dashboard UI script failed**: tab clicks, launch button and startup selection all appeared broken. 0.4.6 fixed the route.

For every new browser module/resource:

1. Add it to `scripts/build-bundle.mjs` embedded resources.
2. Add its explicit route and correct MIME type in `src/dashboard-server.mjs`.
3. Include UI-affecting modules in UI-version invalidation as appropriate.
4. Run `src/test/dashboard-module-graph.test.mjs`, which follows the complete browser import graph through the actual server. A generic preview server that serves every source file will hide allowlist defects.
5. Verify the packaged app too. A successful direct-source browser preview is insufficient.

Other lessons:

- A hidden layout test script once had a quoting error and opened an Electron main-process error dialog. Syntax-check temporary scripts before running them; use a truly offscreen renderer, not a window that can unexpectedly interrupt the user's desktop. Clean up only the exact test PID. Never touch DFO.
- Hidden-window captures can show an old compositor frame even after DOM changes. Use Electron offscreen rendering and verify selected-tab DOM state, not just a stale capture.
- Offscreen real-server test for 0.4.6 verified: disconnected Connection visible, tabs clickable, mocked Start game called exactly once, live transition to Pack, then manual return to Connection persists. It did not launch the actual game.
- Last baseline suite: **278 passing checks**. This count will change as the repo evolves. `npm test` uses mocked game data and temporary local HTTP servers, not live DFO.
- Two legacy skill-environment-dependent tests are excluded by `scripts/test.mjs`: `guide-skill.test.mjs` and `review-regressions.test.mjs`. Do not assume external developer skills exist on another computer.
- Restricted sandboxes can block loopback tests or temporary Windows file replacement (EACCES/EPERM). Distinguish sandbox limitations from app regressions; do not weaken tests to make those errors disappear.
- On Windows, use native PowerShell filesystem operations and checked absolute targets for cleanup. Do not mix shells for recursive deletes/moves.
- Build signing config removes empty CSC/Apple credential environment variables. An empty CSC_LINK previously made electron-builder treat a directory as a certificate path.
- Windows and macOS tests must use native path handling; earlier hard-coded separators broke the Mac build.

## Release procedure and verification

See `docs/RELEASING.md` and the workflow for current details.

1. Complete and test the user's authorized change locally. Inspect staged files for private data or generated artifacts.
2. Wait for an explicit release request. Then `npm version patch --no-git-tag-version`; commit both package files and intended changes; push main.
3. Every push to main runs both native jobs. An already-published package version produces CI artifacts, **not a replacement release**. A documentation-only push need not increment the app version.
4. Workflow publishes only after **both** native jobs succeed. Mac includes `scripts/smoke-mac-install.mjs` native replacement checks.
5. Wait for workflow completion. Verify public release assets, latest*.yml and `update-manifest.json` + binary `update-manifest.sig`. Verify signature with the pinned public key. Never say live while a build is queued/running/failing.
6. Expected artifacts include Windows x64 EXE and blockmap; Mac arm64 ZIP/DMG and blockmaps; update metadata; signed manifest; SHA256SUMS.
7. Users receive updates automatically. A fix to startup-check timing or restart messaging only takes effect **after** the older app installs the new release; the old updater still controls the first transition.
8. Do not revert to manually copying packages to a removable drive for normal distribution. GitHub releases replaced that temporary workflow.

Public workflow/release status can be read through GitHub's API or normal GitHub UI. Use the current environment's GitHub authorization for writes; never depend on credentials from the original machine. Public key recovery is in the repo; private signing-key management remains with the repository owner.

## Known gaps and sensible next work

- Actual-device missing artwork reports motivated 0.4.5. Some original artwork requires the one-time ARENA2 folder selection; some new/custom item mappings are still unsupported. No evidence yet that every Mac/PC item image is fixed. Verify representative jewellery, graded gems, lantern, books, ingredients, cards and custom items on real packaged builds.
- Character tab is broad but not full game parity; see explicit limitations above. Do not describe rank numbers as translated rank titles or offer unsupported stat mechanics.
- Navigation must remain honest when objective/exit or connectivity is absent. Test private/public instance changes, death, travel and re-entry; do not reuse yesterday's target coordinates.
- Preserve performance during location handoffs. This repeatedly regressed even when steady-state polling looked acceptable.
- Earlier conversation approved a compact dungeon navigation summary, a local What changed? feed, and map-view undo for a future fix. Their full implementation is **not established by this handoff**; inspect before planning them.
- Loadout workbench, dungeon bookmarks and protected sell-shortlist were discussed as ideas, not evidence of completed features.
- Keep README, this handoff and tests aligned with actual implementation. A future AI should distinguish requests, code, tests, synthetic previews, user confirmation and release evidence.

## Upgrade scoring (phase 1, inventory only)

- `src/upgrade-scoring.mjs` is pure and uses only fields already in the detail snapshot. `comparisonContext` now also carries live attributes, level, race, class name, primary/major skill indices and the carrying summary, all copied from the existing snapshot (no new reads).
- Weapons: expected damage per swing = mean over the displayed damage range (already material-adjusted) of max(0, roll×(1+damage affix%) + STR damageModifier + expertise + racial), times hit chance against a stated reference foe (monster armour 5: +15), with skill, expertise, racial, material×10, luck/agility and expected Critical Strike, clamped 3..97 (DFO `combat/formulas.js`, DFU `FormulaHelper`).
- Armour: per body part, rating×5 plus armour-affix points, weighted by the struck-part table (2,3,3,4,4,3,1 of 20) = average enemy hit-chance points blocked per blow (DFO `armorMaterials.js`, `ui/armourCard.js`).
- Green only with a gain (>2% per swing or >=0.25 points) and no meaningful loss or unknown. Comparisons are computed once per pack snapshot, never on hover.
- Reconciled with daggerfall-js-source @a75e96b5: weapon min/max are template-only (`weapons.js:257`, `formulas.js:165`); material adds `weaponMaterialModifier` once per hit (`formulas.js:486`) and ×10 to hit. The displayed range (`itemInfo.js:297`, companion `item-details.mjs`) is base + modifier once; the "double" in the source is ArmourMod's display (`itemInfo.js`, DFU "Armour mod is double what classic displays"), not weapon damage. Critical Strike adds to hit only.
- Armour: parts start at 100, each rating point ×5 off; clothing Shoes/Tall boots/Boots (147-149, 186-188) count as leather on Feet, sandals do not (`equip.js:452+`). Special non-shield pieces stay "?" because the snapshot cannot tell an artifact (halved) from other specials.
- Enchantments from the existing `enchantments` copy: Strengthens Armor (12) −5 on every part, non-stacking; Weakens Armor (24) inert — `enchantments.js:131-136` keeps DFU's `<` setter on purpose (bug-for-bug), so it never applies; Increased Weight Allowance (7) +25%/+50%, highest only. Other types stay "?".
- Not modelled (JS-only hooks that can diverge from DFU): `weaponDamageMods` beyond the loot damage affix, `damageScale`, mentor armour scaling, `entityArmorPoints` beyond armour affixes.

## Dungeon map: unstored automap records and scene keys (fix/dungeon-map)

- Some floors (generated levels, arena floors; game `dungeonContext.js` ~8270) bind a live automap record that is never put in the `${regionIndex}/${name}` store, and `restoreAutomap` can swap the stored record. The idle reader used to wait forever for `mapRecord(mapAccessor())===view.rec`. It now asks for a new reference once per scene; if the record still differs and the reference is for this scene, it copies `view.rec`/`view.model` (status `unstored-record`). Reader status reaches the Map footer through `result.dungeonReader`.
- The canonical dungeon key is computed from the raw game location (`loc.dungeonSceneKey`) before `readFastDashboard` applies the place-table name; match, reference refresh and UI use it. The match also accepts the renamed key.
- TEMP-DEBUG: a "Copy map debug" button (Map tab, Interior view, empty rooms only) in `dashboard-map-ui.mjs`/`dashboard.html`. Remove once the issue is confirmed fixed in game.
