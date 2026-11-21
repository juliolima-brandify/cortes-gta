import test from "node:test";
import assert from "node:assert/strict";
import {saoPauloHour, dayPhase, environmentAt} from "./day-cycle.mjs";
test("local time follows São Paulo across a UTC date change", () => {
  assert.equal(saoPauloHour(new Date("2026-11-21T01:00:00Z")), 22);
  assert.equal(saoPauloHour(new Date("2026-11-20T21:00:00Z")), 18);
});
test("the five environment periods are distinct", () => {
  assert.deepEqual([8,12,16,18,22].map(hour => dayPhase(hour).key), ["manha","dia","tarde","sunset","noite"]);
});
test("every minute has finite lighting and bounded transitions", () => {
  for (let minute = 0; minute < 1440; minute++) {
    const result = environmentAt(minute / 60);
    assert.ok(result.blend >= 0 && result.blend <= 1);
    for (const preset of [result.from, result.to]) {
      assert.ok(preset.ambient > 0 && preset.keyLight > 0);
      assert.ok(preset.position.every(Number.isFinite));
    }
  }
});
test("the environment wraps continuously at midnight", () => {
  const before = environmentAt(23.999), after = environmentAt(0);
  assert.equal(before.to.sky, after.from.sky);
  assert.equal(before.to.ambient, after.from.ambient);
  assert.equal(dayPhase(24).key, "noite");
});
