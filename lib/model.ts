export type TemperatureStatus = "normal" | "warning" | "danger";
export interface Reading {
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
    | "connection_restored";
  timestamp: number;
  temperature?: number;
}
export const deviceId = process.env.NEXT_PUBLIC_DEVICE_ID || "classroom-01";
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
export const eventLabels: Record<SensorEvent["type"], string> = {
  motion_started: "Motion detected",
  motion_stopped: "Motion stopped",
  normal: "Temperature returned to normal",
  warning: "Temperature entered warning state",
  danger: "Temperature entered danger state",
  sensor_error: "DHT11 reading failed",
  sensor_recovered: "Sensor readings restored",
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
