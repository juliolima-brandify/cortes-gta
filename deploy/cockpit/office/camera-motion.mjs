export const CAMERA_MIN_ZOOM = 0.4;
export const CAMERA_MAX_ZOOM = 2.5;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class CameraMotion {
  constructor(current) {
    this.current = current;
    this.target = {...current};
    this.active = false;
    this.updatedAt = 0;
  }

  request(now) {
    this.target.zoom = clamp(this.target.zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    this.target.x = clamp(this.target.x, -7, 7);
    this.target.z = clamp(this.target.z, -7, 7);
    // Input can arrive faster than frames. Only a rendered step advances the clock.
    if (!this.active) this.updatedAt = now;
    this.active = true;
  }

  step(now, immediate = false) {
    if (!this.active) return;
    const elapsed = clamp(now - this.updatedAt, 0, 100);
    this.updatedAt = now;
    const amount = immediate ? 1 : -Math.expm1(-elapsed / 75);
    const {current, target} = this;
    // Equal wheel movement feels the same when zooming in and out.
    current.zoom = Math.exp(Math.log(current.zoom) + Math.log(target.zoom / current.zoom) * amount);
    for (const key of ["angle", "x", "z"]) current[key] += (target[key] - current[key]) * amount;
    this.active = Math.abs(Math.log(target.zoom / current.zoom)) > 0.0001
      || Math.abs(target.angle - current.angle) > 0.0001
      || Math.hypot(target.x - current.x, target.z - current.z) > 0.0002;
    if (!this.active) Object.assign(current, target);
  }
}
