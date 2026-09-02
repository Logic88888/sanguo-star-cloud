import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import characters from '../data/characters.json';
import relations from '../data/relations.json';

/* ---------------- 势力配置 ---------------- */
const FACTIONS = {
  wei:   { label: '魏',   css: '#5aa7ff', color: new THREE.Color('#5aa7ff') },
  shu:   { label: '蜀',   css: '#ff5c5c', color: new THREE.Color('#ff5c5c') },
  wu:    { label: '吴',   css: '#3ddc84', color: new THREE.Color('#3ddc84') },
  other: { label: '群雄', css: '#f2f2f2', color: new THREE.Color('#f2f2f2') },
};

// 场景缩放系数：人数剧变时同步缩放，保持密度、星体大小与相机手感一致（以 300 人为基准）
const S = Math.max(1, Math.sqrt(characters.length / 300));

// 星云按势力分成四个星区（魏西、蜀东、吴南、群雄北）
const CLUSTER_CENTERS = {
  wei:   new THREE.Vector3(-22 * S, 0, -8 * S),
  shu:   new THREE.Vector3(22 * S, 0, -8 * S),
  wu:    new THREE.Vector3(-15 * S, 0, 17 * S),
  other: new THREE.Vector3(15 * S, 0, 17 * S),
};

/* ---------------- 关系（人物连线） ---------------- */
const byName = new Map(characters.map((c) => [c.name, c]));
const byId = new Map(characters.map((c) => [c.id, c]));
const edges = [];
for (const r of relations) {
  const a = byName.get(r.a);
  const b = byName.get(r.b);
  if (!a || !b) {
    console.warn('关系数据未匹配到人物：', r);
    continue;
  }
  edges.push({ a, b, type: r.type || '关联', auto: r.auto });
}
const degree = new Map(characters.map((c) => [c.name, 0]));
// 剧情度：只统计手工梳理的剧情关系（桃园结义/连环计/宿敌等），用于金晕地标；
// 家族连线（父子/兄弟/夫妻）计入总度数（星体大小）但不稀释金晕
const dStory = new Map(characters.map((c) => [c.name, 0]));
for (const e of edges) {
  degree.set(e.a.name, degree.get(e.a.name) + 1);
  degree.set(e.b.name, degree.get(e.b.name) + 1);
  if (!e.auto) {
    dStory.set(e.a.name, dStory.get(e.a.name) + 1);
    dStory.set(e.b.name, dStory.get(e.b.name) + 1);
  }
}
// 连线多的人物：星点更大更亮
const BASE_SIZE = 1.9 * S;
// 密度补偿：人数远超 300 时调暗单星（加色混合下总亮度守恒），避免星域中心过曝
const DIM = Math.pow(300 / characters.length, 0.5);
function starStyle(name) {
  const d = degree.get(name) || 0;
  const mul = 1 + 0.22 * Math.log2(1 + d);
  const bright = Math.min(1.45, 0.9 + 0.07 * d) * DIM;
  return { size: BASE_SIZE * mul, bright, mul };
}

/* ---------------- 可复现的随机数（保证每次刷新星星位置一致） ---------------- */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Box-Muller，生成高斯分布偏移，星区呈自然星云状
function gaussian(rng) {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------------- 场景基础 ---------------- */
const root = document.getElementById('canvas-root');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05070f');

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(0, 24 * S, 56 * S);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 200 * S;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });

/* ---------------- Bloom 辉光后处理（借鉴诗云） ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.32, // strength
  0.28, // radius（小半径保持远景清晰，不虚化）
  0.5   // threshold（只在亮星处起辉光，避免星云中心整体过曝）
);
composer.addPass(bloomPass);

/* ---------------- 发光星星贴图 ---------------- */
function makeStarTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const starTexture = makeStarTexture();

/* ---------------- 装饰背景星（不可交互） ---------------- */
{
  const count = 1500;
  const rng = mulberry32(20260827);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 140 + rng() * 260;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.9,
    map: starTexture,
    transparent: true,
    opacity: 0.55,
    color: 0x99aacc,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geo, mat));
}

/* ---------------- 主星（一人一星） ----------------
   自定义着色器：每颗星独立的尺寸 aSize 与亮度 aBright（按连线数量缩放） */
const STARS_VERT = `
  uniform float uScale;
  uniform float uMaxSize;
  attribute float aSize;
  attribute float aBright;
  varying float vBright;
  void main() {
    vBright = aBright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(aSize * (uScale / -mv.z), uMaxSize);
    gl_Position = projectionMatrix * mv;
  }
`;
const STARS_FRAG = `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vBright;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor * vBright, tex.a);
  }
`;

const groups = {}; // faction -> { points, list, mat }
const starMats = []; // 所有 uScale 材质（主星 + 星尘），resize 时统一更新
for (const key of Object.keys(FACTIONS)) {
  const list = characters.filter((c) => c.faction === key);
  const positions = new Float32Array(list.length * 3);
  const sizes = new Float32Array(list.length);
  const brights = new Float32Array(list.length);
  list.forEach((c, i) => {
    const rng = mulberry32(hashString(c.faction + '/' + c.name));
    const center = CLUSTER_CENTERS[key];
    const p = new THREE.Vector3(
      center.x + gaussian(rng) * 7 * S,
      center.y + gaussian(rng) * 3.2 * S,
      center.z + gaussian(rng) * 7 * S
    );
    c._pos = p;
    const style = starStyle(c.name);
    c._size = style.size;
    c._mul = style.mul;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    sizes[i] = style.size;
    // 白色（群雄）在加色混合下三通道全占，额外压暗防止核心过曝
    brights[i] = style.bright * (key === 'other' ? 0.5 : 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(brights, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: window.innerHeight * 0.5 },
      uMaxSize: { value: 110.0 },
      uMap: { value: starTexture },
      uColor: { value: FACTIONS[key].color.clone() },
    },
    vertexShader: STARS_VERT,
    fragmentShader: STARS_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  groups[key] = { points, list, mat };
  starMats.push(mat);
}

/* ---------------- 势力星尘（装饰介质，不可交互） ----------------
   每个人物星区填充数千微粒：致密核心 + 稀疏外晕，人物星嵌在连续云体里（诗云质感） */
const dustGroups = {}; // faction -> { points, count }
{
  for (const key of Object.keys(FACTIONS)) {
    const rng = mulberry32(hashString('dust/' + key));
    const center = CLUSTER_CENTERS[key];
    const core = 2000, haloN = 800, count = core + haloN;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brights = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const isCore = i < core;
      const rx = (isCore ? 6.4 : 12.5) * S;
      const ry = (isCore ? 2.9 : 5.6) * S;
      positions[i * 3] = center.x + gaussian(rng) * rx;
      positions[i * 3 + 1] = center.y + gaussian(rng) * ry;
      positions[i * 3 + 2] = center.z + gaussian(rng) * rx;
      sizes[i] = (0.45 + rng() * 0.85) * S;
      brights[i] = (isCore ? 0.05 + rng() * 0.1 : 0.025 + rng() * 0.06) * DIM;
      if (key === 'other') brights[i] *= 0.3; // 白色三通道全占，重点压暗防止糊成白云
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(brights, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: window.innerHeight * 0.5 },
        uMaxSize: { value: 7.0 }, // 星尘永远是微粒，靠近相机也不放大成斑块
        uMap: { value: starTexture },
        uColor: { value: FACTIONS[key].color.clone() },
      },
      vertexShader: STARS_VERT,
      fragmentShader: STARS_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    dustGroups[key] = { points, count };
    starMats.push(mat);
  }
}

/* ---------------- 关系连线 ----------------
   同阵营：整条线同色；跨阵营：两端顶点各用本阵营色，沿线段自然渐变 */
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3));
const lineMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const lines = new THREE.LineSegments(lineGeo, lineMat);
lines.frustumCulled = false;
scene.add(lines);

let currentFilter = 'all';
let selected = null;

function factionVisible(f) {
  return currentFilter === 'all' || f === currentFilter;
}
function rebuildLines() {
  const vis = edges.filter((e) => factionVisible(e.a.faction) && factionVisible(e.b.faction));
  // 关系线越多，单条越淡，避免密集网糊屏
  lineMat.opacity = vis.length > 1500 ? 0.08 : vis.length > 600 ? 0.14 : vis.length > 200 ? 0.22 : 0.3;
  const pos = new Float32Array(vis.length * 6);
  const col = new Float32Array(vis.length * 6);
  vis.forEach((e, i) => {
    pos.set([e.a._pos.x, e.a._pos.y, e.a._pos.z, e.b._pos.x, e.b._pos.y, e.b._pos.z], i * 6);
    const ca = FACTIONS[e.a.faction].color;
    const cb = FACTIONS[e.b.faction].color;
    // 选中人物时，与其相关的线保持全亮，其余变暗
    const dim = selected && selected !== e.a && selected !== e.b ? 0.3 : 1;
    col.set([ca.r * dim, ca.g * dim, ca.b * dim, cb.r * dim, cb.g * dim, cb.b * dim], i * 6);
  });
  lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/* ---------------- 选中人物的金色光束 ----------------
   选中后从其星体向所有关系人辐射金色光束（借鉴诗云选中诗人时的诗作放射），
   透明度在渲染循环里呼吸 */
const beamGeo = new THREE.BufferGeometry();
beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
beamGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3));
const beamMat = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const beams = new THREE.LineSegments(beamGeo, beamMat);
beams.frustumCulled = false;
beams.visible = false;
scene.add(beams);

function rebuildBeams() {
  if (!selected) { beams.visible = false; return; }
  const rels = edges.filter((e) => e.a === selected || e.b === selected);
  const pos = new Float32Array(rels.length * 6);
  const col = new Float32Array(rels.length * 6);
  rels.forEach((e, i) => {
    const o = e.a === selected ? e.b : e.a;
    pos.set([selected._pos.x, selected._pos.y, selected._pos.z, o._pos.x, o._pos.y, o._pos.z], i * 6);
    const oc = FACTIONS[o.faction].color;
    // 起点亮金，末端渐变为对方势力色
    col.set([1.0, 0.82, 0.35, oc.r * 0.9, oc.g * 0.9, oc.b * 0.9], i * 6);
  });
  beamGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  beams.visible = rels.length > 0;
}

/* ---------------- 大星金晕（剧情关系 ≥5 的名人地标） ---------------- */
{
  const halo = characters.filter((c) => (dStory.get(c.name) || 0) >= 5);
  const pos = new Float32Array(halo.length * 3);
  halo.forEach((c, i) => pos.set([c._pos.x, c._pos.y, c._pos.z], i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 5 * S,
    map: starTexture,
    color: 0xffc94d,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(geo, mat));
}

/* ---------------- 本命武将（金色光环） ---------------- */
function makeRingTexture(stroke = "rgba(255, 208, 84, 1)") {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}
const benshenRing = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeRingTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
);
benshenRing.visible = false;
scene.add(benshenRing);

let benshenId = Number(localStorage.getItem('sanguo-benshen') || 0);
const benshenBadge = document.getElementById('benshin');
const benshenBtn = document.getElementById('panel-benshen');

function updateBenshen() {
  const c = byId.get(benshenId) || null;
  if (c && c._pos) {
    benshenBadge.textContent = `★ 本命 · ${c.name}`;
    benshenBadge.classList.remove('hidden');
    benshenRing.position.copy(c._pos);
    benshenRing.visible = true;
  } else {
    benshenBadge.classList.add('hidden');
    benshenRing.visible = false;
  }
  benshenBtn.textContent = selected && selected.id === benshenId ? '★ 已是本命' : '设为本命';
}
benshenBadge.addEventListener('click', () => {
  const c = byId.get(benshenId);
  if (c) openPanel(c);
});
benshenBtn.addEventListener('click', () => {
  if (!selected) return;
  benshenId = selected.id === benshenId ? 0 : selected.id;
  if (benshenId) localStorage.setItem('sanguo-benshen', String(benshenId));
  else localStorage.removeItem('sanguo-benshen');
  updateBenshen();
});

/* ---------------- 高亮（悬停 / 选中）：势力色圆环，屏幕尺寸恒定 ---------------- */
const highlight = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeRingTexture("rgba(255, 255, 255, 1)"),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
);
highlight.visible = false;
scene.add(highlight);

function showHighlight(c) {
  highlight.position.copy(c._pos);
  highlight.material.color.set(FACTIONS[c.faction].css);
  highlight.visible = true;
}
function hideHighlight() {
  highlight.visible = false;
}

/* ---------------- 星体名字标签（借鉴诗云：近距离星体浮现人名） ----------------
   剧情地标人物（金晕）常显、相机靠近淡入；悬停/选中人物单独一个标签 */
const labelCache = new Map(); // id -> CanvasTexture
function makeNameTexture(c) {
  if (labelCache.has(c.id)) return labelCache.get(c.id);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 52px "Kaiti SC", "KaiTi", "STKaiti", "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 210, 90, 0.9)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(c.name, 128, 50);
  const tex = new THREE.CanvasTexture(canvas);
  labelCache.set(c.id, tex);
  return tex;
}
// 地标人物标签（dStory ≥5，与大星金晕同一批）
const landmarkLabels = [];
{
  const halo = characters.filter((c) => (dStory.get(c.name) || 0) >= 5);
  for (const c of halo) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeNameTexture(c), transparent: true, opacity: 0, depthWrite: false })
    );
    sp.position.copy(c._pos);
    scene.add(sp);
    landmarkLabels.push({ c, sp });
  }
}
// 悬停 / 选中人物标签
const focusLabel = new THREE.Sprite(
  new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
focusLabel.visible = false;
scene.add(focusLabel);

/* ---------------- 拾取 ---------------- */
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 1.5 * S;
const pointer = new THREE.Vector2();

function pickStar(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const targets = Object.values(groups)
    .filter((g) => g.points.visible)
    .map((g) => g.points);
  const hits = raycaster.intersectObjects(targets, false);
  if (!hits.length) return null;
  const key = Object.keys(groups).find((k) => groups[k].points === hits[0].object);
  return groups[key].list[hits[0].index];
}

/* ---------------- 相机飞行 ---------------- */
let fly = null; // { fromPos, toPos, fromTarget, toTarget, t0, dur }
function flyTo(c) {
  const toTarget = c._pos.clone();
  const dir = camera.position.clone().sub(controls.target).normalize();
  const toPos = toTarget.clone().add(dir.multiplyScalar((13 + (c._mul - 1) * 2.2) * S));
  fly = {
    fromPos: camera.position.clone(),
    toPos,
    fromTarget: controls.target.clone(),
    toTarget,
    t0: performance.now(),
    dur: 900,
  };
}

/* ---------------- UI：势力筛选 ---------------- */
const filterBar = document.getElementById('faction-filter');
const filterDefs = [{ key: 'all', label: '全部', css: '#ffffff' }, ...Object.entries(FACTIONS).map(([key, m]) => ({ key, label: m.label, css: m.css }))];
for (const d of filterDefs) {
  const btn = document.createElement('button');
  btn.dataset.f = d.key;
  btn.innerHTML = d.key === 'all'
    ? `全部`
    : `<i style="background:${d.css};color:${d.css}"></i>${d.label}`;
  btn.addEventListener('click', () => applyFilter(d.key));
  filterBar.appendChild(btn);
}
function applyFilter(key) {
  currentFilter = key;
  for (const btn of filterBar.children) btn.classList.toggle('active', btn.dataset.f === key);
  for (const [f, g] of Object.entries(groups)) {
    g.points.visible = factionVisible(f);
  }
  if (selected && !factionVisible(selected.faction)) closePanel();
  rebuildLines();
}
filterBar.children[0].classList.add('active');

/* ---------------- UI：人物面板 ---------------- */
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');

// 生平/名言大文本独立成 bios.json，打开面板时按需 fetch 一次并缓存
let bios = null;
let biosPromise = null;
function ensureBios() {
  if (bios) return Promise.resolve(bios);
  if (!biosPromise) {
    biosPromise = fetch('./data/bios.json')
      .then((r) => r.json())
      .then((d) => { bios = d; return d; });
  }
  return biosPromise;
}

function renderPanelBody(c) {
  const f = FACTIONS[c.faction];
  const meta = [
    c.courtesy && `字 ${c.courtesy}`,
    c.role,
    c.title,
    c.years,
  ].filter(Boolean).join(' · ');
  const rels = edges.filter((e) => e.a === c || e.b === c);
  // 面板最多展示 12 条，避免大家族刷屏
  const shown = rels.slice(0, 12);
  const more = rels.length - shown.length;
  const relsHtml = rels.length
    ? `<h3>关 系</h3><ul class="rels">${shown
        .map((e) => {
          const other = e.a === c ? e.b : e.a;
          const oc = FACTIONS[other.faction].css;
          return `<li><span class="rel-type">${e.type}</span><a href="#" data-name="${other.name}" style="--fc:${oc}">${other.name}</a></li>`;
        })
        .join('')}${more > 0 ? `<li class="rel-more">…另有 ${more} 条关系</li>` : ''}</ul>`
    : '';
  const b = (bios && bios[c.name]) || {};
  const bioHtml = b.bio
    ? `<p class="bio">${b.bio}</p>`
    : '<p class="bio pending">生平简介撰写中…</p>';
  const quoteHtml = b.quote
    ? `<blockquote style="--fc:${f.css}"><span class="qtext">「${b.quote}」</span><span class="src">${b.quoteSource || ''}</span></blockquote>`
    : '';
  panelBody.innerHTML = `
    <div class="panel-head">
      <span class="badge" style="--fc:${f.css}">${f.label}</span>
      <h2>${c.name}</h2>
    </div>
    ${meta ? `<p class="meta-line">${meta}</p>` : ''}
    <h3>生 平</h3>
    ${bioHtml}
    ${quoteHtml}
    ${relsHtml}
  `;
}

function openPanel(c) {
  selected = c;
  panel.classList.remove('hidden');
  renderPanelBody(c);
  // 生平数据到位且面板仍指向当前人物时，补渲染一次完整内容
  ensureBios().then(() => { if (selected === c) renderPanelBody(c); });
  // 永久分享链接（借鉴诗云 #a=诗人id）
  history.replaceState(null, '', `#a=${c.id}`);
  benshenBtn.textContent = c.id === benshenId ? '★ 已是本命' : '设为本命';
  rebuildLines();
  rebuildBeams();
  flyTo(c);
}
function closePanel() {
  selected = null;
  panel.classList.add('hidden');
  rebuildLines();
  rebuildBeams();
}
// 面板内点击关系人名 → 跳转到该人物
panelBody.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-name]');
  if (!a) return;
  e.preventDefault();
  const c = byName.get(a.dataset.name);
  if (c) openPanel(c);
});
document.getElementById('panel-close').addEventListener('click', closePanel);
// 分享按钮：复制当前链接（#a=人物id）
document.getElementById('panel-share').addEventListener('click', () => {
  navigator.clipboard.writeText(location.href).then(() => {
    const b = document.getElementById('panel-share');
    b.textContent = '✓ 已复制';
    setTimeout(() => { b.textContent = '⧉ 分享'; }, 1400);
  });
});
const flyKeys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePanel();
    hideSearchList();
    return;
  }
  if (e.target && e.target.tagName === 'INPUT') return; // 输入框内不劫持按键
  // H 隐藏/显示界面（诗云同款）
  if (e.key === 'h' || e.key === 'H') {
    document.body.classList.toggle('ui-hidden');
  }
  // F 全屏
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
  // WASD 自由飞行
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') flyKeys.add(k);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') flyKeys.delete(k);
});

/* ---------------- UI：搜索 ---------------- */
const searchInput = document.getElementById('search');
const searchList = document.getElementById('search-list');
let searchHits = [];

function renderSearchList() {
  searchList.innerHTML = '';
  searchHits.forEach((c) => {
    const f = FACTIONS[c.faction];
    const li = document.createElement('li');
    li.innerHTML = `<span>${c.name}${c.courtesy ? `（${c.courtesy}）` : ''}</span><span class="mini-badge" style="--fc:${f.css}">${f.label}</span>`;
    // 用 pointerdown 而非 click：在 input 的 blur 收起下拉之前立即响应
    li.addEventListener('pointerdown', () => {
      searchInput.value = c.name;
      hideSearchList();
      openPanel(c);
    });
    searchList.appendChild(li);
  });
  searchList.classList.toggle('show', searchHits.length > 0);
}
function hideSearchList() {
  searchList.classList.remove('show');
}
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) { hideSearchList(); return; }
  searchHits = characters
    .filter(
      (c) =>
        (currentFilter === 'all' || c.faction === currentFilter) &&
        (c.name.includes(q) || (c.courtesy || '').includes(q) || (c.title || '').includes(q))
    )
    .slice(0, 8);
  renderSearchList();
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchHits.length > 0) {
    const c = searchHits[0];
    searchInput.value = c.name;
    hideSearchList();
    openPanel(c);
  }
});
searchInput.addEventListener('blur', () => setTimeout(hideSearchList, 150));

/* ---------------- UI：悬停提示 ---------------- */
const tooltip = document.getElementById('tooltip');
let hovered = null;
// 触屏（粗指针）无悬停语义：跳过 tooltip / hover 高亮，只保留点击
const isCoarse = window.matchMedia('(pointer: coarse)').matches;

function updateHover(clientX, clientY) {
  if (isCoarse) return;
  const c = pickStar(clientX, clientY);
  hovered = c;
  renderer.domElement.style.cursor = c ? 'pointer' : 'grab';
  if (c) {
    tooltip.textContent = `${c.name}${c.courtesy ? ' · 字' + c.courtesy : ''}`;
    tooltip.style.left = Math.min(clientX + 14, window.innerWidth - 160) + 'px';
    tooltip.style.top = clientY + 16 + 'px';
    tooltip.classList.remove('hidden');
  } else {
    tooltip.classList.add('hidden');
  }
}

/* ---------------- 点击（区分拖拽；点空白 = 关面板 或 虚空寻访） ---------------- */
let downX = 0, downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  fly = null; // 用户操作时打断飞行
});
renderer.domElement.addEventListener('pointerup', (e) => {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (moved > 8) return; // 视为拖拽（触屏微移容忍稍宽）
  const c = pickStar(e.clientX, e.clientY);
  if (c) { openPanel(c); return; }
  if (selected) { closePanel(); return; }
  // 面板未开时点星空空白 → 虚空寻访：随机飞向一位人物（借鉴诗云「虚空捞诗」）
  const pool = characters.filter((x) => x !== selected);
  discover(pool[Math.floor(Math.random() * pool.length)]);
});
renderer.domElement.addEventListener('pointermove', (e) => updateHover(e.clientX, e.clientY));

let lastDiscover = null;
function discover(c) {
  if (!c) return;
  lastDiscover = c;
  openPanel(c);
}

/* ---------------- 状态 ---------------- */
document.getElementById('stat').textContent = `已收录 ${characters.length} 位人物 · 一人一星 · ${edges.length} 条关系`;

/* ---------------- 渲染循环 ---------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  const scale = window.innerHeight * 0.5;
  for (const m of starMats) m.uniforms.uScale.value = scale;
});

rebuildLines();
updateBenshen();

/* ---------------- 画质档位（高/中/低，对应 bloom、像素比与星尘密度） ---------------- */
const QUALITY_LEVELS = [
  { label: '画质·高', pr: Math.min(window.devicePixelRatio, 2), bloom: true, dust: 1 },
  { label: '画质·中', pr: Math.min(window.devicePixelRatio, 1.5), bloom: true, dust: 0.6 },
  { label: '画质·低', pr: 1, bloom: false, dust: 0.35 },
];
let qIndex = Math.max(0, QUALITY_LEVELS.findIndex((q) => q.label === localStorage.getItem('sanguo-quality')));
let useBloom = true;
const qualityBtn = document.getElementById('quality-btn');
function applyQuality() {
  const q = QUALITY_LEVELS[qIndex];
  qualityBtn.textContent = q.label;
  renderer.setPixelRatio(q.pr);
  composer.setPixelRatio(q.pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  useBloom = q.bloom;
  for (const g of Object.values(dustGroups)) {
    g.points.geometry.setDrawRange(0, Math.floor(g.count * q.dust));
  }
  localStorage.setItem('sanguo-quality', q.label);
}
qualityBtn.addEventListener('click', () => {
  qIndex = (qIndex + 1) % QUALITY_LEVELS.length;
  applyQuality();
});
applyQuality();

// 分享链接直达：#a=人物id（载入时解析 + hash 变化时响应）
function openFromHash() {
  const m = location.hash.match(/^#a=(\d+)$/);
  if (m) {
    const c = byId.get(Number(m[1]));
    if (c) openPanel(c);
  }
}
window.addEventListener("hashchange", openFromHash);
{
  const m = location.hash.match(/^#a=(\d+)$/);
  if (m) {
    const c = byId.get(Number(m[1]));
    if (c) setTimeout(() => openPanel(c), 900);
  }
}

// 首次引导（分步卡片，诗云同款：跳过 / 下一步 / 指示点）
const guide = document.getElementById('guide');
const GUIDE_STEPS = [
  { title: '三国星云 · 一人一星', text: '这里的每颗星，是一位真实的三国人物。' },
  { title: '旋转 · 缩放 · 点击', text: '拖拽旋转整片星空，滚轮拉近拉远；点击星星，读这位人物的生平与关系。' },
  { title: '虚空寻访', text: '点击星空空白，随机寻访一位人物；搜索与势力筛选，可快速定位三百英雄。' },
];
let guideStep = 0;
function renderGuide() {
  const s = GUIDE_STEPS[guideStep];
  document.getElementById('guide-step').textContent = `${guideStep + 1} / ${GUIDE_STEPS.length}`;
  document.getElementById('guide-title').textContent = s.title;
  document.getElementById('guide-text').textContent = s.text;
  document.getElementById('guide-next').textContent =
    guideStep === GUIDE_STEPS.length - 1 ? '开 始 探 索' : '下一步';
  for (const [i, d] of [...document.getElementById('guide-dots').children].entries()) {
    d.classList.toggle('on', i === guideStep);
  }
}
function closeGuide() {
  localStorage.setItem('sanguo-guide-seen', '1');
  guide.classList.add('hidden');
}
document.getElementById('guide-next').addEventListener('click', () => {
  guideStep += 1;
  if (guideStep >= GUIDE_STEPS.length) closeGuide();
  else renderGuide();
});
document.getElementById('guide-skip').addEventListener('click', closeGuide);
if (!localStorage.getItem('sanguo-guide-seen')) {
  renderGuide();
  setTimeout(() => guide.classList.remove('hidden'), 700);
}

let lastT = 0;
function animate(t) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
  lastT = t;

  if (fly) {
    const p = Math.min(1, (performance.now() - fly.t0) / fly.dur);
    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
    if (p >= 1) fly = null;
  }
  // WASD 自由飞行：沿视线水平方向前后、沿右方向左右平移
  if (flyKeys.size) {
    controls.autoRotate = false;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); // 近乎垂直俯视时取默认朝向
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const mv = new THREE.Vector3();
    if (flyKeys.has('w')) mv.add(fwd);
    if (flyKeys.has('s')) mv.sub(fwd);
    if (flyKeys.has('d')) mv.add(right);
    if (flyKeys.has('a')) mv.sub(right);
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(dt * 18 * S);
      camera.position.add(mv);
      controls.target.add(mv); // 相机与目标一起平移，视角不翻转
    }
  }
  controls.update();

  // 圆环尺寸随相机距离缩放，保持屏幕大小恒定；并带轻微呼吸
  if (highlight.visible) {
    const d = camera.position.distanceTo(highlight.position);
    highlight.scale.setScalar(d * 0.105 * (1 + Math.sin(t * 0.004) * 0.06));
  }
  if (benshenRing.visible) {
    const d = camera.position.distanceTo(benshenRing.position);
    benshenRing.scale.setScalar(d * 0.135 * (1 + Math.sin(t * 0.003) * 0.08));
  }

  // 高亮优先跟随悬停，否则跟随选中
  const focus = hovered || selected;
  if (focus && focus._pos && factionVisible(focus.faction)) {
    showHighlight(focus);
  } else {
    hideHighlight();
  }

  // 金色光束呼吸
  if (beams.visible) beamMat.opacity = 0.55 + Math.sin(t * 0.004) * 0.25;

  // 地标人物名字标签：相机靠近淡入，屏幕大小恒定；被悬停/选中时让位给 focusLabel
  for (const { c, sp } of landmarkLabels) {
    if (!factionVisible(c.faction) || c === focus) {
      sp.material.opacity *= 0.9;
      continue;
    }
    const d = camera.position.distanceTo(sp.position);
    const target = THREE.MathUtils.clamp((95 * S - d) / (35 * S), 0, 1) * 0.85;
    sp.material.opacity += (target - sp.material.opacity) * 0.08;
    const s = d * 0.052;
    sp.scale.set(s * 2.67, s, 1);
    sp.position.set(c._pos.x, c._pos.y + d * 0.055, c._pos.z);
  }

  // 悬停 / 选中人物名字标签
  if (focus && focus._pos && factionVisible(focus.faction)) {
    focusLabel.material.map = makeNameTexture(focus);
    focusLabel.material.opacity = Math.min(1, focusLabel.material.opacity + 0.12);
    const d = camera.position.distanceTo(focus._pos);
    const s = d * 0.06;
    focusLabel.scale.set(s * 2.67, s, 1);
    focusLabel.position.set(focus._pos.x, focus._pos.y + d * 0.075, focus._pos.z);
    focusLabel.visible = true;
  } else {
    focusLabel.material.opacity = 0;
    focusLabel.visible = false;
  }

  if (useBloom) composer.render();
  else renderer.render(scene, camera);
}
animate();
