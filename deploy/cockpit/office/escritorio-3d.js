import * as THREE from "three";
import {startActivity} from "./atividade.js";
import {startReview} from "./revisao.js";
import {startDock} from "./dock.js";

const office = document.getElementById("escritorio");
if (office) {
  startActivity(office);
  startReview(office);
  startDock();
}
const canvas = document.getElementById("escritorio-3d");
if (canvas) startOffice(canvas, office);

function startOffice(canvas, office) {
  const stage = canvas.parentElement;
  const rotate = document.getElementById("girar-escritorio");
  const notice = document.getElementById("escritorio-3d-aviso");
  const panel = document.getElementById("painel-flutuante");
  const documentStyle = document.documentElement.style;
  const geometryProperties = ["--monitor-x", "--monitor-y", "--monitor-width", "--monitor-height"];
  const announceMonitor = view => office.dispatchEvent(new CustomEvent("cockpit:monitor", {detail: {view}}));
  const readRoute = () => ({view: office.dataset.vista || "escritorio", station: office.dataset.mesaAtiva || null});
  function showFallback({view}) {
    office.removeAttribute("data-transicao");
    geometryProperties.forEach(property => documentStyle.removeProperty(property));
    panel?.classList.add("monitor-fallback");
    announceMonitor(view);
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  } catch {
    notice.hidden = false;
    office.addEventListener("cockpit:navegar", ({detail}) => showFallback(detail));
    showFallback(readRoute());
    return;
  }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffb9a5);
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 115);
  const target = new THREE.Vector3(0, 0.7, 0);
  const screenWidth = 0.52;
  const screenHeight = 0.37;
  scene.add(new THREE.HemisphereLight(0xffe1db, 0x65558c, 2.05));
  const sun = new THREE.DirectionalLight(0xffc599, 3.3);
  sun.position.set(-10, 15, 8);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -14, right: 14, top: 13, bottom: -13, near: 0.1, far: 47});
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  const cube = new THREE.BoxGeometry();
  const sphere = new THREE.SphereGeometry(1, 8, 5);
  const cylinder = new THREE.CylinderGeometry(0.82, 1, 1, 8);
  const surfaces = new Map();
  function material(color, glow = false) {
    const key = `${color}/${glow}`;
    if (!surfaces.has(key)) {
      surfaces.set(key, glow ? new THREE.MeshBasicMaterial({color}) : new THREE.MeshStandardMaterial({color, roughness: 0.85}));
    }
    return surfaces.get(key);
  }
  function object(parent, geometry, color, x, y, z, w, h, d, glow = false) {
    const mesh = new THREE.Mesh(geometry, material(color, glow));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = !glow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const box = (parent, color, x, y, z, w, h, d, glow) => object(parent, cube, color, x, y, z, w, h, d, glow);
  const round = (parent, color, x, y, z, w, h, d) => object(parent, sphere, color, x, y, z, w, h, d);
  const column = (parent, color, x, y, z, w, h, d) => object(parent, cylinder, color, x, y, z, w, h, d);
  function group(x, z, angle = 0) {
    const container = new THREE.Group();
    container.position.set(x, 0, z);
    container.rotation.y = angle;
    scene.add(container);
    return container;
  }
  const tones = {ink: 0x30253f, steel: 0x493b58, pink: 0xffadcb, coral: 0xe97793, plum: 0x77486c,
    cream: 0xffdaa5, oak: 0xc17a50, wood: 0x935269, lime: 0xa6ed9b, aqua: 0x56e9e3, neon: 0xff69bc};

  box(scene, 0xf7d29b, 0, -0.43, 0, 150, 0.12, 150).castShadow = false;
  const shore = group(-0.4, -11.3, -0.12);
  box(shore, 0x52c9c4, 0, -0.33, -54, 128, 0.08, 115).castShadow = false;
  box(shore, 0x83dacf, 0, -0.30, 3.15, 125, 0.04, 2.3).castShadow = false;
  for (let i = 0; i < 38; i++) {
    const x = (i % 13) * 2.45 - 14;
    const z = 3.9 - Math.floor(i / 13) * 2.1 + Math.sin(i * 2.7) * 0.31;
    box(shore, i < 13 ? 0xffefd7 : 0xb2ece0, x, -0.265, z, 0.76 + i % 4 * 0.26, 0.018, 0.05).castShadow = false;
  }
  box(scene, 0xdc917e, 0, -0.32, 5.7, 27, 0.13, 2.5);
  box(scene, 0xfcbb9b, 0, -0.23, 5.7, 27, 0.12, 2.32);
  for (let i = -13; i <= 13; i++) box(scene, 0xe49e8c, i, -0.165, 5.7, 0.025, 0.012, 2.22);
  for (const z of [4.58, 6.83]) box(scene, 0xffdcbb, 0, -0.14, z, 27, 0.07, 0.10);

  box(scene, tones.plum, 0, -0.18, 0, 11.4, 0.38, 8.5);
  for (let x = 0; x < 12; x++) {
    for (let z = 0; z < 9; z++) {
      box(scene, (x + z) % 2 ? 0xe8a780 : 0xf6be91, (x - 5.5) * 0.94, 0.035, (z - 4) * 0.93, 0.925, 0.055, 0.914);
    }
  }
  box(scene, tones.coral, 0, -0.055, 4.25, 11.35, 0.1, 0.1);
  box(scene, tones.coral, 5.71, -0.055, 0, 0.1, 0.1, 8.5);
  box(scene, tones.plum, 0, 1.23, -4.14, 11.25, 2.42, 0.19);
  box(scene, 0x995974, -5.55, 1.23, 0, 0.19, 2.42, 8.38);
  box(scene, tones.pink, 0, 2.46, -4.14, 11.46, 0.16, 0.34);
  box(scene, tones.pink, -5.55, 2.46, 0, 0.34, 0.16, 8.54);
  box(scene, tones.aqua, 0.07, 2.24, -4.025, 11.05, 0.045, 0.04, true);
  box(scene, tones.neon, -5.43, 2.24, 0, 0.045, 0.045, 8.1, true);
  for (const x of [-5.7, 5.64]) box(scene, tones.cream, x, 1.24, -4.12, 0.23, 2.52, 0.32);
  for (const z of [-2.7, -0.48, 1.75]) {
    box(scene, 0x563d62, -5.43, 1.37, z, 0.055, 1.37, 1.7);
    box(scene, 0xffcd98, -5.393, 1.37, z, 0.04, 1.14, 1.52, true);
    for (const y of [1.03, 1.27, 1.51, 1.75]) box(scene, 0xda91a0, -5.365, y, z, 0.025, 0.026, 1.5);
  }
  for (const x of [-4.25, 3.88]) {
    box(scene, tones.wood, x, 0.99, -3.82, 1.27, 1.88, 0.4);
    for (const y of [0.22, 0.77, 1.32, 1.91]) box(scene, tones.oak, x, y, -3.57, 1.31, 0.07, 0.42);
    for (let row = 0; row < 3; row++) {
      for (let book = 0; book < 7; book++) {
        const height = 0.21 + (row * 3 + book * 13) % 6 * 0.04;
        box(scene, [tones.coral, 0x699f9f, 0xc38969, 0x7561a1, 0x84a888][book % 5],
          x - 0.48 + book * 0.153, 0.26 + row * 0.55 + height / 2, -3.56, 0.125, height, 0.24);
      }
    }
  }
  box(scene, tones.cream, 0.28, 1.43, -4.012, 2.55, 1.34, 0.065);
  box(scene, 0x6fb8bd, 0.28, 1.43, -3.972, 2.33, 1.14, 0.03, true);
  for (let i = 0; i < 8; i++) {
    box(scene, i % 3 ? 0xf1cbab : 0xf596b4, -0.6 + i * 0.24, 1.45, -3.95, 0.025, 0.87, 0.025, true);
  }
  for (let i = 0; i < 4; i++) box(scene, 0xffdebb, 0.30, 1.12 + i * 0.21, -3.93, 1.96, 0.025, 0.021, true);

  function palm(x, z, size) {
    const tree = group(x, z, (x + z) * 0.2);
    tree.scale.setScalar(size);
    for (let i = 0; i < 7; i++) {
      const segment = column(tree, i % 2 ? 0xa86853 : 0xbe8763, i * 0.055, 0.19 + i * 0.34, 0, 0.15 - i * 0.011, 0.38, 0.14 - i * 0.009);
      segment.rotation.z = -0.14;
    }
    for (let i = 0; i < 8; i++) {
      const frond = new THREE.Group();
      frond.position.set(0.34, 2.38, 0);
      frond.rotation.y = i * Math.PI / 4;
      tree.add(frond);
      for (let j = 0; j < 4; j++) {
        const leaf = box(frond, i % 2 ? 0x3d9b77 : 0x69b58c, 0.28 + j * 0.27, 0.0 - j * j * 0.038, 0, 0.42 - j * 0.035, 0.07, 0.36 - j * 0.062);
        leaf.rotation.z = -j * 0.09;
      }
    }
  }
  palm(-8.0, -3.1, 1.38);
  palm(7.0, -4.7, 1.17);
  palm(-6.9, 4.7, 0.98);
  palm(7.8, 3.65, 1.28);
  palm(1, -8.2, 0.9);
  const cabana = group(4.4, -6.85, -0.07);
  for (const x of [-0.55, 0.55]) for (const z of [-0.4, 0.4]) box(cabana, tones.cream, x, 0.43, z, 0.095, 1.42, 0.095);
  box(cabana, tones.coral, 0, 0.72, 0, 1.28, 0.72, 0.81);
  box(cabana, 0xffafd1, 0, 1.16, 0, 1.53, 0.15, 1.0);
  box(cabana, 0x97ede2, 0.10, 0.84, 0.416, 0.66, 0.32, 0.025, true);

  const car = group(6.7, 5.36, 0.09);
  box(car, 0x4fcabf, 0, 0.30, 0, 2.1, 0.34, 0.87);
  box(car, 0x6ce0d2, 0.12, 0.55, 0, 1.13, 0.25, 0.72);
  box(car, 0x454264, 0.12, 0.57, 0.365, 0.85, 0.18, 0.02);
  for (const x of [-0.67, 0.68]) for (const z of [-0.41, 0.41]) {
    const wheel = column(car, tones.ink, x, 0.13, z, 0.19, 0.13, 0.19);
    wheel.rotation.x = Math.PI / 2;
    const hub = column(car, tones.cream, x, 0.13, z * 1.16, 0.09, 0.03, 0.09);
    hub.rotation.x = Math.PI / 2;
  }
  box(car, 0xfff3a6, 1.064, 0.31, 0.23, 0.025, 0.08, 0.22, true);
  box(car, tones.neon, -1.065, 0.32, 0, 0.026, 0.06, 0.62, true);

  function monitor(desk, x, colors) {
    box(desk, tones.ink, x, 1.00, -0.20, 0.49, 0.07, 0.37);
    const display = new THREE.Group();
    display.position.set(x, 1.27, -0.023);
    desk.add(display);
    box(display, tones.cream, 0, -0.01, -0.187, 0.63, 0.48, 0.33);
    box(display, tones.ink, 0, 0, -0.016, screenWidth, screenHeight, 0.025);
    colors.forEach((color, i) => box(display, color, -0.07 + i * 0.05, -0.12 + i * 0.05, 0.002,
      0.35 - i * 0.046, 0.024, 0.005, true));
    return display;
  }
  function workstation(x, z, angle, shirt, skin, colors, extra) {
    const desk = group(x, z, angle);
    box(desk, tones.oak, 0, 0.89, 0, 1.85, 0.13, 0.91);
    for (const side of [-0.77, 0.77]) box(desk, tones.wood, side, 0.46, -0.02, 0.13, 0.83, 0.75);
    box(desk, tones.plum, 0.60, 0.56, 0.20, 0.35, 0.48, 0.43);
    monitor(desk, -0.35, colors);
    const display = monitor(desk, 0.36, colors.slice().reverse());
    box(desk, 0xefd1a8, 0.0, 0.98, 0.29, 0.53, 0.034, 0.17);
    for (const y of [0.25, 0.29, 0.33]) box(desk, 0x8b6b72, 0, 1.001, y, 0.45, 0.004, 0.013);
    column(desk, tones.ink, 0.03, 0.28, 0.91, 0.22, 0.45, 0.22);
    box(desk, 0x4a3c58, 0.03, 0.53, 0.91, 0.61, 0.12, 0.56);
    box(desk, 0x58415c, 0.03, 0.82, 1.16, 0.62, 0.52, 0.11);
    box(desk, 0x525b7c, 0.03, 0.63, 0.76, 0.39, 0.23, 0.36);
    box(desk, shirt, 0.03, 0.91, 0.77, 0.45, 0.43, 0.25);
    const head = new THREE.Group();
    head.position.set(0.03, 1.32, 0.73);
    desk.add(head);
    round(head, skin, 0, 0, 0, 0.174, 0.197, 0.17);
    round(head, 0x402e43, 0, 0.105, 0.035, 0.179, 0.123, 0.17);
    const arms = [-0.23, 0.29].map(x => {
      const shoulder = new THREE.Group();
      shoulder.position.set(x, 0.99, 0.67);
      desk.add(shoulder);
      box(shoulder, shirt, 0, 0, -0.13, 0.13, 0.14, 0.38);
      round(shoulder, skin, 0, 0.02, -0.31, 0.078, 0.069, 0.085);
      return shoulder;
    });
    column(desk, tones.cream, 0.75, 1.02, 0.33, 0.059, 0.14, 0.059);
    const tally = extra(desk);
    return {
      point: desk.localToWorld(new THREE.Vector3(0, 1.94, -0.1)),
      display,
      forward: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      pose(time, active, moving) {
        head.rotation.y = moving ? 0.36 * Math.sin(time * 2.45) : 0;
        head.rotation.x = moving ? -0.12 - 0.10 * Math.sin(time * 3.5) : 0;
        for (const [index, arm] of arms.entries()) {
          const phase = time * 9 + index * Math.PI;
          arm.rotation.x = -0.15 + (moving ? 0.42 * Math.sin(phase) : 0);
          arm.rotation.y = moving ? 0.14 * Math.sin(time * 3.8 + index) : 0;
        }
        if (tally) tally.visible = active;
      },
    };
  }
  const lamp = (desk) => {
    column(desk, tones.wood, -0.74, 1.11, -0.23, 0.05, 0.29, 0.05);
    column(desk, tones.cream, -0.74, 1.33, -0.23, 0.14, 0.19, 0.14);
  };
  const stations = {
    captura: workstation(-3.65, 0.40, 0.16, 0x3aa8a8, 0xdeb188, [tones.aqua, tones.lime, tones.aqua, tones.cream],
      desk => box(desk, 0xff456c, -0.76, 1.06, 0.21, 0.15, 0.12, 0.14, true)),
    garimpo: workstation(-2.45, -2.41, 0.08, 0x81ab64, 0xc08461, [tones.lime, tones.aqua, tones.lime, tones.lime], lamp),
    edicao: workstation(2.78, -1.75, -0.10, 0xac629b, 0xdeab89, [tones.neon, tones.aqua, 0xffb478, 0xbfb3ff], lamp),
    agenda: workstation(1.27, 2.23, 0.04, 0xe28758, 0xb8785d, [tones.cream, tones.neon, tones.cream, tones.aqua], lamp),
  };

  const buttons = [...stage.querySelectorAll("[data-mesa]")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const pace = {captura: 0.64, garimpo: 0.88, edicao: 1.14, agenda: 0.78};
  const signal = {captura: false, edicao: false, garimpoUntil: 0, agendaUntil: 0};
  const angles = [Math.PI / 4, Math.PI / 4 + 0.34, Math.PI / 4 - 0.31];
  let view = 0;
  let readyToPaint = false;
  let contextAvailable = true;
  let frame = 0;
  let pulseTimer;
  let lastPaint = -Infinity;
  let route = {view: "escritorio", station: null};
  let pose;
  let flight;
  let width = 0;
  let height = 0;
  const stationKeys = Object.keys(stations);
  renderer.shadowMap.autoUpdate = false;

  function queueFrame() {
    if (!frame && readyToPaint && contextAvailable && !document.hidden) frame = requestAnimationFrame(paint);
  }

  function paint(now) {
    frame = 0;
    if (!readyToPaint || !contextAvailable || document.hidden) return;
    const activity = {captura: signal.captura, edicao: signal.edicao,
      garimpo: now < signal.garimpoUntil, agenda: now < signal.agendaUntil};
    const moving = !reducedMotion.matches && Object.values(activity).some(Boolean);
    if ((moving || flight) && now - lastPaint < (flight ? 24 : 48)) {
      queueFrame();
      return;
    }
    lastPaint = now;
    if (flight) {
      const progress = THREE.MathUtils.clamp((now - flight.started) / flight.duration, 0, 1);
      if (flight.via && progress < 0.45) {
        pose = blend(flight.from, flight.via, progress / 0.45);
      } else if (flight.via) {
        pose = blend(flight.via, flight.to, (progress - 0.45) / 0.55);
      } else {
        pose = blend(flight.from, flight.to, progress);
      }
      moveCamera();
      if (progress === 1) {
        flight = null;
        finishNavigation();
      }
    }
    for (const button of buttons) {
      const id = button.dataset.mesa;
      const active = activity[id];
      stations[id].pose(now / 1000 * pace[id], active, active && !reducedMotion.matches);
      button.classList.toggle("mesa-ocupada", active);
    }
    renderer.render(scene, camera);
    if (moving || flight) queueFrame();
  }

  function roomPose(station) {
    const aspect = width / height;
    const scales = stationKeys.map(() => 1);
    if (!station) {
      const angle = angles[view];
      return {position: new THREE.Vector3(31 * Math.sin(angle), 31 / Math.sqrt(2) + target.y, 31 * Math.cos(angle)),
        aim: target, halfHeight: Math.max(6.75, 8.5 / aspect), scales};
    }
    const top = (document.querySelector(".topo")?.getBoundingClientRect().bottom || 0) + 13;
    const bottom = (document.querySelector(".menu")?.getBoundingClientRect().top || height) - 13;
    const availableHeight = Math.max(90, bottom - top);
    const availableWidth = Math.max(90, Math.min(width - 24, 1120));
    const screenRatio = Math.max(0.44, Math.min(1.8, availableWidth / availableHeight));
    const displayHeight = screenWidth / screenRatio;
    scales[stationKeys.indexOf(station)] = displayHeight / screenHeight;
    const halfHeight = Math.max(displayHeight * height / (2 * availableHeight), screenWidth * height / (2 * availableWidth));
    const {display, forward} = stations[station];
    const aim = display.getWorldPosition(new THREE.Vector3());
    aim.y -= halfHeight * (1 - (top + bottom) / height);
    return {position: aim.clone().addScaledVector(forward, 0.47), aim, halfHeight, scales};
  }

  function blend(from, to, progress) {
    const t = progress * progress * (3 - 2 * progress);
    return {
      position: from.position.clone().lerp(to.position, t),
      aim: from.aim.clone().lerp(to.aim, t),
      halfHeight: from.halfHeight * (to.halfHeight / from.halfHeight) ** t,
      scales: from.scales.map((scale, index) => THREE.MathUtils.lerp(scale, to.scales[index], t)),
    };
  }

  function moveCamera() {
    const side = pose.halfHeight * width / height;
    Object.assign(camera, {left: -side, right: side, top: pose.halfHeight, bottom: -pose.halfHeight});
    camera.position.copy(pose.position);
    camera.lookAt(pose.aim);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    stationKeys.forEach((key, index) => { stations[key].display.scale.y = pose.scales[index]; });
  }

  function positionMonitor() {
    if (!route.station || !panel) return;
    const {display} = stations[route.station];
    const first = display.localToWorld(new THREE.Vector3(-screenWidth / 2, screenHeight / 2, 0)).project(camera);
    const last = display.localToWorld(new THREE.Vector3(screenWidth / 2, -screenHeight / 2, 0)).project(camera);
    const geometry = [(first.x + 1) * width / 2 + 1, (1 - first.y) * height / 2 + 1,
      (last.x - first.x) * width / 2 - 2, (first.y - last.y) * height / 2 - 2];
    geometryProperties.forEach((property, index) => documentStyle.setProperty(property, `${geometry[index]}px`));
  }

  function positionButtons() {
    if (route.station) return;
    buttons.forEach(button => {
      const position = stations[button.dataset.mesa].point.clone().project(camera);
      button.style.setProperty("--mesa-x", `${Math.max(12, Math.min(88, (position.x + 1) * 50))}%`);
      button.style.setProperty("--mesa-y", `${50 * (1 - position.y)}%`);
    });
  }

  function finishNavigation() {
    office.removeAttribute("data-transicao");
    positionButtons();
    if (route.station) {
      positionMonitor();
      announceMonitor(route.view);
    }
  }

  function navigate(next) {
    const previous = route;
    route = next;
    if (!contextAvailable) {
      showFallback(route);
      return;
    }
    if (!readyToPaint) return;
    const to = roomPose(route.station);
    if (!pose || reducedMotion.matches) {
      pose = to;
      flight = null;
      moveCamera();
      finishNavigation();
    } else {
      const via = previous.station && route.station ? roomPose(null) : null;
      office.dataset.transicao = "ativa";
      flight = {from: pose, to, via, started: performance.now(), duration: via ? 900 : 690};
    }
    queueFrame();
  }

  function draw() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    readyToPaint = width > 0 && height > 0;
    if (!readyToPaint || !contextAvailable) return;
    const pixelRatio = Math.min(devicePixelRatio || 1, 1.65, Math.sqrt(2400000 / (width * height)));
    if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    const to = roomPose(route.station);
    if (flight) {
      flight.to = to;
      if (flight.via) flight.via = roomPose(null);
    } else {
      pose = to;
      moveCamera();
      positionButtons();
      positionMonitor();
    }
    renderer.shadowMap.needsUpdate = true;
    queueFrame();
  }

  office.addEventListener("cockpit:atividade", ({detail}) => {
    signal.captura = detail.captura;
    signal.edicao = detail.edicao;
    const until = performance.now() + 4200;
    if (!detail.conectado) signal.garimpoUntil = signal.agendaUntil = 0;
    if (detail.garimpo) signal.garimpoUntil = until;
    if (detail.agenda) signal.agendaUntil = until;
    clearTimeout(pulseTimer);
    const remaining = Math.max(signal.garimpoUntil, signal.agendaUntil) - performance.now();
    if (remaining > 0) pulseTimer = setTimeout(queueFrame, remaining + 30);
    queueFrame();
  });
  office.addEventListener("cockpit:navegar", ({detail}) => navigate(detail));
  rotate.disabled = false;
  rotate.addEventListener("click", () => { view = (view + 1) % angles.length; draw(); });
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault(); contextAvailable = false; rotate.disabled = true; notice.hidden = false;
    flight = null;
    showFallback(route);
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextAvailable = true; rotate.disabled = false; notice.hidden = true;
    panel?.classList.remove("monitor-fallback");
    draw();
  });
  reducedMotion.addEventListener("change", () => {
    if (flight && reducedMotion.matches) navigate(route);
    else queueFrame();
  });
  document.addEventListener("visibilitychange", queueFrame);
  new ResizeObserver(draw).observe(stage);
  draw();
  const initial = readRoute();
  if (initial.station) navigate(initial);
}
