# Smart Classroom Environment Monitoring System

A responsive Next.js 16 application with email/password authentication, live Firebase Realtime Database listeners, historical charts, motion and alert logs, device details, and browser preferences. Includes Arduino-compatible ESP32 integration with the specified hardware behavior.

**Data flow:** ESP32 → Wi-Fi / mobile hotspot → Firebase Realtime Database → Next.js website. The website and ESP32 may be on different networks. No MQTT, worker service, or additional hardware is required.

## Current implementation status

- **Phase 1:** Frontend is implemented.
- **Phase 2:** Firebase authentication, live listeners, indexed queries, and database rules are implemented. Local emulator tests verify device writes, viewer access, live delivery, access revocation, and temperature alert boundaries. Cloud connection still requires the web configuration in `.env.local`, enabled Email/Password authentication, deployed rules, and the account UID mappings below.
- **Phase 3:** An integration sketch is supplied, but has not been compared with the original working Arduino sketch or verified on the ESP32.
- **Phases 4–5:** Automated checks are available; physical-device acceptance, cloud synchronization, and deployment remain to be verified.

## 1. Run locally

Requires Node.js 20.9+ (Node 22 LTS recommended).

```sh
npm install
# An ignored .env.local has been created in this workspace.
# In a fresh checkout, copy .env.example to .env.local.
npm run dev
```

Open http://localhost:3000 and sign in with an authorized Firebase account. Without Firebase configuration the sign-in page explains setup. All sensor readings come from Firebase; missing readings show an empty state.

## 2. Firebase project and `.env.local`

1. Create a Firebase project and register a **Web app**.
2. Create a **Realtime Database**, choose a region, and start in **locked mode**. This application does not use Firestore.
3. Enable Authentication → Sign-in method → **Email/Password**. Create a dashboard user and a separate device user with a unique strong password. Do not reuse the teacher's account on the ESP32.
4. Copy web app configuration into `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-database.REGION.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
NEXT_PUBLIC_DEVICE_ID=classroom-01
NEXT_PUBLIC_STALE_TIMEOUT_SECONDS=30
```

Use your actual database URL from the console; some projects use `firebaseio.com`. Restart the dev server after editing `.env.local`. `NEXT_PUBLIC_*` values are included in the browser build and are **not administrative secrets**. Authentication and the database rules enforce authorization.

5. In Authentication → Settings → Authorized domains, add localhost for development and your deployed Vercel domain for production.
6. Deploy the rules and indexes:

```sh
npx firebase-tools login
npx firebase-tools deploy --only database --project YOUR_PROJECT_ID
```

7. Authorize your two account UIDs through the Firebase console. `firebase/seed.example.json` shows the structure. Replace both placeholder UIDs. Add only the `access` and `settings` nodes to your database; do not overwrite an existing database with the seed.

```json
{
  "access": {
    "viewers": { "TEACHER_UID": { "classroom-01": true } },
    "devices": { "DEVICE_UID": "classroom-01" }
  },
  "settings": { "classroom-01": { "warningTemperature": 32, "dangerTemperature": 35 } }
}
```

Account creation alone grants **no database access**. Unapproved authenticated users see a permission error, not telemetry. Clients cannot modify `access`. Viewer accounts cannot write sensor data; a device account can only write its assigned device. Historical read rules require bounded timestamp queries; latest readings remain inexpensive.

### Optional trusted administration

The web runtime does not need Admin SDK or service-account keys. For local role assignment and retention, Admin SDK is used only in `scripts/`:

```dotenv
# Optional, server/local administration only. NEVER prefix with NEXT_PUBLIC_.
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/location/service-account.json
RETENTION_DAYS=30
```

Prefer application-default credentials with a suitably restricted administrator identity. Keep any downloaded key outside the repository, never in firmware or Vercel public configuration.

```sh
node scripts/grant-access.mjs viewer teacher@example.com classroom-01
node scripts/grant-access.mjs device classroom-device@example.com classroom-01
node scripts/retention.mjs
node scripts/retention.mjs --apply
```

Retention previews one bounded batch by default. `--apply` deletes all records older than the configured retention period, 500 at a time. Run it weekly from a trusted administrator machine or scheduled administrative job; no extra always-on service is required. Sampling reduces write volume but does not automatically delete records.

## 3. Firmware

See [firmware/README.md](firmware/README.md) for Arduino IDE setup, verified TLS trust roots, device credentials, pin mapping, and reliability limitations. Copy `firmware/SmartClassroom/config.example.h` to `config.h`, which is ignored by Git. Arduino does not read Next.js `.env.local`.

No previous Arduino sketch existed in this repository. The supplied sketch implements the requested existing behavior:

- DHT11 GPIO 4, every 2 seconds.
- PIR GPIO 34; motion LED GPIO 2 follows it independently.
- Green GPIO 21 on at ≤32°C.
- Red GPIO 18 blinks every 300ms at >32°C to ≤35°C; steady above 35°C.
- HTTPS uploads every 5 seconds, historical samples every 60 seconds.
- Separate FreeRTOS network task, Firebase token renewal, Wi-Fi recovery, bounded event buffering, and local operation during network failure.
- No invalid DHT values are uploaded. Sensor failures are explicit.

## 4. Application behavior

| Route | Features |
|---|---|
| `/` | Live temperature/humidity/PIR, freshness, firmware LED states, recent events |
| `/analytics` | Recharts, 15m/1h/24h/7d filters, real sample statistics, paginated table, CSV |
| `/motion` | Current PIR state, last detection, rising-edge count, chronological event timeline |
| `/alerts` | Normal/warning/danger/sensor transitions; warning/danger/resolved filters |
| `/device` | Hardware and pins, actual connection state, data flow |
| `/settings` | Browser-local name, light/dark theme, local date/time format, freshness timing, account |
| `/login` | Email/password login |

Client-side auth gates the interface; Firebase rules are the actual data boundary. No sensitive data is server-rendered. Firebase subscriptions are removed on unmount/logout. Latest telemetry is separate from historical records. Connection state derives from server-stamped readings plus Firebase server clock offset and a stale timeout, never an `online` boolean. Browser connection loss is shown separately from device freshness.

If stale or sensor-error data exists, current measurements show unavailable while historical data remains accessible. PIR indicates movement only, never people count or attendance. There are no invented humidity alert thresholds, firmware versions, battery levels, or remote hardware controls.

History loads at most 1,500 samples and 1,000 events per selected window. At one sample/minute, a 7-day selection can be capped to the newest 25 hours; the interface explicitly labels these as loaded samples. Statistics are sample averages rather than time-weighted averages. CSV exports the loaded samples. Motion counts count stored rising-edge transitions only. Events have device occurrence time and server arrival time; current data freshness uses only server timestamps.

Last detected motion is independent of the selected time filter and remains visible when the device goes offline. Its lookup scans events newest first in pages of at most 100, stopping at the newest stored detection. This supports older firmware record keys that are not chronological; only retained events can be found. Device status becomes Offline when readings exceed the configured freshness timeout (30 seconds by default), checked at the selected display refresh interval. If the browser loses its Firebase connection, status is shown as unavailable rather than claiming the ESP32 is online.

## 5. Vercel deployment

1. Push the repository to your Git provider, excluding `.env.local` and firmware `config.h`.
2. Import it into Vercel and use the Next.js preset, `npm run build`, Node 22.
3. Add the seven `NEXT_PUBLIC_*` variables from `.env.local` in Vercel Project → Settings → Environment Variables. Apply to the intended Production/Preview environments.
4. Deploy and add the resulting hostname to Firebase Auth authorized domains. Public config changes need a new build.
5. Sign in with an authorized viewer and verify fresh sensor data from a different network.

No Vercel server secrets or Admin credentials are needed for the deployed dashboard. Firebase rules deploy independently from Vercel. This repository is deployment-ready; creating projects, supplying credentials, publishing to your account, and physical device verification require your Firebase/Vercel access.

## 6. Checks and troubleshooting

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/TESTING.md](docs/TESTING.md) for emulator tests and the physical-device acceptance matrix.

| Symptom | What to check |
|---|---|
| Sign-in disabled | Fill every Firebase field in `.env.local`; restart or rebuild |
| Invalid credentials | Email/Password provider enabled; account exists; correct project/key |
| Permission denied after login | Correct viewer UID under `access/viewers`; rules deployed to correct database |
| ESP32 401/403 | Device account UID mapping; token refresh; schema and timestamp validation |
| TLS failure | NTP time valid; correct verified root CA chain; certificate expiry; no URL trailing slash |
| ESP32 local readings work but website offline | Device Wi-Fi, HTTPS reachability, DB URL, auth, and Serial status codes |
| Device offline after power loss | Expected after configured stale timeout |
| Charts empty | Wait for the first 60-second historical sample; choose a matching time period |
| Fewer records than expected | Bounded loading, history sampling, retention, or queue overflow; see firmware docs |
| Theme/name changes not shared | Preferences are intentionally stored per browser |
| Mobile hotspot fails | Use a supported 2.4GHz Wi-Fi network; confirm internet/DNS/NTP access |

Do not disable database rules or TLS verification to fix a connection problem.
