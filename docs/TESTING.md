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

Temperature event tests also reject alert labels that contradict their recorded temperature, including exactly 32°C and 35°C. Access-revocation tests verify that Firebase cancels an existing live telemetry listener. The dashboard clears affected data when a listener is denied and resets readings when the signed-in account changes.

The warning integration test writes a device event and verifies delivery through the same bounded timestamp query used by Alert History. Events use `type: "warning"` (or `normal` / `danger`), the occurrence time in milliseconds as `timestamp`, and a Firebase server timestamp as `receivedAt`. The older `type: "temperature_status", status: "warning"` format is rejected by the rules and is not supported by the dashboard. Firmware must also record the initial valid temperature state so booting while already above 32°C produces an alert.

## Physical-device and cloud acceptance matrix

These tests need your configured Firebase project and ESP32.

| Test | Expected result |
|---|---|
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
| Browser network disconnected | Database-disconnected message; freshness ages; reconnect listener recovers |
| Browser on a separate mobile network | Same authenticated live data as local-network browser |
| Device online for >65 minutes | ID token renews; uploads continue |
| Unauthenticated database request | Permission denied |
| Viewer writes telemetry | Permission denied |
| Device writes another device | Permission denied |
| Sign out | Protected interface is replaced by sign-in; listeners removed |
| Phone + keyboard navigation | Menu, account controls, labels, filters, focus visibility and table scrolling work |

Long-period queries intentionally load at most 1,500 readings and 1,000 events. Counts and statistics describe loaded samples, not a guaranteed complete period when capped. Retain data with the maintenance script and increase sophistication through aggregates only when the project needs it.
