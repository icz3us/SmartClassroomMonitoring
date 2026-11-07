# ESP32 integration

No existing sketch was present in the repository. `SmartClassroom/SmartClassroom.ino` is a complete integration based on the specified pins and behavior. Compare it with your working sketch before flashing.

## Arduino IDE setup

1. Install Arduino IDE 2 and the **esp32 by Espressif Systems** board package (3.x). Select ESP32 Dev Module for the DevKit V1 and the correct serial port.
2. Install **DHT sensor library by Adafruit**, **Adafruit Unified Sensor**, and **ArduinoJson 7** through Library Manager.
3. Open `SmartClassroom/SmartClassroom.ino`. Copy `config.example.h` to `config.h` in the same folder. The latter is gitignored.
4. Configure Wi-Fi and Firebase web API key, database HTTPS URL **without a trailing slash**, and a dedicated Firebase email/password device account. Grant its UID access using the database's `access/devices` map as described in the root README.
5. Fill `FIREBASE_ROOT_CA` with the verified PEM root CA certificates for your database hostname, `identitytoolkit.googleapis.com`, and `securetoken.googleapis.com`. Inspect the certificate chains using a trusted browser's certificate viewer or `openssl s_client -showcerts -connect HOST:443 -servername HOST`. Obtain roots from the CA's official repository (Google Trust Services: https://pki.goog/repository/), verify fingerprints independently, and concatenate required PEM roots. Include trust anchors, not short-lived leaf certificates. Rotate them before expiry or issuer changes. **Never use `setInsecure()`.** The placeholder intentionally prevents unverified TLS connections.
6. Upload. Open Serial Monitor at 115200 baud. Expect local readings every 2 seconds and acknowledged Firebase uploads every 5 seconds once Wi-Fi, NTP, TLS and authentication succeed.

## Preserved behavior

| Component | GPIO | Behavior |
|---|---|---|
| DHT11 | 4 | Sample every 2 seconds |
| HC-SR501 PIR | 34 | Read each loop, input-only pin |
| Green LED | 21 | On at ≤32°C |
| Red LED | 18 | Off at ≤32°C; toggles every 300ms at >32°C to ≤35°C; steady on at >35°C |
| Motion LED | 2 | Follows PIR independently |

The loop does not perform network requests. A FreeRTOS task on core 0 performs HTTPS, token renewal, reconnects, and exponential retry up to 60 seconds. DHT failures publish `sensorError: true` without invalid temperature/humidity, and preserve the previous local LED condition. Initial LEDs stay off until the first valid reading.

## Data and reliability

- Latest readings and device heartbeat use Firebase server timestamps; uploads are atomic root PATCHes constrained by per-path rules.
- Historical readings are sampled every 60 seconds by default (1,440/day). This lowers storage, but is not automatic retention. Use the provided retention command regularly.
- Motion events are generated only on edges, and temperature events only on transitions (plus the first valid baseline). A 128-entry in-memory queue holds events while disconnected; overflow and events older than 24 hours are explicitly dropped with Serial messages. Power loss loses this queue. This is bounded academic telemetry, not a durable industrial event recorder.
- Events retain their NTP-synchronized occurrence timestamp and carry a separate server `receivedAt`. Before initial NTP sync, occurrence is reconstructed from uptime. Arrival time is never presented as the time of earlier movement. Device occurrence time is not a trusted server measurement; the rules bound its age and future skew.
- A pending event keeps a stable key across retries, including a lost HTTP acknowledgment. Rules allow identical event retries but prohibit editing its type, occurrence time or temperature. HTTP retries may produce duplicate historical snapshots or restoration events after an ambiguous acknowledgment; motion/temperature transition counts remain keyed and deduplicated.
- `redLEDBlinking` reports warning behavior; `redLED` reports the sampled output level. UI displays “Blinking,” not rapid LED animation.
- Authentication ID tokens refresh two minutes before expiry using Firebase Secure Token REST API. Revoked/invalid refresh tokens trigger a new device-account sign-in. Neither tokens, passwords nor full request URLs are printed.

## Credential security

The sketch uses a unique least-privilege device identity, never a service-account key. The web `.env.local` is not compiled into firmware; Arduino uses ignored `config.h`. Passwords in firmware can be extracted by someone with physical access. Revoke and rotate a compromised device account. For production, provision per-device credentials through a controlled enrollment process, enable ESP32 secure boot and flash encryption, protect debug interfaces, and use a trusted short-lived-token provisioning service backed by hardware-protected identity. Such a service is not required or deployed for this academic direct-HTTPS architecture.

## Hardware acceptance tests

Before replacing your working sketch, record its behavior. Then verify normal 32°C, warning just above 32°C and at 35°C, danger above 35°C, and PIR changes in all three conditions. Disconnect Wi-Fi and Firebase access separately, and confirm local LEDs still operate. Restore access and confirm queued transitions, token renewal after an hour, power-loss freshness expiry, DHT disconnect/error recovery, and access from a browser on a different network. See `docs/TESTING.md` for the acceptance matrix. Hardware behavior cannot be verified without the physical ESP32.
