# Verification and acceptance

## Automated checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Browser verification (run the dev server first) uses Playwright:

```sh
npx playwright install chromium
npm run test:browser
```

Alternatively set `PLAYWRIGHT_EXECUTABLE_PATH` to an existing Chromium-based browser executable. Browser tests verify that every protected route requires sign-in, no unauthenticated preview is available, and the login form works on desktop and mobile without overflow. Authenticated dashboard checks require an authorized Firebase account.

Security rule integration tests require Java 21+ and Firebase CLI:

```sh
npx firebase-tools emulators:exec --only database --project demo-classroom "npm run test:rules"
```

Tests assert exact 32/35°C boundaries, missing-data statistics, denied anonymous/unauthorized access, viewer read-only access, device isolation, range/type validation, server timestamps, bounded queries, failed sensor heartbeats, and idempotent event retries.

Motion regression tests use nonchronological keys from different device boots, detections older than the selected time window, and more than 1,000 subsequent non-motion events. They exercise the actual last-motion subscription, including live updates and the no-detections case. Device-status tests cover freshness expiry after power loss and unavailable status when the browser loses its database connection.

Quick-motion tests verify that newer PIR start/stop events update the current state between snapshots, that a delayed snapshot uses its `sampledAt` capture time for ordering, and that older events cannot override a newer captured state. Firebase freshness continues to use the server-generated `timestamp`. Test on hardware with a brief PIR pulse between the normal five-second snapshots; verify both transitions in the log and that the current label follows the newest reported state. Network latency can delay delivery, and a movement that has already stopped must not be shown as ongoing motion.

When a short pulse has already stopped, Overview shows Recent motion and explicitly says the PIR is now idle. This indication lasts ten seconds from the recorded detection, subject to the selected display refresh interval, and is hidden when device status is unavailable or offline. The Motion page continues to show the current PIR state with a separate recent-detection note.

Temperature event tests also reject alert labels that contradict their recorded temperature, including exactly 32°C and 35°C. Access-revocation tests verify that Firebase cancels an existing live telemetry listener. The dashboard clears affected data when a listener is denied and resets readings when the signed-in account changes.

The warning integration test writes a device event and verifies delivery through the same bounded timestamp query used by Alert History. Events use `type: "warning"` (or `normal` / `danger`), the occurrence time in milliseconds as `timestamp`, and a Firebase server timestamp as `receivedAt`. The older `type: "temperature_status", status: "warning"` format is rejected by the rules and is not supported by the dashboard. Firmware must also record the initial valid temperature state so booting while already above 32°C produces an alert.

## Physical-device and cloud acceptance matrix

Occupancy state-machine assertions are in `tests/occupancy-firmware.cpp` and compile the exact shared Arduino `occupancy.h` implementation. Compile with a C++17 compiler, for example:

```sh
g++ -std=c++17 -c tests/occupancy-firmware.cpp -o occupancy-test.o
```

These assertions cover startup, the exact 600-second timeout, motion extension, continuous HIGH signals, repeated state stability, and unsigned millisecond-clock rollover. TypeScript tests separately cover stale/offline, missing legacy fields, and invalid occupancy values. Database tests verify that the device can store all three states and transition events while viewers remain read-only, and reject invalid states, timeouts, or an inactive estimate with motion HIGH.

These tests need your configured Firebase project and ESP32.

| Test | Expected result |
|---|---|
| Controller turns monitoring off | Pending state until device reports paused; all LEDs off, no sensor history, heartbeat continues |
| Controller turns monitoring on | Fresh DHT reading; PIR monitoring resumes; occupancy starts a new observation window |
| Viewer attempts control or controller targets another device | Database denies the write |
| Paused device restarts or loses Wi-Fi | Last applied paused mode remains; no false live measurements; reconnect fetches latest command |
| Old firmware or offline device | Control unavailable; no claim that a command was applied |
| Power on with PIR HIGH during warm-up | Warming-up message; LEDs off and no monitoring/network startup for 60 seconds; ready message before PIR processing |
| PIR undisturbed for two minutes after ready | Raw value logged once per second; record whether LOW appears or HIGH persists for sensor/wiring investigation |
| Valid temperature ≤32°C (including exactly 32) | Green LED on; normal UI |
| Temperature >32°C and ≤35°C (including exactly 35) | Green off; red toggles every 300ms; warning UI says Blinking |
| Temperature >35°C | Red continuously on; danger UI |
| PIR false→true→true→false | One detection and one stop event; motion LED follows input |
| DHT unplugged or returns NaN | Local monitoring continues; sensor error heartbeat; no invalid history; error shown |
| DHT recovers | Valid readings and one recovery event |
| Device Wi-Fi disconnected | Local DHT/PIR/LEDs continue; dashboard stale after timeout |
| Wi-Fi restored | Automatic reconnect; bounded queue drains; connection-restored event |
| Firebase unavailable / permission revoked | Backoff; no loop blocking; local LEDs work; no unauthorized writes |
| Device power removed | Dashboard offline after trusted timestamp ages; old values not presented as current |
| PIR HIGH, then LOW for less than ten minutes | Occupancy stays Likely occupied while current motion may be idle |
| PIR remains HIGH or motion repeats | Occupancy timer renews; no duplicate occupancy transition while status stays the same |
| Full ten-minute quiet interval | One No recent activity transition, without claiming confirmed vacancy |
| Device restarts | Occupancy unknown until motion or a full observation window; previous occupancy is not restored as current |
| Missing occupancy fields in older readings | Occupancy unknown; no browser-side inference or fabricated historical states |
| Browser network disconnected | Database-disconnected message; freshness ages; reconnect listener recovers |
| Browser on a separate mobile network | Same authenticated live data as local-network browser |
| Device online for >65 minutes | ID token renews; uploads continue |
| Unauthenticated database request | Permission denied |
| Viewer writes telemetry | Permission denied |
| Device writes another device | Permission denied |
| Sign out | Protected interface is replaced by sign-in; listeners removed |
| Phone + keyboard navigation | Menu, account controls, labels, filters, focus visibility and table scrolling work |

Long-period queries intentionally load at most 1,500 readings and 1,000 events. Counts and statistics describe loaded samples, not a guaranteed complete period when capped. Retain data with the maintenance script and increase sophistication through aggregates only when the project needs it.
