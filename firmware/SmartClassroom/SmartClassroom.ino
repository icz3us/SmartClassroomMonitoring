#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <time.h>
#include <esp_system.h>
#include "config.h"

#define DHTPIN 4
#define DHTTYPE DHT11
#define PIR_PIN 34
#define RED_LED 18
#define GREEN_LED 21
#define MOTION_LED 2
const float WARN_TEMP = 32.0;
const float DANGER_TEMP = 35.0;
DHT dht(DHTPIN, DHTTYPE);

struct Sample { float temperature; float humidity; bool motion; bool sensorError; uint8_t status; bool green; bool red; bool blinking; uint64_t sampledAt; };
struct Event { char type[24]; float temperature; bool hasTemperature; uint64_t timestamp; uint32_t uptime; uint32_t sequence; };
void fillReading(JsonObject object, const Sample& sample);
void enqueueEvent(const char* type, float temperature = NAN);
Sample current = {NAN, NAN, false, true, 0, false, false, false, 0};
portMUX_TYPE sampleMux = portMUX_INITIALIZER_UNLOCKED;
QueueHandle_t eventQueue;
uint32_t eventSequence = 0;
uint32_t bootId;
const char* statusName(uint8_t status) { return status == 2 ? "danger" : status == 1 ? "warning" : "normal"; }
uint64_t epochMs() { struct timeval tv; gettimeofday(&tv, nullptr); return (uint64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000; }
bool clockReady() { return time(nullptr) > 1700000000; }
void enqueueEvent(const char* type, float temperature) {
  Event event = {}; strlcpy(event.type, type, sizeof(event.type));
  event.temperature = temperature; event.hasTemperature = !isnan(temperature);
  event.timestamp = clockReady() ? epochMs() : 0; event.uptime = millis(); event.sequence = ++eventSequence;
  if (xQueueSend(eventQueue, &event, 0) != pdTRUE) Serial.println("Event queue full: newest transition dropped");
}

// All HTTPS work runs on a separate FreeRTOS task; local loop never waits for it.
int request(const String& url, const char* method, const String& body, String& response, const char* contentType = "application/json") {
  WiFiClientSecure tls; tls.setCACert(FIREBASE_ROOT_CA); tls.setHandshakeTimeout(8);
  HTTPClient http; http.setConnectTimeout(5000); http.setTimeout(5000);
  if (!http.begin(tls, url)) return -1;
  http.addHeader("Content-Type", contentType);
  int code = http.sendRequest(method, body); response = http.getString(); http.end();
  return code;
}
String idToken, refreshToken;
uint32_t tokenExpires = 0;
String formEncode(const String& value) {
  String result;
  for (size_t i=0; i<value.length(); ++i) { unsigned char c=value[i]; if (isalnum(c)||c=='-'||c=='_'||c=='.'||c=='~') result+=(char)c; else { char hex[4]; snprintf(hex,sizeof(hex),"%%%02X",c); result+=hex; } }
  return result;
}
bool authenticate() {
  if (idToken.length() && (int32_t)(tokenExpires - millis()) > 0) return true;
  String response; int code; JsonDocument payload;
  const bool renewing = refreshToken.length() > 0;
  if (renewing) {
    code = request(String("https://securetoken.googleapis.com/v1/token?key=")+FIREBASE_API_KEY, "POST", "grant_type=refresh_token&refresh_token="+formEncode(refreshToken), response, "application/x-www-form-urlencoded");
  } else {
    payload["email"] = FIREBASE_DEVICE_EMAIL; payload["password"] = FIREBASE_DEVICE_PASSWORD; payload["returnSecureToken"] = true;
    String body; serializeJson(payload,body);
    code = request(String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=")+FIREBASE_API_KEY,"POST",body,response);
  }
  if (code != 200) { if (code == 400 || code == 401) { refreshToken=""; idToken=""; } Serial.printf("Firebase authentication failed (HTTP %d)\n",code); return false; }
  JsonDocument result; if (deserializeJson(result,response)) return false;
  idToken = result[renewing ? "id_token" : "idToken"].as<String>();
  refreshToken = result[renewing ? "refresh_token" : "refreshToken"].as<String>();
  int expires = result[renewing ? "expires_in" : "expiresIn"].as<int>();
  tokenExpires = millis() + (uint32_t)max(60,expires-120)*1000UL;
  return idToken.length() > 0;
}
void fillReading(JsonObject object, const Sample& sample) {
  if (!sample.sensorError) { object["temperature"] = sample.temperature; object["humidity"] = sample.humidity; }
  object["sensorError"] = sample.sensorError; object["motion"] = sample.motion;
  object["temperatureStatus"] = statusName(sample.status); object["greenLED"] = sample.green;
  object["redLED"] = sample.red; object["redLEDBlinking"] = sample.blinking;
  object["motionLED"] = sample.motion; object["timestamp"][".sv"] = "timestamp";
  if (sample.sampledAt) object["sampledAt"] = sample.sampledAt;
}
String uniqueKey(uint64_t time, uint32_t sequence) {
  char key[64]; snprintf(key,sizeof(key),"%013llu-%08lx-%08lx",(unsigned long long)time,(unsigned long)bootId,(unsigned long)sequence); return String(key);
}
void networkTask(void*) {
  uint32_t lastAttempt = 0, lastHistory = 0, lastWifiAttempt = 0;
  uint32_t retryDelay = FIREBASE_UPLOAD_INTERVAL_MS, uploadSequence = 0;
  bool restored = true;
  Event pending = {}; bool hasEvent = false;
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(50));
    uint32_t now = millis();
    if (WiFi.status() != WL_CONNECTED) {
      restored = true;
      if (now-lastWifiAttempt > 10000) { lastWifiAttempt=now; WiFi.reconnect(); }
      continue;
    }
    bool eventPending = hasEvent || uxQueueMessagesWaiting(eventQueue) > 0;
    if (!clockReady() || (now-lastAttempt < retryDelay && (!eventPending || retryDelay != FIREBASE_UPLOAD_INTERVAL_MS))) continue;
    lastAttempt=now;
    if (!authenticate()) { retryDelay=retryDelay<30000?retryDelay*2:60000; restored=true; continue; }
    Sample snapshot; portENTER_CRITICAL(&sampleMux); snapshot=current; portEXIT_CRITICAL(&sampleMux);
    JsonDocument patch;
    fillReading(patch[String("latestReadings/")+DEVICE_ID].to<JsonObject>(),snapshot);
    JsonObject device=patch[String("devices/")+DEVICE_ID].to<JsonObject>(); device["name"]="Smart Classroom Monitor"; device["lastSeen"][".sv"]="timestamp";
    bool recordHistory = !snapshot.sensorError && (lastHistory==0 || now-lastHistory >= HISTORY_INTERVAL_MS);
    if (recordHistory) fillReading(patch[String("readings/")+DEVICE_ID+"/"+uniqueKey(epochMs(),++uploadSequence)].to<JsonObject>(),snapshot);
    // Keep the pending transition and its key stable across ambiguous HTTP failures.
    if (!hasEvent) hasEvent=xQueueReceive(eventQueue,&pending,0)==pdTRUE;
    if (hasEvent) {
      if (!pending.timestamp) pending.timestamp=epochMs()-(uint32_t)(millis()-pending.uptime);
      uint64_t occurred = pending.timestamp;
      if (epochMs()>occurred && epochMs()-occurred > 86390000ULL) { hasEvent=false; Serial.println("Expired queued event discarded (>24h)"); }
      else {
        JsonObject event=patch[String("events/")+DEVICE_ID+"/"+uniqueKey(occurred,pending.sequence)].to<JsonObject>();
        event["type"]=pending.type; event["timestamp"]=occurred; event["receivedAt"][".sv"]="timestamp";
        if(pending.hasTemperature) event["temperature"]=pending.temperature;
      }
    }
    if(restored) {
      JsonObject event=patch[String("events/")+DEVICE_ID+"/"+uniqueKey(epochMs(),0)].to<JsonObject>();
      event["type"]="connection_restored"; event["timestamp"][".sv"]="timestamp"; event["receivedAt"][".sv"]="timestamp";
    }
    String body,response; serializeJson(patch,body);
    int code=request(String(FIREBASE_DATABASE_URL)+"/.json?auth="+idToken,"PATCH",body,response);
    if(code==200) {
      hasEvent=false;
      if(recordHistory) lastHistory=now;
      retryDelay=FIREBASE_UPLOAD_INTERVAL_MS; restored=false;
      Serial.println("Firebase telemetry acknowledged");
    } else {
      if(code==401) { idToken=""; tokenExpires=0; }
      retryDelay=retryDelay<30000?retryDelay*2:60000; restored=true;
      Serial.printf("Firebase upload failed (HTTP %d); local monitoring continues\n",code);
    }
  }
}

void setup() {
  Serial.begin(115200); bootId=esp_random();
  pinMode(PIR_PIN,INPUT); pinMode(RED_LED,OUTPUT); pinMode(GREEN_LED,OUTPUT); pinMode(MOTION_LED,OUTPUT);
  digitalWrite(RED_LED,LOW); digitalWrite(GREEN_LED,LOW); digitalWrite(MOTION_LED,LOW);
  dht.begin(); eventQueue=xQueueCreate(128,sizeof(Event));
  if (!eventQueue) { Serial.println("Unable to allocate event queue"); ESP.restart(); }
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  configTime(0,0,"pool.ntp.org","time.google.com");
  xTaskCreatePinnedToCore(networkTask,"firebase-network",16384,nullptr,1,nullptr,0);
}
void loop() {
  static uint32_t lastDht=0,lastBlink=0; static bool firstReading=true,previousError=true;
  static bool previousMotion=false; static uint8_t previousStatus=0;
  Sample next; portENTER_CRITICAL(&sampleMux); next=current; portEXIT_CRITICAL(&sampleMux);
  uint32_t now=millis(); bool motion=digitalRead(PIR_PIN)==HIGH;
  next.sampledAt = clockReady() ? epochMs() : 0;
  digitalWrite(MOTION_LED,motion?HIGH:LOW); next.motion=motion;
  if(motion!=previousMotion) { enqueueEvent(motion?"motion_started":"motion_stopped"); Serial.println(motion?"Motion detected":"Motion stopped"); previousMotion=motion; }
  if(now-lastDht>=2000) {
    lastDht=now; float humidity=dht.readHumidity(),temperature=dht.readTemperature();
    bool invalid=isnan(humidity)||isnan(temperature)||temperature<0||temperature>50||humidity<0||humidity>100;
    next.sensorError=invalid;
    if(invalid) { if(!previousError||firstReading) enqueueEvent("sensor_error"); Serial.println("DHT11 reading failed; holding previous LED condition"); }
    else {
      next.temperature=temperature; next.humidity=humidity; next.status=temperature>DANGER_TEMP?2:temperature>WARN_TEMP?1:0;
      if(previousError&&!firstReading) enqueueEvent("sensor_recovered",temperature);
      if(firstReading||next.status!=previousStatus) enqueueEvent(statusName(next.status),temperature);
      previousStatus=next.status;
      Serial.printf("Temperature %.1f C | Humidity %.1f %%\n",temperature,humidity);
    }
    previousError=invalid; firstReading=false;
  }
  // Valid readings determine LEDs. Sensor errors retain the last known condition.
  if(!isnan(next.temperature)) {
    next.green=next.status==0; next.blinking=next.status==1;
    if(next.status==1) { if(now-lastBlink>=300) { lastBlink=now; next.red=!next.red; } }
    else next.red=next.status==2;
    digitalWrite(GREEN_LED,next.green?HIGH:LOW); digitalWrite(RED_LED,next.red?HIGH:LOW);
  }
  portENTER_CRITICAL(&sampleMux); current=next; portEXIT_CRITICAL(&sampleMux);
  delay(2);
}
