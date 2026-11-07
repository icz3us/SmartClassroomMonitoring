import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  ref,
  set,
  get,
  update,
  query,
  orderByChild,
  startAt,
  limitToLast,
  serverTimestamp,
  onValue,
  endAt,
} from "firebase/database";
let env;
test("authorized live listener receives a real device write and last-motion query is allowed", async () => {
  const viewer = env.authenticatedContext("teacher").database();
  const device = env.authenticatedContext("esp32").database();
  let unsubscribe = () => {};
  let timeout;
  try {
    const received = new Promise((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Live telemetry was not delivered")),
        15000,
      );
      unsubscribe = onValue(
        ref(viewer, "latestReadings/classroom-01"),
        (snapshot) => {
          if (snapshot.exists()) resolve(snapshot.val());
        },
        reject,
      );
    });
    const [value] = await Promise.all([
      received,
      set(ref(device, "latestReadings/classroom-01"), reading()),
    ]);
    assert.equal(value.temperature, 28.5);
    assert.equal(typeof value.timestamp, "number");
    assert.ok(Math.abs(Date.now() - value.timestamp) < 5000);
    await set(ref(device, "events/classroom-01/0001"), {
      type: "motion_started",
      timestamp: Date.now(),
      receivedAt: serverTimestamp(),
    });
    const motion = await assertSucceeds(
      get(
        query(
          ref(viewer, "events/classroom-01"),
          orderByChild("type"),
          startAt("motion_started"),
          endAt("motion_started"),
          limitToLast(1),
        ),
      ),
    );
    assert.equal(motion.child("0001/type").val(), "motion_started");
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-classroom",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: await readFile("firebase/database.rules.json", "utf8"),
    },
  });
});
after(async () => {
  if (env) await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (c) =>
    set(ref(c.database(), "access"), {
      viewers: { teacher: { "classroom-01": true } },
      devices: { esp32: "classroom-01" },
    }),
  );
});
const reading = () => ({
  temperature: 28.5,
  humidity: 65,
  motion: false,
  sensorError: false,
  temperatureStatus: "normal",
  greenLED: true,
  redLED: false,
  redLEDBlinking: false,
  motionLED: false,
  timestamp: serverTimestamp(),
});
test("anonymous and unapproved accounts cannot read or write", async () => {
  for (const db of [
    env.unauthenticatedContext().database(),
    env.authenticatedContext("outsider").database(),
  ]) {
    await assertFails(get(ref(db, "latestReadings/classroom-01")));
    await assertFails(set(ref(db, "latestReadings/classroom-01"), reading()));
  }
});
test("authorized viewer can read latest, cannot modify telemetry or access", async () => {
  const db = env.authenticatedContext("teacher").database();
  await assertSucceeds(get(ref(db, "latestReadings/classroom-01")));
  await assertFails(set(ref(db, "latestReadings/classroom-01"), reading()));
  await assertFails(set(ref(db, "access/devices/teacher"), "classroom-01"));
});
test("device can atomically upload only its own valid paths", async () => {
  const db = env.authenticatedContext("esp32").database();
  await assertSucceeds(
    update(ref(db), {
      "latestReadings/classroom-01": reading(),
      "devices/classroom-01": {
        name: "Smart Classroom Monitor",
        lastSeen: serverTimestamp(),
      },
      "readings/classroom-01/sample": reading(),
    }),
  );
  await assertFails(set(ref(db, "latestReadings/classroom-02"), reading()));
  await assertFails(
    set(ref(db, "latestReadings/classroom-01"), {
      ...reading(),
      temperature: 99,
    }),
  );
  await assertFails(
    set(ref(db, "latestReadings/classroom-01"), {
      ...reading(),
      temperature: 36,
      temperatureStatus: "normal",
    }),
  );
  await assertFails(
    set(ref(db, "latestReadings/classroom-01"), {
      ...reading(),
      humidity: "65",
    }),
  );
  await assertFails(
    set(ref(db, "latestReadings/classroom-01"), { ...reading(), timestamp: 1 }),
  );
  await assertFails(
    set(ref(db, "latestReadings/classroom-01"), { ...reading(), battery: 100 }),
  );
  await assertFails(set(ref(db, "latestReadings/classroom-01"), null));
});
test("sensor failure heartbeat does not require invalid sensor values", async () => {
  const db = env.authenticatedContext("esp32").database();
  const value = reading();
  delete value.temperature;
  delete value.humidity;
  value.sensorError = true;
  await assertSucceeds(set(ref(db, "latestReadings/classroom-01"), value));
  await assertFails(set(ref(db, "readings/classroom-01/bad"), value));
});
test("history queries must be bounded and indexed", async () => {
  const db = env.authenticatedContext("teacher").database();
  await assertFails(get(ref(db, "readings/classroom-01")));
  await assertSucceeds(
    get(
      query(
        ref(db, "readings/classroom-01"),
        orderByChild("timestamp"),
        startAt(0),
        limitToLast(1500),
      ),
    ),
  );
  await assertFails(
    get(
      query(
        ref(db, "readings/classroom-01"),
        orderByChild("timestamp"),
        startAt(0),
        limitToLast(1501),
      ),
    ),
  );
});
test("event retries are idempotent and occurrence time cannot be edited", async () => {
  const db = env.authenticatedContext("esp32").database();
  const event = {
    type: "motion_started",
    timestamp: Date.now(),
    receivedAt: serverTimestamp(),
  };
  await assertSucceeds(set(ref(db, "events/classroom-01/edge"), event));
  await assertSucceeds(set(ref(db, "events/classroom-01/edge"), event));
  await assertFails(
    set(ref(db, "events/classroom-01/edge"), {
      ...event,
      type: "motion_stopped",
    }),
  );
  await assertFails(
    set(ref(db, "events/classroom-01/future"), {
      ...event,
      timestamp: Date.now() + 60000,
    }),
  );
});

test("temperature alerts must match firmware threshold boundaries", async () => {
  const db = env.authenticatedContext("esp32").database();
  for (const temperature of [0, 32, 32.01, 35, 35.01, 50]) {
    const expected =
      temperature > 35 ? "danger" : temperature > 32 ? "warning" : "normal";
    for (const type of ["normal", "warning", "danger"]) {
      const write = set(
        ref(
          db,
          `events/classroom-01/${type}-${String(temperature).replace(".", "_")}`,
        ),
        {
          type,
          temperature,
          timestamp: Date.now(),
          receivedAt: serverTimestamp(),
        },
      );
      await (type === expected ? assertSucceeds(write) : assertFails(write));
    }
  }
});

test("revoking viewer access cancels an active telemetry listener", async () => {
  const db = env.authenticatedContext("teacher").database();
  let unsubscribe = () => {};
  let timeout;
  try {
    let ready;
    const initial = new Promise((resolve) => {
      ready = resolve;
    });
    const cancelled = new Promise((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Listener was not cancelled")),
        15000,
      );
      unsubscribe = onValue(
        ref(db, "latestReadings/classroom-01"),
        () => ready(),
        resolve,
      );
    });
    assert.equal(await Promise.race([initial, cancelled]), undefined);
    await env.withSecurityRulesDisabled((context) =>
      set(ref(context.database(), "access/viewers/teacher/classroom-01"), null),
    );
    const error = await cancelled;
    assert.match(error.code, /permission.?denied/i);
    await assertFails(get(ref(db, "latestReadings/classroom-01")));
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }
});
