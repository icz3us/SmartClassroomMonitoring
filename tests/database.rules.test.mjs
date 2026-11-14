import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { subscribeLastMotion } from "../lib/motion.mts";
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
      controllers: { teacher: { "classroom-01": true } },
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
  sampledAt: Date.now(),
});
test("monitoring commands require device-specific control permission and boolean values", async () => {
  const controller = env.authenticatedContext("teacher").database();
  const device = env.authenticatedContext("esp32").database();
  await assertSucceeds(
    set(ref(controller, "controls/classroom-01/enabled"), false),
  );
  assert.equal(
    (
      await assertSucceeds(get(ref(device, "controls/classroom-01/enabled")))
    ).val(),
    false,
  );
  await assertSucceeds(
    set(ref(controller, "controls/classroom-01/enabled"), true),
  );
  for (const value of ["false", 0, null, { enabled: false }])
    await assertFails(
      set(ref(controller, "controls/classroom-01/enabled"), value),
    );
  await assertFails(
    set(ref(controller, "controls/classroom-02/enabled"), false),
  );
  await assertFails(set(ref(controller, "controls/classroom-01/power"), false));
  await assertFails(set(ref(device, "controls/classroom-01/enabled"), false));
  await assertFails(get(ref(device, "controls/classroom-02/enabled")));
  await assertSucceeds(
    get(ref(controller, "access/controllers/teacher/classroom-01")),
  );
  await assertFails(
    get(ref(controller, "access/controllers/another/classroom-01")),
  );
  await assertFails(
    set(ref(controller, "access/controllers/teacher/classroom-02"), true),
  );
  for (const db of [
    env.unauthenticatedContext().database(),
    env.authenticatedContext("outsider").database(),
  ]) {
    await assertFails(get(ref(db, "controls/classroom-01/enabled")));
    await assertFails(set(ref(db, "controls/classroom-01/enabled"), false));
  }
  await env.withSecurityRulesDisabled(async (c) =>
    set(ref(c.database(), "access/controllers/teacher/classroom-01"), null),
  );
  await assertSucceeds(get(ref(controller, "controls/classroom-01/enabled")));
  await assertFails(
    set(ref(controller, "controls/classroom-01/enabled"), false),
  );
});
test("paused heartbeats contain no live measurements, motion, or lit LEDs", async () => {
  const db = env.authenticatedContext("esp32").database();
  const paused = {
    ...reading(),
    monitoringEnabled: false,
    sensorError: true,
    greenLED: false,
    occupancyStatus: "unknown",
  };
  delete paused.temperature;
  delete paused.humidity;
  await assertSucceeds(set(ref(db, "latestReadings/classroom-01"), paused));
  for (const invalid of [
    { greenLED: true },
    { motion: true },
    { temperature: 28 },
    { occupancyStatus: "likely_occupied" },
  ])
    await assertFails(
      set(ref(db, "latestReadings/classroom-01"), { ...paused, ...invalid }),
    );
  await assertFails(set(ref(db, "readings/classroom-01/paused"), paused));
  await assertSucceeds(
    set(ref(db, "latestReadings/classroom-01"), {
      ...reading(),
      monitoringEnabled: true,
    }),
  );
  await assertSucceeds(
    set(ref(db, "readings/classroom-01/resumed"), {
      ...reading(),
      monitoringEnabled: true,
    }),
  );
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
  await assertFails(
    set(ref(db, "latestReadings/classroom-01"), {
      ...reading(),
      sampledAt: Date.now() + 60000,
    }),
  );
});
test("device can record occupancy estimates and transitions while viewers remain read-only", async () => {
  const device = env.authenticatedContext("esp32").database();
  const viewer = env.authenticatedContext("teacher").database();
  for (const status of ["unknown", "likely_occupied", "no_recent_activity"]) {
    const value = {
      ...reading(),
      occupancyStatus: status,
      occupancyTimeoutSeconds: 600,
    };
    await assertSucceeds(
      update(ref(device), {
        "latestReadings/classroom-01": value,
        [`readings/classroom-01/occupancy-${status}`]: value,
        [`events/classroom-01/occupancy-${status}`]: {
          type: `occupancy_${status}`,
          timestamp: Date.now(),
          receivedAt: serverTimestamp(),
        },
      }),
    );
    const snapshot = await get(ref(viewer, "latestReadings/classroom-01"));
    assert.equal(snapshot.child("occupancyStatus").val(), status);
    await assertFails(set(ref(viewer, "latestReadings/classroom-01"), value));
  }
  for (const invalid of [
    { occupancyStatus: "vacant" },
    { occupancyTimeoutSeconds: 0 },
    { occupancyTimeoutSeconds: "600" },
    { motion: true, occupancyStatus: "no_recent_activity" },
  ])
    await assertFails(
      set(ref(device, "latestReadings/classroom-01"), {
        ...reading(),
        ...invalid,
      }),
    );
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

test("warning event is stored and delivered to the Alert History query", async () => {
  const device = env.authenticatedContext("esp32").database();
  const viewer = env.authenticatedContext("teacher").database();
  const cutoff = Date.now() - 60000;
  let unsubscribe = () => {};
  let timeout;
  try {
    const received = new Promise((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Warning event was not delivered")),
        15000,
      );
      unsubscribe = onValue(
        query(
          ref(viewer, "events/classroom-01"),
          orderByChild("timestamp"),
          startAt(cutoff),
          limitToLast(1000),
        ),
        (snapshot) => {
          if (snapshot.hasChild("warning-transition"))
            resolve(snapshot.child("warning-transition").val());
        },
        reject,
      );
    });
    await set(ref(device, "events/classroom-01/warning-transition"), {
      type: "warning",
      temperature: 33,
      timestamp: Date.now(),
      receivedAt: serverTimestamp(),
    });
    const event = await received;
    assert.equal(event.type, "warning");
    assert.equal(event.temperature, 33);
    assert.equal(typeof event.receivedAt, "number");
    await assertFails(
      set(ref(device, "events/classroom-01/legacy-warning"), {
        type: "temperature_status",
        status: "warning",
        temperature: 33,
        occurredAt: Date.now(),
        timestamp: serverTimestamp(),
      }),
    );
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }
});

test("last motion uses timestamps across pages and device restarts, regardless of the selected period", async () => {
  const now = Date.now();
  const oldDetection = now - 10 * 86400000;
  const lastDetection = now - 2 * 86400000;
  const events = {
    "zzz-older-boot": { type: "motion_started", timestamp: oldDetection },
    "aaa-newer-boot": { type: "motion_started", timestamp: lastDetection },
  };
  for (let i = 0; i < 1001; i++)
    events[`recent-${i}`] = { type: "normal", timestamp: now - 10000 };
  await env.withSecurityRulesDisabled((context) =>
    set(ref(context.database(), "events/classroom-01"), events),
  );
  let stop = () => {};
  let timeout;
  const timestamps = [];
  try {
    let first;
    let next;
    const initial = new Promise((resolve) => {
      first = resolve;
    });
    const updated = new Promise((resolve) => {
      next = resolve;
    });
    const failed = new Promise((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new Error(
              `Last motion lookup timed out; received ${JSON.stringify(timestamps)}`,
            ),
          ),
        15000,
      );
      stop = subscribeLastMotion(
        env.authenticatedContext("teacher").database(),
        "classroom-01",
        (timestamp) => {
          timestamps.push(timestamp);
          if (timestamp === lastDetection) first(timestamp);
          if (timestamp === now) next(timestamp);
        },
        reject,
      );
    });
    assert.equal(await Promise.race([initial, failed]), lastDetection);
    await set(
      ref(
        env.authenticatedContext("esp32").database(),
        "events/classroom-01/000-newest-boot",
      ),
      {
        type: "motion_started",
        timestamp: now,
        receivedAt: serverTimestamp(),
      },
    );
    assert.equal(await Promise.race([updated, failed]), now);
  } finally {
    clearTimeout(timeout);
    stop();
  }
});

test("last motion returns empty only when no detection is recorded", async () => {
  let stop = () => {};
  let timeout;
  try {
    const result = await new Promise((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Empty motion lookup timed out")),
        15000,
      );
      stop = subscribeLastMotion(
        env.authenticatedContext("teacher").database(),
        "classroom-01",
        resolve,
        reject,
      );
    });
    assert.equal(result, null);
  } finally {
    clearTimeout(timeout);
    stop();
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
