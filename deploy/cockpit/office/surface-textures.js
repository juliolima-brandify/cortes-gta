import * as THREE from "three";
import woodColor from "./textures/wood-color.jpg";
import woodNormal from "./textures/wood-normal.jpg";
import floorColor from "./textures/floor-color.jpg";
import floorNormal from "./textures/floor-normal.jpg";
import fabricColor from "./textures/fabric-color.jpg";
import fabricNormal from "./textures/fabric-normal.jpg";
import {fineSandTextures} from "./terrain-textures.js";
import plasterColor from "./textures/plaster-color.jpg";
import plasterNormal from "./textures/plaster-normal.jpg";
import asphaltColor from "./textures/asphalt-color.jpg";
import asphaltNormal from "./textures/asphalt-normal.jpg";
import pavementColor from "./textures/pavement-color.jpg";
import pavementNormal from "./textures/pavement-normal.jpg";

const finishes = {
  wood: {color: woodColor, normal: woodNormal, repeat: [1, 1], roughness: 0.66, relief: 0.3, tint: 0.86},
  floor: {color: floorColor, normal: floorNormal, repeat: [0.125, 0.125], roughness: 0.8, relief: 0.24, tint: 0.84},
  fabric: {color: fabricColor, normal: fabricNormal, repeat: [0.42, 0.42], roughness: 0.98, relief: 0.45, tint: 0.3},
  plaster: {color: plasterColor, normal: plasterNormal, repeat: [3, 1], roughness: 0.95, relief: 0.22, tint: 0.06},
  asphalt: {color: asphaltColor, normal: asphaltNormal, repeat: [48, 2.64], roughness: 0.97, relief: 0.12, tint: 0.95},
  pavement: {color: pavementColor, normal: pavementNormal, repeat: [48, 1], roughness: 0.94, relief: 0.15, tint: 0.85},
};

export function surfaceTextures(renderer, redraw) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const load = (url, repeat, color) => {
    const texture = loader.load(url, redraw);
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    texture.anisotropy = anisotropy;
    return texture;
  };
  return (name, color) => {
    if (name === "sand") {
      if (!cache.has(name)) cache.set(name, fineSandTextures(renderer));
      return cache.get(name);
    }
    const finish = finishes[name];
    if (!finish) return {};
    if (!cache.has(name)) cache.set(name, {
      map: load(finish.color, finish.repeat, true),
      normalMap: load(finish.normal, finish.repeat, false),
      normalScale: new THREE.Vector2(finish.relief, finish.relief),
      roughness: finish.roughness,
    });
    return {...cache.get(name), color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), finish.tint)};
  };
}
