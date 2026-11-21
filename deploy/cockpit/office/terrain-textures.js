import * as THREE from "three";

export function fineSandTextures(renderer) {
  const size = 512;
  const heights = new Float32Array(size * size);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(size, size);
  let seed = 27431;
  for (let index = 0; index < heights.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = seed / 4294967295 - 0.5;
    heights[index] = grain;
    const offset = index * 4;
    const variation = grain * 11;
    pixels.data[offset] = 239 + variation;
    pixels.data[offset + 1] = 219 + variation;
    pixels.data[offset + 2] = 179 + variation;
    pixels.data[offset + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = size;
  const normalContext = normalCanvas.getContext("2d");
  const normals = normalContext.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4;
    const dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size];
    const dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
    normals.data[offset] = 128 - dx * 18;
    normals.data[offset + 1] = 128 - dy * 18;
    normals.data[offset + 2] = 255;
    normals.data[offset + 3] = 255;
  }
  normalContext.putImageData(normals, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, normalMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(110, 110);
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  return {map, normalMap, normalScale: new THREE.Vector2(0.06, 0.06), roughness: 1, color: new THREE.Color(0xffffff)};
}
