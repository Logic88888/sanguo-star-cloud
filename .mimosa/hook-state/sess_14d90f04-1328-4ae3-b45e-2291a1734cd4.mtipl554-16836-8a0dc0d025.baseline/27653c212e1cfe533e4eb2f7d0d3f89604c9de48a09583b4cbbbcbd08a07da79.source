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
  edges.push({ a, b, type: r.type || '关联' });
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
const BASE_SIZE = 2.2 * S;
// 密度补偿：人数远超 300 时调暗单星（加色混合下总亮度守恒），避免星域中心过曝
const DIM = Math.pow(300 / characters.length, 0.32);
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
  0.45, // strength
  0.28, // radius（小半径保持远景清晰，不虚化）
  0.35  // threshold
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
  attribute float aSize;
  attribute float aBright;
  varying float vBright;
  void main() {
    vBright = aBright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(aSize * (uScale / -mv.z), 110.0);
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
  lineMat.opacity = vis.length > 1500 ? 0.12 : vis.length > 600 ? 0.2 : vis.length > 200 ? 0.3 : 0.4;
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

function openPanel(c) {
  selected = c;
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
  panelBody.innerHTML = `
    <div class="panel-head">
      <span class="badge" style="--fc:${f.css}">${f.label}</span>
      <h2>${c.name}</h2>
    </div>
    ${meta ? `<p class="meta-line">${meta}</p>` : ''}
    <h3>生 平</h3>
    ${c.bio ? `<p class="bio">${c.bio}</p>` : '<p class="bio pending">生平简介撰写中…</p>'}
    ${c.quote ? `<blockquote style="--fc:${f.css}"><span class="qtext">「${c.quote}」</span><span class="src">${c.quoteSource || ''}</span></blockquote>` : ''}
    ${relsHtml}
  `;
  panel.classList.remove('hidden');
  // 永久分享链接（借鉴诗云 #a=诗人id）
  history.replaceState(null, '', `#a=${c.id}`);
  benshenBtn.textContent = c.id === benshenId ? '★ 已是本命' : '设为本命';
  rebuildLines();
  flyTo(c);
}
function closePanel() {
  selected = null;
  panel.classList.add('hidden');
  rebuildLines();
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
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePanel();
    hideSearchList();
  }
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

function updateHover(clientX, clientY) {
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
  if (moved > 6) return; // 视为拖拽
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
  for (const g of Object.values(groups)) g.mat.uniforms.uScale.value = scale;
});

rebuildLines();
updateBenshen();

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

// 首次引导
const guide = document.getElementById('guide');
if (!localStorage.getItem('sanguo-guide-seen')) {
  setTimeout(() => guide.classList.remove('hidden'), 700);
}
document.getElementById('guide-start').addEventListener('click', () => {
  localStorage.setItem('sanguo-guide-seen', '1');
  guide.classList.add('hidden');
});

function animate(t) {
  requestAnimationFrame(animate);

  if (fly) {
    const p = Math.min(1, (performance.now() - fly.t0) / fly.dur);
    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
    if (p >= 1) fly = null;
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

  composer.render();
}
animate();
