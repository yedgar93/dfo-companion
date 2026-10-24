# Optional VoiceBox module

In the desktop app, open **Connection**. Directly below Quiet alerts, check
**Enable VoiceBox** and adjust **Volume**. These are the only speech controls.
The first enable downloads approximately 340 MB of pinned Kokoro model/English
voice data from Hugging Face, checks sizes and SHA-256 hashes, and warms the model.
Subsequent use is local. The model stays ready while enabled; disabling cancels
playback, detaches only the speech observer and exits its owned speech process.
The checkbox and volume persist. There is no terminal, separate browser, Python,
Windows accessibility reader, SAPI, external speech service or microphone.

Launch DFO yourself using **Start game with companion connection**, as before.
VoiceBox never starts, restarts or closes DFO. An already connected game is reused.
Turning speech off leaves Companion's normal connection and dashboard running.
The phone/browser view has no speech controls or remote speech API.

## Behavior carried forward

- Enhanced NPC Talk reads each new NPC entry once. Rebuilt DOM, copied markers,
  selected history and player questions do not replay answers. Attaching halfway
  through a conversation reads only the latest NPC entry.
- A new question interrupts the previous answer. Closing cancels stale work and
  plays a short generated farewell, preloaded while the conversation is open.
  Farewells vary without cycling all characters through the same order. The
  game's current NPC reaction/personal regard informs tone when safely available;
  otherwise neutral closings are used. Generated farewells are added by VoiceBox.
- Name-bank casting and explicit overrides retain male/female voice assignments.
  Shared names and ambiguous name banks are limitations, not reliable NPC IDs.
  The model has 28 English voices; automatic casting uses the tested pools and
  excludes `bm_fable` from automatic male selection.
- Pitch varies up to 15% per character. Pace defaults to 1.08 with 4% variation
  between characters. Both remain fixed throughout a sentence and consistent
  across a linked character's Talk, merchant/innkeeper lines and farewell.
- Whole grammatical sentences preserve connected words. At most 24 sentences
  are queued, with one sentence prefetched. Synthesis permits at most two jobs,
  with 16 MiB worker and 2 MiB ready-farewell caches. Exceptionally long sentences
  beyond the model's 510-phoneme limit are rejected rather than truncated.

## Coverage and limits

| Surface | Adapter / current evidence |
| --- | --- |
| Enhanced NPC Talk | `.talk-panel`; standalone real-game/user verification, integrated fixtures |
| Innkeeper rental prompt | `.tavern-win .px-note`; standalone real-game/user verification, integrated DOM fixture |
| Merchant/innkeeper offer | `.sb-ask`, `.yesnobox`, trade/dialog roots; quotes skip haggling narration; standalone real-game/user verification |
| Talk/service voice identity | Links business to the visible character when established; stored locally, tested fixtures |
| General enhanced notices | Visible rows/cells captured, toasts/hidden/outgoing content excluded; automatic notice speech off |
| Other quest/guild/service windows | Partial adapter coverage; every presentation has not been verified |
| Classic canvas dialogue | Unsupported by the DOM adapter |

The adapter follows visible UI and does not pin the entire game build. Game
updates can still change selectors or the bounded opinion lookup. Missing speech
does not block normal Companion use; universal compatibility is not promised.
No additional save scans, player polling, debugger pauses or heap snapshots are
introduced. Speech uses the reader's verified CDP connection and narrow pushed
DOM changes. The optional opinion lookup runs once per logical conversation,
within a 28-call/800 ms budget, and never invokes a game method or reads saves.

## Implementation and local data

`desktop/voicebox/` owns capture, policies, worker, inference and pinned assets.
`src/voicebox-ui.mjs` and `src/voicebox-audio.mjs` own the compact renderer controls
and Web Audio playback. Main/preload contain narrow, main-frame-only IPC hooks;
the data service shares its existing game transport with the capture adapter.
Nothing changes the equipment evaluator, updater keys, launcher action or saves.

Preferences and model cache live under Electron's `app.getPath('userData')`, in
`voicebox/settings.json` and `voicebox/models/`. Paths are discovered per OS/user;
no developer path is embedded. Disable first, close Companion normally, then
remove that `voicebox` directory to remove downloaded data. Uninstalling the app
does not remove game files or modify normal DFO launch behavior.

Runtime: pinned `onnxruntime-node` 1.30.0 and `phonemizer` 1.2.1, using Companion's
bundled Electron/Node. CPU is the portable fallback, with WebGPU tried when
available. Native files for only the current platform/architecture are packaged
outside ASAR; models are never committed or included in the installer. Optional
CUDA dependency downloads are disabled. Windows uses the portable Web Audio path
too. Apple Silicon packaging/native smoke tests run in CI; real Mac game speech,
latency and gameplay impact require a Mac play session.

## Validation boundary

The local Windows check passed 415 tests, existing desktop/phone visual checks,
native Electron controls with synthetic dialogue, and real cached Kokoro
synthesis/playback through both source and packaged ASAR modules. The isolated
tests never attach to DFO. Earlier standalone real-game speech remains separate
evidence; this first Companion-integrated build needs normal in-game listening
after installation. No integrated p50/p95 latency, ten-minute soak, controlled
FPS comparison or real Mac session is claimed.

Run `npm test`, `npm run test:voicebox`, `npm run test:visual`, and the normal
platform build. The optional `DFO_VOICEBOX_TEST_MODELS` environment variable points
the isolated native test at an already cached model directory for real synthesis;
without it, CI uses short generated audio fixtures and checks native library/
WASM loading. No model download or game access is required for CI tests.
