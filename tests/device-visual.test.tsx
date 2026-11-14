import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DeviceVisual } from "../components/device-visual";
import type { Reading } from "../lib/model";

test("device LEDs use reported outputs and suppress stale or missing reports", () => {
  const reading = {
    greenLED: true,
    redLED: false,
    redLEDBlinking: true,
    motionLED: true,
  } as Reading;
  const render = (value: Reading | null, fresh: boolean) =>
    renderToStaticMarkup(<DeviceVisual reading={value} fresh={fresh} />);
  const active = render(reading, true);
  for (const led of ["green", "red", "motion"]) {
    assert.match(active, new RegExp(`data-led="${led}" data-active="true"`));
  }
  for (const html of [
    render(reading, false),
    render(null, true),
    render(
      { ...reading, greenLED: false, redLEDBlinking: false, motionLED: false },
      true,
    ),
  ]) {
    assert.equal((html.match(/data-active="false"/g) || []).length, 3);
    assert.doesNotMatch(html, /data-active="true"/);
  }
});
