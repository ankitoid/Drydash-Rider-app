## Plan: Hybrid Background Tracking with `react-native-background-actions`

### Goal
Add `react-native-background-actions` as the **primary** background mechanism that keeps the JS thread + socket alive (solving "socket stops emitting in background"), while keeping the existing native Kotlin service as a **backup** HTTP layer for maximum resilience against aggressive OEMs (Xiaomi/Redmi/Samsung).

### Why This Solves The Problem
- **`react-native-background-actions`** starts a real Android foreground service + persistent notification (the "Google Maps" behavior you described)
- It keeps the **JS thread alive in the background** → your socket stays connected and keeps emitting `riderLocationUpdate`
- You run `expo-location`'s `watchPositionAsync` inside the background task → continuous location updates
- The native Kotlin service runs **in parallel** as a pure-native backup (independent of JS) — if RN crashes or an OEM kills the JS task, the native service keeps posting HTTP every 5s

### New File: `services/backgroundTrackingService.ts`
A new module that wraps `react-native-background-actions`. It will:
- Start the background task with a persistent notification (title: "📍 Live Tracking Active", with Stop action)
- Inside the background task, run a `while (BackgroundService.isRunning())` loop that:
  - Gets current position via `expo-location` `getCurrentPositionAsync` every ~8 seconds
  - Sends via `sendRiderLocationUpdate()` (socket-first when foreground, HTTP-first when background)
  - Records distance via `trackingLegService.recordLocation()` when an active leg exists
- Expose `startBackgroundTracking(rider)` / `stopBackgroundTracking()` methods
- Handle the foregroundServiceType as `location` (required for Android 14+)

### Changes to Existing Files

**`package.json`** — Add dependency:
- `react-native-background-actions` (latest ^4.x)

**`services/locationService.ts`** — Update `startTracking()`:
- On Android (where native module exists): start BOTH
  1. The native Kotlin foreground service (HTTP backup, every 5s)
  2. The new `backgroundTrackingService` (JS-kept-alive, socket-based, every 8s)
- This dual-layer means even if one dies, the other keeps the admin panel updated
- Update `stopTracking()` to stop both
- The `usingNativeService` flag stays true (watchdog continues to check native service)

**`context/LocationContext.tsx`** — Minimal changes:
- The watchdog already checks native service state — no change needed there
- Update the native `onLocationUpdate` event handler: since the background task now handles JS-side location sending, we can simplify (the native event still updates `lastLocation` for UI)

**`services/socket.ts`** — Add background awareness:
- Add a ping/heartbeat emit every 25s when connected (prevents server-side socket timeout while in background)

**`app/_layout.tsx`** — No change (backgroundLocationTask import stays for Expo fallback definition)

### No Changes Needed
- `riderLocationUpdate.ts` — already fixed (HTTP-first in background)
- Native Kotlin files — already hardened (self-heal alarm, recurring notification refresh)
- `TaskNavigationMap.tsx` — already wires tracking extras to native; background-actions will piggyback on the existing tracking leg
- `AndroidManifest.xml` — already has `FOREGROUND_SERVICE_LOCATION`, `FOREGROUND_SERVICE`, `WAKE_LOCK`, `POST_NOTIFICATIONS`. `react-native-background-actions` will be auto-linked and adds its own service declaration via its manifest merge.

### How The Two Layers Work Together
```
┌─────────────────────────────────────────────────────┐
│  Layer 1: react-native-background-actions (PRIMARY) │
│  • Keeps JS thread alive in background              │
│  • watchPositionAsync → sendRiderLocationUpdate     │
│  • Socket emits riderLocationUpdate (low latency)   │
│  • Persistent "📍 Live Tracking Active" notification │
│  • Runs every 8 seconds                             │
├─────────────────────────────────────────────────────┤
│  Layer 2: Native Kotlin service (BACKUP)            │
│  • Pure-native HTTP POST every 5s (no JS needed)    │
│  • Self-heals via AlarmManager if killed            │
│  • Survives RN crashes / OEM JS-task kills          │
│  • Already built and hardened                       │
└─────────────────────────────────────────────────────┘
```
Both layers hit the same backend endpoint (`POST /api/v1/location/update`), which uses `findOneAndUpdate` upsert — so duplicate/overlapping updates are harmless (latest wins). The admin panel gets updates from whichever layer is alive.

### Files Changed
| File | Change |
|------|--------|
| `package.json` (NEW) | Add `react-native-background-actions` |
| `services/backgroundTrackingService.ts` (NEW) | Wrapper for background-actions + watchPositionAsync loop |
| `services/locationService.ts` | Start/stop both layers on Android |
| `services/socket.ts` | Add 25s keepalive ping |
| `context/LocationContext.tsx` | Minor: simplify native event handler |

### Build Note
After implementation, requires **`npx expo run:android`** (full native rebuild) because `react-native-background-actions` is a native module that needs autolinking + native build.