import test from "node:test";
import assert from "node:assert/strict";
import {CameraMotion, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM} from "./camera-motion.mjs";

const camera = () => new CameraMotion({angle: Math.PI / 4, zoom: 1, x: 0, z: 0});

test("continuous mouse input faster than rendering keeps the camera moving", () => {
  const motion = camera();
  let previous = 0;
  for (let time = 0; time <= 1000; time += 4) {
    motion.target.x = time / 250;
    motion.request(time);
    if (time % 16 === 0) {
      motion.step(time);
      assert.ok(motion.current.x >= previous);
      assert.ok(motion.current.x <= motion.target.x);
      previous = motion.current.x;
    }
  }
  assert.ok(motion.current.x > 3.5, "input must not postpone camera movement until release");
  for (let time = 1008; time <= 1800; time += 16) motion.step(time);
  assert.equal(motion.current.x, 4);
  assert.equal(motion.active, false);
});

test("camera response is consistent across 30, 60 and 120 Hz", () => {
  const positions = [30, 60, 120].map(rate => {
    const motion = camera();
    Object.assign(motion.target, {x: 4, z: -2, zoom: 1.8, angle: 2});
    motion.request(0);
    for (let frame = 1; frame <= rate / 2; frame++) motion.step(frame * 1000 / rate);
    return motion.current;
  });
  for (const key of ["x", "z", "zoom", "angle"]) {
    assert.ok(Math.abs(positions[0][key] - positions[1][key]) < 1e-8);
    assert.ok(Math.abs(positions[1][key] - positions[2][key]) < 1e-8);
  }
});

test("zoom in and zoom out have symmetric perceived speed", () => {
  const zoomIn = camera();
  const zoomOut = camera();
  zoomIn.target.zoom = 2;
  zoomOut.target.zoom = 0.5;
  for (const motion of [zoomIn, zoomOut]) { motion.request(0); motion.step(75); }
  assert.ok(Math.abs(Math.log(zoomIn.current.zoom) + Math.log(zoomOut.current.zoom)) < 1e-10);
});

test("zoom out reaches the wider limit smoothly without overshooting", () => {
  const motion = camera();
  motion.target.zoom = 0.01;
  motion.request(0);
  assert.equal(motion.target.zoom, CAMERA_MIN_ZOOM);
  let previous = 1;
  for (let time = 16; time <= 1200; time += 16) {
    motion.step(time);
    assert.ok(motion.current.zoom <= previous);
    assert.ok(motion.current.zoom >= CAMERA_MIN_ZOOM);
    previous = motion.current.zoom;
  }
  assert.equal(motion.current.zoom, CAMERA_MIN_ZOOM);
  motion.target.zoom = 100;
  motion.request(1300);
  assert.equal(motion.target.zoom, CAMERA_MAX_ZOOM);
});

test("reversing drag direction updates the target without a jump", () => {
  const motion = camera();
  motion.target.x = 4;
  motion.request(0);
  motion.step(50);
  const before = motion.current.x;
  motion.target.x = -2;
  motion.request(55);
  assert.equal(motion.current.x, before);
  motion.step(66);
  assert.ok(motion.current.x < before && motion.current.x > -2);
});

test("reduced motion settles immediately", () => {
  const motion = camera();
  Object.assign(motion.target, {zoom: 0.6, x: 2, z: -1});
  motion.request(0);
  motion.step(0, true);
  assert.deepEqual(motion.current, motion.target);
  assert.equal(motion.active, false);
});
