export type TemperatureStatus = "normal" | "warning" | "danger";
export type OccupancyStatus =
  "likely_occupied" | "no_recent_activity" | "unknown";
export const occupancyLabels: Record<OccupancyStatus, string> = {
  likely_occupied: "Likely occupied",
  no_recent_activity: "No recent activity",
  unknown: "Occupancy unknown",
};
export interface Reading {
  monitoringEnabled?: boolean;
  temperature?: number;
  humidity?: number;
  motion: boolean;
  sensorError: boolean;
  temperatureStatus: TemperatureStatus;
  greenLED: boolean;
  redLED: boolean;
  redLEDBlinking: boolean;
  motionLED: boolean;
  timestamp: number;
  sampledAt?: number;
  occupancyStatus?: OccupancyStatus;
  occupancyTimeoutSeconds?: number;
}
export interface SensorEvent {
  id: string;
  type:
    | "motion_started"
    | "motion_stopped"
    | "normal"
    | "warning"
    | "danger"
    | "sensor_error"
    | "sensor_recovered"
    | "occupancy_likely_occupied"
    | "occupancy_no_recent_activity"
    | "occupancy_unknown"
    | "connection_restored";
  timestamp: number;
  temperature?: number;
}
export const deviceId = process.env.NEXT_PUBLIC_DEVICE_ID || "classroom-01";
export function occupancyFor(
  reading: Reading | null,
  fresh: boolean,
): OccupancyStatus {
  if (!fresh || reading?.monitoringEnabled === false) return "unknown";
  return reading?.occupancyStatus === "likely_occupied" ||
    reading?.occupancyStatus === "no_recent_activity"
    ? reading.occupancyStatus
    : "unknown";
}
export function motionFor(reading: Reading | null, events: SensorEvent[]) {
  if (reading?.monitoringEnabled === false) return false;
  let motion = reading?.motion ?? false;
  let timestamp = reading?.sampledAt ?? reading?.timestamp ?? 0;
  for (const event of events) {
    if (
      (event.type === "motion_started" || event.type === "motion_stopped") &&
      Number.isFinite(event.timestamp) &&
      event.timestamp >= timestamp
    ) {
      motion = event.type === "motion_started";
      timestamp = event.timestamp;
    }
  }
  return motion;
}
export const statusFor = (temperature: number): TemperatureStatus =>
  temperature > 35 ? "danger" : temperature > 32 ? "warning" : "normal";
export function isReadingFresh(
  timestamp: number | undefined,
  now: number,
  staleSeconds: number,
) {
  return (
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    timestamp > 0 &&
    now - timestamp <= staleSeconds * 1000 &&
    timestamp <= now + 5000
  );
}
export function deviceConnectionStatus(
  timestamp: number | undefined,
  now: number,
  staleSeconds: number,
  connected: boolean,
): "online" | "offline" | "unknown" {
  if (!connected) return "unknown";
  return isReadingFresh(timestamp, now, staleSeconds) ? "online" : "offline";
}
export const eventLabels: Record<SensorEvent["type"], string> = {
  motion_started: "Motion detected",
  motion_stopped: "Motion stopped",
  normal: "Temperature returned to normal",
  warning: "Temperature entered warning state",
  danger: "Temperature entered danger state",
  sensor_error: "DHT11 reading failed",
  sensor_recovered: "Sensor readings restored",
  occupancy_likely_occupied: "Classroom likely occupied",
  occupancy_no_recent_activity: "No recent classroom activity",
  occupancy_unknown: "Occupancy estimate restarted",
  connection_restored: "Device connection restored",
};
export function summarize(
  readings: Reading[],
  key: "temperature" | "humidity",
) {
  const values = readings
    .filter((r) => !r.sensorError && typeof r[key] === "number")
    .map((r) => r[key] as number);
  return values.length
    ? {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      }
    : null;
}
