#pragma once
// Copy to config.h (gitignored). Never commit the configured copy.
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_API_KEY "YOUR_FIREBASE_WEB_API_KEY"
#define FIREBASE_DATABASE_URL "https://YOUR_DATABASE.firebasedatabase.app"
#define FIREBASE_DEVICE_EMAIL "classroom-device@example.com"
#define FIREBASE_DEVICE_PASSWORD "UNIQUE_DEVICE_ACCOUNT_PASSWORD"
#define DEVICE_ID "classroom-01"
#define FIREBASE_UPLOAD_INTERVAL_MS 5000UL
#define HISTORY_INTERVAL_MS 60000UL
// Install the current root CA(s) for identitytoolkit.googleapis.com,
// securetoken.googleapis.com and your database hostname. See firmware README.
// Concatenate PEM roots if the hosts use different trust anchors.
static const char FIREBASE_ROOT_CA[] PROGMEM = R"PEM(
PASTE_VERIFIED_ROOT_CA_CERTIFICATES_HERE
)PEM";
