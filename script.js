const sceneSvg = document.querySelector("#sceneSvg");
const stGraph = document.querySelector("#stGraph");
const vtGraph = document.querySelector("#vtGraph");
const scenarioButtons = document.querySelectorAll(".scenario-button");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const speedSlider = document.querySelector("#speedSlider");
const pushSlider = document.querySelector("#pushSlider");
const roughSlider = document.querySelector("#roughSlider");
const pressureSlider = document.querySelector("#pressureSlider");
const speedSliderValue = document.querySelector("#speedSliderValue");
const pushSliderValue = document.querySelector("#pushSliderValue");
const roughSliderValue = document.querySelector("#roughSliderValue");
const pressureSliderValue = document.querySelector("#pressureSliderValue");
const speedValue = document.querySelector("#speedValue");
const netForceValue = document.querySelector("#netForceValue");
const timeValue = document.querySelector("#timeValue");
const conclusionText = document.querySelector("#conclusionText");
const sceneTitle = document.querySelector("#sceneTitle");
const sceneBadge = document.querySelector("#sceneBadge");

const SVG_NS = "http://www.w3.org/2000/svg";
const PX_PER_METER = 85;
const TRACK_START = 90;
const TRACK_END = 805;
const TRACK_Y = 258;
const CAR_Y = 205;
const MAX_TIME = 10;
const MAX_POSITION = 8;
const MAX_SPEED = 3;

const scenarios = {
  uniform: {
    title: "匀速直线运动",
    badge: "合力为 0",
    conclusion: "匀速直线运动中，相同时间内通过的路程相同，s-t 图像是一条斜直线，v-t 图像是一条水平线。",
    defaults: { speed: 1.2, push: 4, roughness: 0.4, pressure: 1 },
  },
  speed: {
    title: "速度与图像斜率",
    badge: "速度越大，斜率越大",
    conclusion: "调大速度后，小车相同时间内走得更远，s-t 图像更陡；v-t 图像的水平线位置更高。",
    defaults: { speed: 1.7, push: 4, roughness: 0.4, pressure: 1 },
  },
  balance: {
    title: "二力平衡",
    badge: "大小相等，方向相反",
    conclusion: "两个力作用在同一直线上，大小相等、方向相反时，合力为 0，小车保持静止或匀速直线运动。",
    defaults: { speed: 1.0, push: 5, roughness: 0.4, pressure: 1 },
  },
  unbalanced: {
    title: "非平衡力",
    badge: "合力改变运动状态",
    conclusion: "当左右两个力不相等时，合力不为 0，小车速度会逐渐改变，v-t 图像不再是水平线。",
    defaults: { speed: 0.8, push: 5.5, roughness: 0.4, pressure: 1 },
  },
  inertia: {
    title: "惯性现象",
    badge: "物体保持原来的运动状态",
    conclusion: "小车突然停止时，车上的物体由于惯性仍要保持原来的运动状态，所以会继续向前运动一段距离。",
    defaults: { speed: 1.3, push: 4, roughness: 0.4, pressure: 1 },
  },
  friction: {
    title: "摩擦力",
    badge: "压力和粗糙程度影响摩擦",
    conclusion: "压力越大、接触面越粗糙，摩擦力越大；摩擦力方向通常与相对运动趋势相反，会使运动更快减慢。",
    defaults: { speed: 1.8, push: 0, roughness: 0.55, pressure: 1.4 },
  },
};

let currentScenario = "uniform";
let running = false;
let lastFrameTime = 0;
let state = createInitialState();

function createInitialState() {
  const speed = Number(speedSlider.value);
  return {
    time: 0,
    carX: 0,
    carV: speed,
    blockX: 0,
    blockV: speed,
    stoppedOnce: false,
    samples: [{ t: 0, s: 0, v: speed }],
  };
}

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function clearSvg(svg) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

function append(svg, tag, attributes = {}, text = "") {
  const element = svgElement(tag, attributes);
  if (text) {
    element.textContent = text;
  }
  svg.appendChild(element);
  return element;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSpeed(value) {
  return `${Math.abs(value).toFixed(2)} m/s`;
}

function setRunning(nextRunning) {
  running = nextRunning;
  lastFrameTime = 0;
  playButton.disabled = running;
  pauseButton.disabled = !running;
}

function resetSimulation() {
  state = createInitialState();
  setRunning(false);
  render();
}

function getControls() {
  return {
    initialSpeed: Number(speedSlider.value),
    push: Number(pushSlider.value),
    roughness: Number(roughSlider.value),
    pressure: Number(pressureSlider.value),
  };
}

function forceModel() {
  const { initialSpeed, push, roughness, pressure } = getControls();
  const friction = roughness * pressure * 3.2;

  if (currentScenario === "uniform" || currentScenario === "speed") {
    return { right: 0, left: 0, friction: 0, net: 0, acceleration: 0, targetV: initialSpeed };
  }

  if (currentScenario === "balance") {
    return { right: 5, left: 5, friction: 0, net: 0, acceleration: 0, targetV: initialSpeed };
  }

  if (currentScenario === "unbalanced") {
    const left = 2;
    const net = push - left;
    return { right: push, left, friction: 0, net, acceleration: net * 0.22, targetV: null };
  }

  if (currentScenario === "friction") {
    const net = push - friction;
    return { right: push, left: 0, friction, net, acceleration: net * 0.18, targetV: null };
  }

  return { right: 0, left: 0, friction: 0, net: 0, acceleration: 0, targetV: initialSpeed };
}

function stepSimulation(dt) {
  const model = forceModel();
  state.time += dt;

  if (currentScenario === "uniform" || currentScenario === "speed" || currentScenario === "balance") {
    state.carV = model.targetV;
    state.carX += state.carV * dt;
    state.blockX = state.carX;
    state.blockV = state.carV;
  } else if (currentScenario === "inertia") {
    updateInertia(dt);
  } else {
    // 用简单定量关系表现“合力改变速度”，避免引入完整高中动力学推导。
    state.carV = clamp(state.carV + model.acceleration * dt, 0, MAX_SPEED);
    state.carX += state.carV * dt;
    state.blockX = state.carX;
    state.blockV = state.carV;
  }

  if (state.carX > MAX_POSITION || state.time > MAX_TIME) {
    state.carX = Math.min(state.carX, MAX_POSITION);
    setRunning(false);
  }

  addSample();
}

function updateInertia(dt) {
  const stopTime = 3;
  const initialSpeed = Number(speedSlider.value);

  if (state.time < stopTime) {
    state.carV = initialSpeed;
    state.blockV = initialSpeed;
    state.carX += state.carV * dt;
    state.blockX = state.carX;
    return;
  }

  if (!state.stoppedOnce) {
    state.stoppedOnce = true;
    state.blockV = Math.max(initialSpeed, 1.1);
  }

  state.carV = 0;
  state.blockV = clamp(state.blockV - 0.75 * dt, 0, MAX_SPEED);
  state.blockX += state.blockV * dt;
}

function addSample() {
  const displayPosition = currentScenario === "inertia" ? Math.max(state.carX, state.blockX) : state.carX;
  const displaySpeed = currentScenario === "inertia" && state.stoppedOnce ? state.blockV : state.carV;
  state.samples.push({
    t: clamp(state.time, 0, MAX_TIME),
    s: clamp(displayPosition, 0, MAX_POSITION),
    v: clamp(displaySpeed, 0, MAX_SPEED),
  });

  if (state.samples.length > 420) {
    state.samples.shift();
  }
}

function animate(timestamp) {
  if (!running) {
    return;
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const dt = clamp((timestamp - lastFrameTime) / 1000, 0, 0.05);
  lastFrameTime = timestamp;
  stepSimulation(dt);
  render();
  requestAnimationFrame(animate);
}

function render() {
  updateText();
  drawScene();
  drawGraph(stGraph, "s", "路程 s/m", MAX_POSITION);
  drawGraph(vtGraph, "v", "速度 v/(m/s)", MAX_SPEED);
}

function updateText() {
  const scenario = scenarios[currentScenario];
  const model = forceModel();
  const activeSpeed = currentScenario === "inertia" && state.stoppedOnce ? state.blockV : state.carV;

  sceneTitle.textContent = scenario.title;
  sceneBadge.textContent = scenario.badge;
  conclusionText.textContent = scenario.conclusion;
  speedValue.textContent = formatSpeed(activeSpeed);
  timeValue.textContent = `${state.time.toFixed(1)} s`;
  speedSliderValue.textContent = `${Number(speedSlider.value).toFixed(2)} m/s`;
  pushSliderValue.textContent = `${Number(pushSlider.value).toFixed(1)} N`;
  roughSliderValue.textContent = Number(roughSlider.value).toFixed(2);
  pressureSliderValue.textContent = `${Number(pressureSlider.value).toFixed(1)} 倍`;

  if (Math.abs(model.net) < 0.05) {
    netForceValue.textContent = "平衡";
  } else {
    netForceValue.textContent = model.net > 0 ? "向右" : "向左";
  }
}

function drawScene() {
  clearSvg(sceneSvg);
  appendMarkers(sceneSvg);
  drawTrack();
  drawDistanceScale();

  const carPx = TRACK_START + state.carX * PX_PER_METER;
  const blockPx = TRACK_START + state.blockX * PX_PER_METER;
  drawCar(carPx);
  drawBlock(blockPx);
  drawForces(carPx);
  drawSceneAnnotations(carPx, blockPx);
}

function appendMarkers(svg) {
  const defs = append(svg, "defs");
  const arrow = svgElement("marker", {
    id: "arrowHead",
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse",
  });
  arrow.appendChild(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "currentColor" }));
  defs.appendChild(arrow);
}

function drawTrack() {
  append(sceneSvg, "rect", { x: 60, y: TRACK_Y + 13, width: 780, height: 28, rx: 5, fill: "#d8e0ec" });
  append(sceneSvg, "line", { x1: 70, y1: TRACK_Y, x2: 835, y2: TRACK_Y, stroke: "#475569", "stroke-width": 6, "stroke-linecap": "round" });
  append(sceneSvg, "line", { x1: 70, y1: TRACK_Y + 38, x2: 835, y2: TRACK_Y + 38, stroke: "#94a3b8", "stroke-width": 2 });
}

function drawDistanceScale() {
  for (let meter = 0; meter <= 8; meter += 1) {
    const x = TRACK_START + meter * PX_PER_METER;
    append(sceneSvg, "line", { x1: x, y1: TRACK_Y + 5, x2: x, y2: TRACK_Y + 26, stroke: "#64748b", "stroke-width": 2 });
    append(sceneSvg, "text", { x, y: TRACK_Y + 58, "text-anchor": "middle", class: "scene-small-label" }, `${meter} m`);
  }
}

function drawCar(x) {
  append(sceneSvg, "rect", { x: x - 58, y: CAR_Y, width: 116, height: 42, rx: 10, fill: "#2563eb" });
  append(sceneSvg, "path", { d: `M ${x - 36} ${CAR_Y} L ${x - 18} ${CAR_Y - 28} L ${x + 34} ${CAR_Y - 28} L ${x + 52} ${CAR_Y} Z`, fill: "#60a5fa" });
  append(sceneSvg, "rect", { x: x - 14, y: CAR_Y - 22, width: 34, height: 18, rx: 4, fill: "#e0f2fe" });
  append(sceneSvg, "circle", { cx: x - 36, cy: CAR_Y + 46, r: 15, fill: "#1e293b" });
  append(sceneSvg, "circle", { cx: x + 38, cy: CAR_Y + 46, r: 15, fill: "#1e293b" });
  append(sceneSvg, "circle", { cx: x - 36, cy: CAR_Y + 46, r: 6, fill: "#cbd5e1" });
  append(sceneSvg, "circle", { cx: x + 38, cy: CAR_Y + 46, r: 6, fill: "#cbd5e1" });
}

function drawBlock(x) {
  const blockX = x - 20;
  const blockY = CAR_Y - 62;
  append(sceneSvg, "rect", { x: blockX, y: blockY, width: 44, height: 34, rx: 5, fill: "#f59e0b" });
  append(sceneSvg, "text", { x: blockX + 22, y: blockY + 23, "text-anchor": "middle", class: "scene-small-label", fill: "#78350f" }, "物体");
}

function drawForces(carPx) {
  const model = forceModel();
  if (model.right > 0) {
    drawArrow(carPx - 8, CAR_Y - 42, carPx - 8 + model.right * 18, CAR_Y - 42, "#0f9f7a", `推力 ${model.right.toFixed(1)} N`);
  }

  if (model.left > 0) {
    drawArrow(carPx + 8, CAR_Y - 78, carPx + 8 - model.left * 18, CAR_Y - 78, "#dc2626", `拉力 ${model.left.toFixed(1)} N`);
  }

  if (model.friction > 0.05) {
    drawArrow(carPx + 45, TRACK_Y - 12, carPx + 45 - model.friction * 22, TRACK_Y - 12, "#d97706", `摩擦力 ${model.friction.toFixed(1)} N`);
  }

  if (currentScenario === "inertia" && state.stoppedOnce) {
    drawArrow(TRACK_START + state.blockX * PX_PER_METER - 5, CAR_Y - 88, TRACK_START + state.blockX * PX_PER_METER + 80, CAR_Y - 88, "#7c3aed", "惯性：继续向前");
  }
}

function drawArrow(x1, y1, x2, y2, color, label) {
  append(sceneSvg, "line", {
    x1,
    y1,
    x2,
    y2,
    stroke: color,
    "stroke-width": 5,
    "stroke-linecap": "round",
    "marker-end": "url(#arrowHead)",
    style: `color: ${color}`,
  });
  append(sceneSvg, "text", { x: (x1 + x2) / 2, y: y1 - 10, "text-anchor": "middle", class: "force-label" }, label);
}

function drawSceneAnnotations(carPx, blockPx) {
  const model = forceModel();
  const position = currentScenario === "inertia" ? Math.max(state.carX, state.blockX) : state.carX;
  append(sceneSvg, "text", { x: 74, y: 52, class: "scene-label" }, `路程：${position.toFixed(2)} m`);
  append(sceneSvg, "text", { x: 74, y: 82, class: "scene-small-label" }, `速度：${formatSpeed(currentScenario === "inertia" && state.stoppedOnce ? state.blockV : state.carV)}`);
  append(sceneSvg, "text", { x: 74, y: 112, class: "scene-small-label" }, `合力：${Math.abs(model.net).toFixed(1)} N`);

  if (currentScenario === "inertia" && state.stoppedOnce) {
    append(sceneSvg, "line", { x1: carPx, y1: CAR_Y - 8, x2: blockPx, y2: CAR_Y - 8, stroke: "#7c3aed", "stroke-width": 3, "stroke-dasharray": "8 8" });
    append(sceneSvg, "text", { x: (carPx + blockPx) / 2, y: CAR_Y - 18, "text-anchor": "middle", class: "scene-small-label" }, "小车已停，物体仍向前");
  }
}

function drawGraph(svg, key, label, maxY) {
  clearSvg(svg);
  const pad = { left: 50, right: 22, top: 20, bottom: 42 };
  const width = 420;
  const height = 260;
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;

  append(svg, "rect", { x: pad.left, y: pad.top, width: chartWidth, height: chartHeight, fill: "#ffffff", stroke: "#d7deea" });

  for (let i = 0; i <= 5; i += 1) {
    const x = pad.left + (chartWidth * i) / 5;
    const y = pad.top + (chartHeight * i) / 5;
    append(svg, "line", { x1: x, y1: pad.top, x2: x, y2: pad.top + chartHeight, stroke: "#edf2f7" });
    append(svg, "line", { x1: pad.left, y1: y, x2: pad.left + chartWidth, y2: y, stroke: "#edf2f7" });
  }

  append(svg, "line", { x1: pad.left, y1: pad.top + chartHeight, x2: pad.left + chartWidth, y2: pad.top + chartHeight, stroke: "#334155", "stroke-width": 2 });
  append(svg, "line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: pad.top + chartHeight, stroke: "#334155", "stroke-width": 2 });
  append(svg, "text", { x: pad.left + chartWidth, y: height - 10, "text-anchor": "end", class: "axis-label" }, "时间 t/s");
  append(svg, "text", { x: 8, y: 16, class: "axis-label" }, label);

  for (let i = 0; i <= 5; i += 1) {
    const x = pad.left + (chartWidth * i) / 5;
    const time = (MAX_TIME * i) / 5;
    append(svg, "text", { x, y: height - 24, "text-anchor": "middle", class: "tick-label" }, time.toFixed(0));
  }

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + chartHeight - (chartHeight * i) / 4;
    const value = (maxY * i) / 4;
    append(svg, "text", { x: pad.left - 10, y: y + 4, "text-anchor": "end", class: "tick-label" }, value.toFixed(key === "s" ? 0 : 1));
  }

  const points = state.samples
    .map((sample) => {
      const x = pad.left + (sample.t / MAX_TIME) * chartWidth;
      const y = pad.top + chartHeight - (sample[key] / maxY) * chartHeight;
      return `${x.toFixed(2)},${clamp(y, pad.top, pad.top + chartHeight).toFixed(2)}`;
    })
    .join(" ");

  if (points) {
    append(svg, "polyline", { points, class: "chart-line" });
    const latest = state.samples[state.samples.length - 1];
    const latestX = pad.left + (latest.t / MAX_TIME) * chartWidth;
    const latestY = pad.top + chartHeight - (latest[key] / maxY) * chartHeight;
    append(svg, "circle", { cx: latestX, cy: clamp(latestY, pad.top, pad.top + chartHeight), r: 5, fill: "#2563eb" });
  }
}

function switchScenario(nextScenario) {
  currentScenario = nextScenario;
  applyScenarioDefaults(nextScenario);
  scenarioButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === nextScenario);
  });
  resetSimulation();
}

function applyScenarioDefaults(scenarioKey) {
  const defaults = scenarios[scenarioKey].defaults;
  speedSlider.value = defaults.speed;
  pushSlider.value = defaults.push;
  roughSlider.value = defaults.roughness;
  pressureSlider.value = defaults.pressure;
}

scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => switchScenario(button.dataset.scenario));
});

playButton.addEventListener("click", () => {
  if (!running) {
    setRunning(true);
    requestAnimationFrame(animate);
  }
});

pauseButton.addEventListener("click", () => setRunning(false));
resetButton.addEventListener("click", resetSimulation);

[speedSlider, pushSlider, roughSlider, pressureSlider].forEach((slider) => {
  slider.addEventListener("input", () => {
    if (!running) {
      state = createInitialState();
    }
    render();
  });
});

resetSimulation();
