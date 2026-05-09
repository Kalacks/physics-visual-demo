const canvas = document.querySelector("#demoCanvas");
const tabs = document.querySelectorAll(".tab-button");
const titleEl = document.querySelector("#demoTitle");
const subtitleEl = document.querySelector("#demoSubtitle");
const badgeEl = document.querySelector("#demoBadge");
const currentTopicEl = document.querySelector("#currentTopic");
const headlineValueEl = document.querySelector("#headlineValue");
const controlArea = document.querySelector("#controlArea");
const resultTextEl = document.querySelector("#resultText");
const factListEl = document.querySelector("#factList");

const SVG_NS = "http://www.w3.org/2000/svg";
const W = 920;
const H = 520;

const demos = {
  lens: {
    title: "凸透镜成像",
    subtitle: "拖动物体，观察像的位置、大小、正倒和虚实。",
    badge: "光路",
  },
  ohm: {
    title: "欧姆定律",
    subtitle: "调节电压和电阻，观察电流表读数和 I=U/R 的对应关系。",
    badge: "电路",
  },
  buoyancy: {
    title: "浮力模型",
    subtitle: "改变液体密度、排开液体体积和物体重力，判断上浮、悬浮或下沉。",
    badge: "浮力",
  },
  lever: {
    title: "杠杆平衡",
    subtitle: "拖动支点和力的作用点，比较左右两侧力矩。",
    badge: "力矩",
  },
  phase: {
    title: "物态变化曲线",
    subtitle: "给冰持续加热，观察温度曲线和熔化、沸腾平台段。",
    badge: "热学",
  },
};

const state = {
  active: "lens",
  drag: null,
  phaseRunning: false,
  phaseLastFrame: 0,
  lens: { objectDistance: 30, focalLength: 10, objectHeight: 7 },
  ohm: { voltage: 6, resistance: 6 },
  buoyancy: { density: 1, volume: 5, weight: 45 },
  lever: { pivotX: 460, leftX: 270, rightX: 650, leftForce: 5, rightForce: 4 },
  phase: { heatTime: 0, heatPower: 1 },
};

function svgEl(tag, attrs = {}, text = "") {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text) {
    node.textContent = text;
  }
  return node;
}

function append(tag, attrs = {}, text = "") {
  const node = svgEl(tag, attrs, text);
  canvas.appendChild(node);
  return node;
}

function clearCanvas() {
  while (canvas.firstChild) {
    canvas.removeChild(canvas.firstChild);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function format(value, digits = 1) {
  return Number(value).toFixed(digits);
}

function render(keepControls = false) {
  const demo = demos[state.active];
  titleEl.textContent = demo.title;
  subtitleEl.textContent = demo.subtitle;
  badgeEl.textContent = demo.badge;
  currentTopicEl.textContent = demo.title;
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.demo === state.active));
  if (!keepControls) {
    renderControls();
  }
  clearCanvas();

  if (state.active === "lens") renderLens();
  if (state.active === "ohm") renderOhm();
  if (state.active === "buoyancy") renderBuoyancy();
  if (state.active === "lever") renderLever();
  if (state.active === "phase") renderPhase();
}

function renderControls() {
  controlArea.innerHTML = "";

  if (state.active === "lens") {
    addSlider("objectDistance", "物距 u", state.lens.objectDistance, 6, 42, 0.1, "cm", (value) => {
      state.lens.objectDistance = value;
      render(true);
    });
    addSlider("focalLength", "焦距 f", state.lens.focalLength, 6, 16, 0.1, "cm", (value) => {
      state.lens.focalLength = value;
      state.lens.objectDistance = Math.max(state.lens.objectDistance, value * 0.6);
      render(true);
    });
  }

  if (state.active === "ohm") {
    addSlider("voltage", "电压 U", state.ohm.voltage, 0, 12, 0.1, "V", (value) => {
      state.ohm.voltage = value;
      render(true);
    });
    addSlider("resistance", "电阻 R", state.ohm.resistance, 1, 20, 0.1, "Ω", (value) => {
      state.ohm.resistance = value;
      render(true);
    });
  }

  if (state.active === "buoyancy") {
    addSlider("density", "液体密度", state.buoyancy.density, 0.6, 1.4, 0.05, "g/cm³", (value) => {
      state.buoyancy.density = value;
      render(true);
    });
    addSlider("volume", "排液体积", state.buoyancy.volume, 1, 10, 0.1, "份", (value) => {
      state.buoyancy.volume = value;
      render(true);
    });
    addSlider("weight", "物体重力 G", state.buoyancy.weight, 10, 90, 0.5, "N", (value) => {
      state.buoyancy.weight = value;
      render(true);
    });
  }

  if (state.active === "lever") {
    addSlider("leftForce", "左侧力", state.lever.leftForce, 1, 10, 0.1, "N", (value) => {
      state.lever.leftForce = value;
      render(true);
    });
    addSlider("rightForce", "右侧力", state.lever.rightForce, 1, 10, 0.1, "N", (value) => {
      state.lever.rightForce = value;
      render(true);
    });
  }

  if (state.active === "phase") {
    const row = document.createElement("div");
    row.className = "button-row";
    row.appendChild(actionButton("加热", "primary", startPhase));
    row.appendChild(actionButton("暂停", "", pausePhase));
    row.appendChild(actionButton("重置", "", resetPhase));
    controlArea.appendChild(row);
    addSlider("heatPower", "加热强度", state.phase.heatPower, 0.5, 2, 0.05, "倍", (value) => {
      state.phase.heatPower = value;
      render(true);
    });
  }
}

function addSlider(id, label, value, min, max, step, unit, onInput) {
  const row = document.createElement("label");
  row.className = "control-row";
  row.htmlFor = id;

  const head = document.createElement("span");
  head.className = "control-label";
  const name = document.createElement("span");
  name.textContent = label;
  const output = document.createElement("output");
  output.htmlFor = id;
  output.textContent = `${format(value, step < 1 ? 1 : 0)} ${unit}`;
  head.append(name, output);

  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.addEventListener("input", () => {
    output.textContent = `${format(Number(input.value), step < 1 ? 1 : 0)} ${unit}`;
    // 滑动时只重绘仿真区和结论，避免重建滑块导致拖动卡顿。
    onInput(Number(input.value));
  });

  row.append(head, input);
  controlArea.appendChild(row);
}

function actionButton(text, variant, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-button ${variant}`.trim();
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function setFacts(facts) {
  factListEl.innerHTML = "";
  facts.forEach(([name, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = name;
    dd.textContent = value;
    row.append(dt, dd);
    factListEl.appendChild(row);
  });
}

function screenToSvgPoint(event) {
  const point = canvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(canvas.getScreenCTM().inverse());
}

function addGrid() {
  append("rect", { x: 0, y: 0, width: W, height: H, fill: "#bfe7ff" });
  append("circle", { cx: 96, cy: 76, r: 34, fill: "#ffe66d", opacity: 0.92 });
  append("path", { d: "M 0 350 C 150 318 260 380 410 350 S 705 318 920 360 V 520 H 0 Z", fill: "#c7ec9f", opacity: 0.86 });
  append("path", { d: "M 0 382 C 190 352 330 414 520 382 S 760 355 920 392 V 520 H 0 Z", fill: "#aee079", opacity: 0.72 });
  for (let x = 40; x < W; x += 40) {
    append("line", { x1: x, y1: 0, x2: x, y2: H, stroke: "rgba(255,255,255,0.28)", "stroke-width": 1 });
  }
  for (let y = 40; y < H; y += 40) {
    append("line", { x1: 0, y1: y, x2: W, y2: y, stroke: "rgba(255,255,255,0.28)", "stroke-width": 1 });
  }
}

function addArrowMarker(color = "#2563eb", id = "arrow") {
  let defs = canvas.querySelector("defs");
  if (!defs) {
    defs = append("defs");
  }
  const marker = svgEl("marker", {
    id,
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse",
  });
  marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
  defs.appendChild(marker);
}

function drawArrow(x1, y1, x2, y2, color, label) {
  const id = `arrow-${color.replace("#", "")}`;
  addArrowMarker(color, id);
  append("line", {
    x1,
    y1,
    x2,
    y2,
    stroke: color,
    "stroke-width": 5,
    "stroke-linecap": "round",
    "marker-end": `url(#${id})`,
  });
  if (label) {
    append("text", { x: (x1 + x2) / 2, y: y1 - 10, "text-anchor": "middle", class: "svg-label" }, label);
  }
}

function renderLens() {
  addGrid();
  const lens = state.lens;
  const axisY = 260;
  const lensX = 470;
  const scale = 9;
  const objectX = lensX - lens.objectDistance * scale;
  const objectTop = axisY - lens.objectHeight * scale;
  const fLeft = lensX - lens.focalLength * scale;
  const fRight = lensX + lens.focalLength * scale;
  const twoFLeft = lensX - lens.focalLength * 2 * scale;
  const twoFRight = lensX + lens.focalLength * 2 * scale;
  const denom = lens.objectDistance - lens.focalLength;
  const imageDistance = Math.abs(denom) < 0.01 ? Infinity : (lens.objectDistance * lens.focalLength) / denom;
  const magnification = Number.isFinite(imageDistance) ? -imageDistance / lens.objectDistance : 0;
  const imageHeight = lens.objectHeight * magnification;
  const imageX = Number.isFinite(imageDistance) ? lensX + imageDistance * scale : W - 72;
  const imageTop = axisY - imageHeight * scale;
  const isReal = imageDistance > 0;

  append("line", { x1: 58, y1: axisY, x2: 860, y2: axisY, stroke: "#334155", "stroke-width": 3 });
  append("path", { d: `M ${lensX} 82 C ${lensX + 42} 160 ${lensX + 42} 360 ${lensX} 438 C ${lensX - 42} 360 ${lensX - 42} 160 ${lensX} 82 Z`, fill: "#dbeafe", stroke: "#2563eb", "stroke-width": 4 });
  append("line", { x1: lensX, y1: 78, x2: lensX, y2: 442, stroke: "#1d4ed8", "stroke-width": 2, "stroke-dasharray": "8 7" });

  [fLeft, fRight, twoFLeft, twoFRight].forEach((x, index) => {
    append("line", { x1: x, y1: axisY - 12, x2: x, y2: axisY + 12, stroke: "#64748b", "stroke-width": 2 });
    append("text", { x, y: axisY + 34, "text-anchor": "middle", class: "svg-small" }, index < 2 ? "F" : "2F");
  });

  drawObjectArrow(objectX, axisY, objectTop, "#0f9f7a", "物体", true, "lens-object");
  drawLensRays(objectX, objectTop, lensX, axisY, imageX, imageTop, isReal);

  if (Number.isFinite(imageDistance)) {
    drawObjectArrow(imageX, axisY, imageTop, isReal ? "#dc2626" : "#7c3aed", isReal ? "实像" : "虚像", false);
  }

  const result = lensResult(lens.objectDistance, lens.focalLength, imageDistance, magnification);
  headlineValueEl.textContent = `物距 ${format(lens.objectDistance)} cm`;
  resultTextEl.textContent = result.text;
  setFacts([
    ["物距 u", `${format(lens.objectDistance)} cm`],
    ["焦距 f", `${format(lens.focalLength)} cm`],
    ["像距 v", Number.isFinite(imageDistance) ? `${format(Math.abs(imageDistance))} cm` : "无穷远"],
    ["像的性质", result.short],
  ]);
}

function drawObjectArrow(x, axisY, topY, color, label, draggable, dragType) {
  const group = append("g", draggable ? { class: "drag-handle", "data-drag": dragType } : {});
  group.appendChild(svgEl("line", { x1: x, y1: axisY, x2: x, y2: topY, stroke: color, "stroke-width": 6, "stroke-linecap": "round" }));
  group.appendChild(svgEl("polygon", { points: `${x - 12},${topY + 15} ${x},${topY - 4} ${x + 12},${topY + 15}`, fill: color }));
  group.appendChild(svgEl("text", { x, y: topY - 16, "text-anchor": "middle", class: "svg-label", fill: color }, label));
}

function drawLensRays(objectX, objectTop, lensX, axisY, imageX, imageTop, isReal) {
  append("line", { x1: objectX, y1: objectTop, x2: lensX, y2: objectTop, stroke: "#f59e0b", "stroke-width": 3 });
  append("line", { x1: lensX, y1: objectTop, x2: imageX, y2: imageTop, stroke: "#f59e0b", "stroke-width": 3, "stroke-dasharray": isReal ? "" : "8 6" });
  append("line", { x1: objectX, y1: objectTop, x2: lensX, y2: axisY, stroke: "#0ea5e9", "stroke-width": 3 });
  append("line", { x1: lensX, y1: axisY, x2: imageX, y2: imageTop, stroke: "#0ea5e9", "stroke-width": 3, "stroke-dasharray": isReal ? "" : "8 6" });
}

function lensResult(u, f, v, m) {
  if (Math.abs(u - f) < 0.2) {
    return { text: "物体接近焦点，折射光近似平行，屏上难以得到清晰的像。", short: "不成清晰像" };
  }
  if (u > 2 * f) {
    return { text: "物体在 2 倍焦距以外，成倒立、缩小的实像。", short: "倒立缩小实像" };
  }
  if (Math.abs(u - 2 * f) < 0.3) {
    return { text: "物体在 2 倍焦距处，成倒立、等大的实像。", short: "倒立等大实像" };
  }
  if (u > f) {
    return { text: "物体在 1 倍焦距和 2 倍焦距之间，成倒立、放大的实像。", short: "倒立放大实像" };
  }
  return { text: "物体在焦距以内，成正立、放大的虚像，像和物在透镜同侧。", short: "正立放大虚像" };
}

function renderOhm() {
  addGrid();
  const { voltage, resistance } = state.ohm;
  const current = voltage / resistance;
  const knobX = 260 + ((resistance - 1) / 19) * 330;

  append("path", { d: "M 170 150 H 730 V 380 H 170 Z", fill: "none", stroke: "#334155", "stroke-width": 5, "stroke-linejoin": "round" });
  append("line", { x1: 220, y1: 130, x2: 220, y2: 190, stroke: "#2563eb", "stroke-width": 5 });
  append("line", { x1: 245, y1: 145, x2: 245, y2: 175, stroke: "#2563eb", "stroke-width": 5 });
  append("text", { x: 232, y: 114, "text-anchor": "middle", class: "svg-label" }, `${format(voltage)} V`);

  append("rect", { x: 330, y: 120, width: 250, height: 58, rx: 8, fill: "#fff7ed", stroke: "#d97706", "stroke-width": 4 });
  append("path", { d: "M 350 150 h 26 l 18 -18 l 36 36 l 36 -36 l 36 36 l 18 -18 h 40", fill: "none", stroke: "#d97706", "stroke-width": 4 });
  append("circle", { cx: knobX, cy: 150, r: 16, fill: "#2563eb", class: "drag-handle", "data-drag": "ohm-resistance" });
  append("text", { x: 455, y: 210, "text-anchor": "middle", class: "svg-label" }, `电阻 R = ${format(resistance)} Ω`);

  append("circle", { cx: 460, cy: 380, r: 58, fill: "#eff6ff", stroke: "#2563eb", "stroke-width": 4 });
  append("text", { x: 460, y: 366, "text-anchor": "middle", class: "svg-label" }, "A");
  append("text", { x: 460, y: 398, "text-anchor": "middle", class: "svg-label" }, `${format(current, 2)} A`);

  drawBar(650, 310, 150, current / 12, "#0f9f7a", "电流大小");
  drawArrow(265, 150, 315, 150, "#0f9f7a", "电流方向");

  headlineValueEl.textContent = `I = ${format(current, 2)} A`;
  resultTextEl.textContent = "电阻不变时，电压越大电流越大；电压不变时，电阻越大电流越小。";
  setFacts([
    ["电压 U", `${format(voltage)} V`],
    ["电阻 R", `${format(resistance)} Ω`],
    ["电流 I", `${format(current, 2)} A`],
    ["关系式", "I = U / R"],
  ]);
}

function drawBar(x, y, width, ratio, color, label) {
  const fillWidth = clamp(ratio, 0, 1) * width;
  append("rect", { x, y, width, height: 24, rx: 12, fill: "#e2e8f0" });
  append("rect", { x, y, width: fillWidth, height: 24, rx: 12, fill: color });
  append("text", { x: x + width / 2, y: y - 10, "text-anchor": "middle", class: "svg-small" }, label);
}

function renderBuoyancy() {
  addGrid();
  const b = state.buoyancy;
  const buoyancy = b.density * b.volume * 10;
  const diff = buoyancy - b.weight;
  const status = Math.abs(diff) < 3 ? "悬浮" : diff > 0 ? "上浮" : "下沉";
  const waterY = 170;
  const tankX = 245;
  const blockY = status === "上浮" ? 165 : status === "悬浮" ? 245 : 315;
  const blockHeight = 52 + b.volume * 4;

  append("rect", { x: tankX, y: 105, width: 430, height: 330, rx: 10, fill: "none", stroke: "#334155", "stroke-width": 4 });
  append("rect", { x: tankX + 5, y: waterY, width: 420, height: 260, fill: "rgba(96,165,250,0.28)" });
  append("path", { d: `M ${tankX + 5} ${waterY} C 330 ${waterY - 12} 410 ${waterY + 12} 490 ${waterY} S 620 ${waterY - 10} ${tankX + 425} ${waterY}`, fill: "none", stroke: "#38bdf8", "stroke-width": 4 });

  const block = append("g", { class: "drag-handle", "data-drag": "buoy-volume" });
  block.appendChild(svgEl("rect", { x: 430, y: blockY, width: 82, height: blockHeight, rx: 8, fill: "#f59e0b", stroke: "#b45309", "stroke-width": 3 }));
  block.appendChild(svgEl("text", { x: 471, y: blockY + blockHeight / 2 + 5, "text-anchor": "middle", class: "svg-label" }, "物体"));

  drawArrow(405, blockY + blockHeight, 405, blockY + blockHeight - clamp(buoyancy, 10, 100) * 1.4, "#0f9f7a", `F浮 ${format(buoyancy)} N`);
  drawArrow(540, blockY, 540, blockY + clamp(b.weight, 10, 100) * 1.4, "#dc2626", `G ${format(b.weight)} N`);
  append("text", { x: 462, y: 72, "text-anchor": "middle", class: "svg-label" }, `判断：${status}`);

  headlineValueEl.textContent = `状态：${status}`;
  resultTextEl.textContent = `F浮 ${diff > 0 ? "大于" : Math.abs(diff) < 3 ? "约等于" : "小于"} G，物体表现为${status}。`;
  setFacts([
    ["液体密度", `${format(b.density, 2)} g/cm³`],
    ["排液体积", `${format(b.volume)} 份`],
    ["浮力 F浮", `${format(buoyancy)} N`],
    ["重力 G", `${format(b.weight)} N`],
  ]);
}

function renderLever() {
  addGrid();
  const l = state.lever;
  const baseY = 270;
  const leftArm = Math.abs(l.pivotX - l.leftX) / 50;
  const rightArm = Math.abs(l.rightX - l.pivotX) / 50;
  const leftMoment = l.leftForce * leftArm;
  const rightMoment = l.rightForce * rightArm;
  const diff = rightMoment - leftMoment;
  const angle = clamp(diff * 2.6, -14, 14);
  const radians = (angle * Math.PI) / 180;

  append("text", { x: 78, y: 64, class: "svg-label" }, `左力矩：${format(leftMoment)} N·格`);
  append("text", { x: 78, y: 96, class: "svg-label" }, `右力矩：${format(rightMoment)} N·格`);

  const beam = append("g", { transform: `rotate(${angle} ${l.pivotX} ${baseY})` });
  beam.appendChild(svgEl("line", { x1: 150, y1: baseY, x2: 790, y2: baseY, stroke: "#334155", "stroke-width": 12, "stroke-linecap": "round" }));
  beam.appendChild(svgEl("circle", { cx: l.leftX, cy: baseY, r: 15, fill: "#0f9f7a", class: "drag-handle", "data-drag": "lever-left" }));
  beam.appendChild(svgEl("circle", { cx: l.rightX, cy: baseY, r: 15, fill: "#dc2626", class: "drag-handle", "data-drag": "lever-right" }));
  beam.appendChild(svgEl("line", { x1: l.leftX, y1: baseY, x2: l.leftX, y2: baseY + 45 + l.leftForce * 8, stroke: "#0f9f7a", "stroke-width": 5, "marker-end": "url(#lever-green)" }));
  beam.appendChild(svgEl("line", { x1: l.rightX, y1: baseY, x2: l.rightX, y2: baseY + 45 + l.rightForce * 8, stroke: "#dc2626", "stroke-width": 5, "marker-end": "url(#lever-red)" }));

  addArrowMarker("#0f9f7a", "lever-green");
  addArrowMarker("#dc2626", "lever-red");
  append("polygon", { points: `${l.pivotX - 32},390 ${l.pivotX + 32},390 ${l.pivotX},${baseY + 10}`, fill: "#f59e0b", stroke: "#b45309", "stroke-width": 3, class: "drag-handle", "data-drag": "lever-pivot" });
  append("text", { x: l.pivotX, y: 414, "text-anchor": "middle", class: "svg-small" }, "拖动支点");
  append("line", { x1: l.leftX, y1: baseY - 28, x2: l.pivotX, y2: baseY - 28, stroke: "#64748b", "stroke-width": 2, "stroke-dasharray": "6 5" });
  append("line", { x1: l.pivotX, y1: baseY - 44, x2: l.rightX, y2: baseY - 44, stroke: "#64748b", "stroke-width": 2, "stroke-dasharray": "6 5" });

  const balanced = Math.abs(leftMoment - rightMoment) < 0.35;
  headlineValueEl.textContent = balanced ? "杠杆平衡" : diff > 0 ? "右侧下沉" : "左侧下沉";
  resultTextEl.textContent = balanced
    ? "左右两侧力矩近似相等，满足杠杆平衡条件。"
    : "力矩较大的一侧会下沉；要恢复平衡，可以减小该侧力或力臂。";
  setFacts([
    ["左力 × 左力臂", `${format(leftMoment)} N·格`],
    ["右力 × 右力臂", `${format(rightMoment)} N·格`],
    ["左力臂", `${format(leftArm)} 格`],
    ["右力臂", `${format(rightArm)} 格`],
  ]);
}

function phaseTemperature(time) {
  // 分段加热模型：熔化和沸腾阶段吸热但温度保持不变。
  if (time <= 2) return -20 + time * 10;
  if (time <= 4) return 0;
  if (time <= 8) return (time - 4) * 25;
  return 100;
}

function phaseName(time) {
  if (time < 2) return "冰升温";
  if (time < 4) return "熔化";
  if (time < 8) return "水升温";
  return "沸腾";
}

function renderPhase() {
  addGrid();
  const p = state.phase;
  const temp = phaseTemperature(p.heatTime);
  const phase = phaseName(p.heatTime);
  const kettleX = 170;
  const kettleY = 155;
  const chart = { x: 390, y: 95, w: 430, h: 300 };

  append("rect", { x: kettleX, y: kettleY, width: 160, height: 210, rx: 18, fill: "#eff6ff", stroke: "#2563eb", "stroke-width": 4 });
  append("rect", { x: kettleX + 12, y: kettleY + 82, width: 136, height: 116, rx: 12, fill: phase === "冰升温" ? "#bfdbfe" : "#60a5fa", opacity: 0.72 });
  append("rect", { x: kettleX + 30, y: kettleY + 214, width: 100, height: 18, rx: 8, fill: "#f59e0b" });
  if (state.phaseRunning) {
    append("path", { d: `M ${kettleX + 45} ${kettleY + 244} C ${kettleX + 60} ${kettleY + 220} ${kettleX + 78} ${kettleY + 265} ${kettleX + 96} ${kettleY + 236} S ${kettleX + 132} ${kettleY + 250} ${kettleX + 140} ${kettleY + 226}`, fill: "none", stroke: "#ef4444", "stroke-width": 5 });
  }
  append("text", { x: kettleX + 80, y: kettleY + 52, "text-anchor": "middle", class: "svg-label" }, phase);
  append("text", { x: kettleX + 80, y: kettleY + 405, "text-anchor": "middle", class: "svg-label" }, `${format(temp)} ℃`);

  drawChartFrame(chart, "时间", "温度/℃");
  const points = [];
  for (let t = 0; t <= p.heatTime; t += 0.08) {
    const x = chart.x + (t / 10) * chart.w;
    const y = chart.y + chart.h - ((phaseTemperature(t) + 20) / 120) * chart.h;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  if (points.length > 0) {
    append("polyline", { points: points.join(" "), fill: "none", stroke: "#2563eb", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" });
  }
  append("line", { x1: chart.x + chart.w * 0.2, y1: chart.y + chart.h - (20 / 120) * chart.h, x2: chart.x + chart.w * 0.4, y2: chart.y + chart.h - (20 / 120) * chart.h, stroke: "#d97706", "stroke-width": 6, opacity: 0.45 });
  append("line", { x1: chart.x + chart.w * 0.8, y1: chart.y, x2: chart.x + chart.w, y2: chart.y, stroke: "#d97706", "stroke-width": 6, opacity: 0.45 });
  append("text", { x: chart.x + chart.w * 0.3, y: chart.y + chart.h - 68, "text-anchor": "middle", class: "svg-small" }, "熔化平台");
  append("text", { x: chart.x + chart.w * 0.9, y: chart.y + 28, "text-anchor": "middle", class: "svg-small" }, "沸腾平台");

  headlineValueEl.textContent = `${phase}：${format(temp)} ℃`;
  resultTextEl.textContent = phase === "熔化" || phase === "沸腾"
    ? "正在发生物态变化，继续吸热，但温度保持不变。"
    : "物质吸热后温度升高，曲线呈上升趋势。";
  setFacts([
    ["加热时间", `${format(p.heatTime)} s`],
    ["当前温度", `${format(temp)} ℃`],
    ["当前状态", phase],
    ["加热强度", `${format(p.heatPower)} 倍`],
  ]);
}

function drawChartFrame(chart, xLabel, yLabel) {
  append("rect", { x: chart.x, y: chart.y, width: chart.w, height: chart.h, fill: "#ffffff", stroke: "#d7deea" });
  for (let i = 0; i <= 5; i += 1) {
    const x = chart.x + (chart.w * i) / 5;
    const y = chart.y + (chart.h * i) / 5;
    append("line", { x1: x, y1: chart.y, x2: x, y2: chart.y + chart.h, stroke: "#edf2f7" });
    append("line", { x1: chart.x, y1: y, x2: chart.x + chart.w, y2: y, stroke: "#edf2f7" });
  }
  append("line", { x1: chart.x, y1: chart.y + chart.h, x2: chart.x + chart.w, y2: chart.y + chart.h, stroke: "#334155", "stroke-width": 2 });
  append("line", { x1: chart.x, y1: chart.y, x2: chart.x, y2: chart.y + chart.h, stroke: "#334155", "stroke-width": 2 });
  append("text", { x: chart.x + chart.w, y: chart.y + chart.h + 34, "text-anchor": "end", class: "axis-label" }, xLabel);
  append("text", { x: chart.x - 8, y: chart.y - 12, "text-anchor": "start", class: "axis-label" }, yLabel);
}

function startPhase() {
  if (state.phaseRunning) return;
  state.phaseRunning = true;
  state.phaseLastFrame = 0;
  requestAnimationFrame(tickPhase);
}

function pausePhase() {
  state.phaseRunning = false;
}

function resetPhase() {
  state.phaseRunning = false;
  state.phase.heatTime = 0;
  render();
}

function tickPhase(timestamp) {
  if (!state.phaseRunning) return;
  if (!state.phaseLastFrame) state.phaseLastFrame = timestamp;
  const dt = clamp((timestamp - state.phaseLastFrame) / 1000, 0, 0.05);
  state.phaseLastFrame = timestamp;
  state.phase.heatTime = clamp(state.phase.heatTime + dt * state.phase.heatPower, 0, 10);
  if (state.phase.heatTime >= 10) {
    state.phaseRunning = false;
  }
  render(true);
  if (state.phaseRunning) requestAnimationFrame(tickPhase);
}

function beginDrag(event) {
  const target = event.target.closest("[data-drag]");
  if (!target) return;
  state.drag = target.dataset.drag;
  canvas.setPointerCapture(event.pointerId);
  updateDrag(event);
}

function updateDrag(event) {
  if (!state.drag) return;
  const point = screenToSvgPoint(event);

  if (state.drag === "lens-object") {
    const lensX = 470;
    state.lens.objectDistance = clamp((lensX - point.x) / 9, 6, 42);
  }

  if (state.drag === "ohm-resistance") {
    state.ohm.resistance = clamp(1 + ((point.x - 260) / 330) * 19, 1, 20);
  }

  if (state.drag === "buoy-volume") {
    state.buoyancy.volume = clamp(10 - ((point.y - 155) / 250) * 9, 1, 10);
  }

  if (state.drag === "lever-pivot") {
    state.lever.pivotX = clamp(point.x, state.lever.leftX + 70, state.lever.rightX - 70);
  }

  if (state.drag === "lever-left") {
    state.lever.leftX = clamp(point.x, 160, state.lever.pivotX - 55);
  }

  if (state.drag === "lever-right") {
    state.lever.rightX = clamp(point.x, state.lever.pivotX + 55, 790);
  }

  render();
}

function endDrag(event) {
  if (!state.drag) return;
  state.drag = null;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.phaseRunning = false;
    state.active = tab.dataset.demo;
    render();
  });
});

canvas.addEventListener("pointerdown", beginDrag);
canvas.addEventListener("pointermove", updateDrag);
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

render();
