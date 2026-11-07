import assert from "node:assert/strict";
import test from "node:test";
import {
  statusFor,
  summarize,
  isReadingFresh,
  deviceConnectionStatus,
  motionFor,
  type SensorEvent,
  type Reading,
} from "../lib/model";
test("firmware threshold boundaries are exact", () => {
  for (const [value, expected] of [
    [0, "normal"],
    [32, "normal"],
    [32.01, "warning"],
    [35, "warning"],
    [35.01, "danger"],
    [50, "danger"],
  ] as const)
    assert.equal(statusFor(value), expected);
});
test("power loss expires freshness and missing or implausible future timestamps are unavailable", () => {
  const now = 1700000000000;
  assert.equal(isReadingFresh(now - 30000, now, 30), true);
  assert.equal(isReadingFresh(now - 30001, now, 30), false);
  assert.equal(isReadingFresh(undefined, now, 30), false);
  assert.equal(isReadingFresh(0, now, 30), false);
  assert.equal(isReadingFresh(now + 6000, now, 30), false);
  assert.equal(isReadingFresh(now - 45000, now, 60), true);
  assert.equal(isReadingFresh(now - 9000, now, 10), true);
  assert.equal(isReadingFresh(now - 10001, now, 10), false);
});
test("device status expires without telemetry and browser loss cannot confirm online status", () => {
  const now = 1700000000000;
  assert.equal(deviceConnectionStatus(now, now, 30, true), "online");
  assert.equal(deviceConnectionStatus(now, now + 30001, 30, true), "offline");
  assert.equal(deviceConnectionStatus(now, now, 30, false), "unknown");
  assert.equal(deviceConnectionStatus(undefined, now, 30, true), "offline");
});

test("quick motion transitions update between snapshots without replaying older events", () => {
  const reading = { motion: false, timestamp: 10000 } as Reading;
  const started = { type: "motion_started", timestamp: 10100 } as SensorEvent;
  const stopped = { type: "motion_stopped", timestamp: 10200 } as SensorEvent;
  assert.equal(motionFor(reading, []), false);
  assert.equal(motionFor(reading, [started]), true);
  assert.equal(motionFor(reading, [started, stopped]), false);
  assert.equal(motionFor(reading, [stopped, started]), false);
  assert.equal(motionFor({ ...reading, timestamp: 11000 }, [started]), false);
  assert.equal(motionFor(reading, [{ ...started, timestamp: NaN }]), false);
  assert.equal(
    motionFor({ ...reading, timestamp: 11000, sampledAt: 10000 }, [started]),
    true,
  );
  assert.equal(
    motionFor({ ...reading, timestamp: 12000, sampledAt: 11000 }, [started]),
    false,
  );
});

test("statistics exclude missing and failed samples and preserve zero values", () => {
  const rows = [
    { temperature: 0, sensorError: false },
    { temperature: 32, sensorError: false },
    { temperature: 50, sensorError: true },
    { sensorError: false },
  ] as Reading[];
  assert.deepEqual(summarize(rows, "temperature"), {
    avg: 16,
    min: 0,
    max: 32,
  });
  assert.equal(summarize(rows, "humidity"), null);
  assert.equal(summarize([], "temperature"), null);
});
