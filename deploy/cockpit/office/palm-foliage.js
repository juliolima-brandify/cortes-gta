import * as THREE from "three";

export function palmFoliage() {
  // One shared cutout texture, drawn locally to match the office palette.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const spine = t => 256 + Math.sin(t * Math.PI * 2) * 10;
  for (let index = 0; index < 37; index++) {
    const t = (index + 1) / 39;
    const x = 20 + t * 950;
    const y = spine(t);
    const length = 185 * Math.sin(Math.PI * t) ** 0.7 * (1 - t * 0.22);
    for (const side of [-1, 1]) {
      const tipX = Math.min(1005, x + 105 * (1 - t * 0.5));
      const tipY = y + side * length;
      const gradient = ctx.createLinearGradient(x, y, tipX, tipY);
      gradient.addColorStop(0, index % 2 ? "#326944" : "#3c8050");
      gradient.addColorStop(0.55, index % 2 ? "#5d9d61" : "#70ac6b");
      gradient.addColorStop(1, "#a0be70");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.bezierCurveTo(x + 1, y + side * length * 0.6, tipX - 24, tipY, tipX, tipY);
      ctx.bezierCurveTo(tipX - 40, tipY - side * length * 0.18, x + 22, y + side * length * 0.18, x + 11, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#d0d98f66";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.quadraticCurveTo(x + 22, y + side * length * 0.55, tipX, tipY);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#779550";
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(10, 256);
  ctx.bezierCurveTo(340, 239, 690, 273, 1010, 256);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: texture, side: THREE.DoubleSide, alphaTest: 0.42, alphaToCoverage: true,
    roughness: 0.94, metalness: 0,
  });
  const geometry = new THREE.PlaneGeometry(1.65, 0.82, 6, 1);
  const vertices = geometry.attributes.position;
  for (let index = 0; index < vertices.count; index++) {
    const along = (vertices.getX(index) + 0.825) / 1.65;
    const across = vertices.getY(index);
    vertices.setXYZ(index, along * 1.65, 0.12 * Math.sin(along * Math.PI) - 0.46 * along ** 2, across);
  }
  geometry.computeVertexNormals();
  const transform = new THREE.Object3D();
  return () => {
    const crown = new THREE.InstancedMesh(geometry, material, 8);
    crown.position.set(0.34, 2.38, 0);
    crown.castShadow = crown.receiveShadow = true;
    for (let index = 0; index < 8; index++) {
      transform.rotation.set(0, index * Math.PI / 4, index % 2 ? -0.05 : 0.04);
      transform.scale.setScalar(index % 2 ? 0.9 : 1);
      transform.updateMatrix();
      crown.setMatrixAt(index, transform.matrix);
      crown.setColorAt(index, new THREE.Color(index % 2 ? 0xd1e5c2 : 0xffffff));
    }
    crown.instanceMatrix.needsUpdate = true;
    crown.instanceColor.needsUpdate = true;
    return crown;
  };
}
