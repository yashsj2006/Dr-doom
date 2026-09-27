import './style.css';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import sealWhiteUrl from './assets/doom_seal_white.png';

// Element references
const videoContainer = document.getElementById("video-container");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("enableWebcamButton");
const loadingOverlay = document.getElementById("loading");
const uiPanel = document.querySelector(".ui-panel");

let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;

// Image asset setup
const sealImage = new Image();
sealImage.src = sealWhiteUrl;
let sealLoaded = false;
sealImage.onload = () => {
  sealLoaded = true;
};

// Animation state & particle physics
let baseAngle = 0;
let timeSec = 0;
const particles = [];
const MAX_PARTICLES = 160;

// Initialize MediaPipe
async function createHandLandmarker() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });
  } catch (e) {
    console.error("Failed to load MediaPipe model", e);
  }
}

// Helper: distance between two landmarks
function calcDist(p1, p2, w, h) {
  const dx = (p1.x - p2.x) * w;
  const dy = (p1.y - p2.y) * h;
  return Math.sqrt(dx * dx + dy * dy);
}

// Check if a finger is extended
function isExtended(wrist, tip, mcp, w, h) {
  return calcDist(wrist, tip, w, h) > calcDist(wrist, mcp, w, h) * 1.3;
}

// Spawn dark green eldritch particles
function spawnParticles(x, y, radius) {
  for (let i = 0; i < 4; i++) {
    if (particles.length > MAX_PARTICLES) particles.shift();
    const ang = Math.random() * Math.PI * 2;
    const dist = (0.2 + Math.random() * 0.95) * radius;
    particles.push({
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      vx: (Math.random() - 0.5) * 1.5 - Math.sin(ang) * 1.2,
      vy: (Math.random() - 0.5) * 1.5 + Math.cos(ang) * 1.2,
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      size: 1.5 + Math.random() * 3.5,
      hue: Math.random() > 0.4 ? "emerald" : "dark"
    });
  }
}

// Update and render dark particles
function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    canvasCtx.save();
    if (p.hue === "dark") {
      // Dark smoke / void ember
      canvasCtx.fillStyle = `rgba(5, 20, 10, ${p.life * 0.8})`;
      canvasCtx.shadowColor = "#022c15";
      canvasCtx.shadowBlur = 6;
    } else {
      // Vivid eldritch green spark
      canvasCtx.fillStyle = `rgba(34, 255, 120, ${p.life * 0.9})`;
      canvasCtx.shadowColor = "#10b981";
      canvasCtx.shadowBlur = 12;
    }
    canvasCtx.beginPath();
    canvasCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.restore();
  }
}

// Draw Doctor Doom's Dark Latverian Magic Seal
function drawDoomSeal(centerX, centerY, scale) {
  if (!sealLoaded) return;

  const radius = 175 * scale;
  const size = radius * 2;
  const pulse = Math.sin(timeSec * 5) * 0.04 + 1.0;
  const deepPulse = Math.sin(timeSec * 2.5) * 0.5 + 0.5;

  spawnParticles(centerX, centerY, radius);

  canvasCtx.save();
  canvasCtx.translate(centerX, centerY);

  // 1. Dark Void Occult Backdrop (deep black-green abyssal vortex)
  const voidGrad = canvasCtx.createRadialGradient(0, 0, 10, 0, 0, radius * 1.35);
  voidGrad.addColorStop(0, "rgba(2, 10, 5, 0.82)");
  voidGrad.addColorStop(0.45, "rgba(4, 25, 14, 0.72)");
  voidGrad.addColorStop(0.75, "rgba(2, 18, 9, 0.65)");
  voidGrad.addColorStop(0.95, "rgba(5, 30, 15, 0.35)");
  voidGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  canvasCtx.fillStyle = voidGrad;
  canvasCtx.beginPath();
  canvasCtx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
  canvasCtx.fill();

  // 2. Swirling Dark Nebula tendrils
  canvasCtx.save();
  canvasCtx.rotate(-baseAngle * 0.4);
  const tendrilCount = 6;
  for (let i = 0; i < tendrilCount; i++) {
    const ang = (i * Math.PI * 2) / tendrilCount;
    canvasCtx.strokeStyle = `rgba(1, 35, 18, ${0.4 + 0.2 * Math.sin(timeSec * 3 + i)})`;
    canvasCtx.lineWidth = 14 * scale;
    canvasCtx.beginPath();
    canvasCtx.arc(0, 0, radius * (0.8 + 0.35 * Math.sin(timeSec + i)), ang, ang + 0.8);
    canvasCtx.stroke();
  }
  canvasCtx.restore();

  // 3. Shockwave / Expanding Pulse Rings
  const waveProgress = (timeSec * 0.8) % 1.0;
  const waveRadius = radius * (0.4 + waveProgress * 0.9);
  canvasCtx.strokeStyle = `rgba(16, 185, 129, ${(1 - waveProgress) * 0.45})`;
  canvasCtx.lineWidth = 2.5;
  canvasCtx.shadowColor = "#059669";
  canvasCtx.shadowBlur = 10;
  canvasCtx.beginPath();
  canvasCtx.arc(0, 0, waveRadius, 0, Math.PI * 2);
  canvasCtx.stroke();

  // 4. Concentric Eldritch Glyphs & Runes (Outer ring)
  canvasCtx.save();
  canvasCtx.rotate(-baseAngle * 0.3);
  canvasCtx.strokeStyle = "rgba(16, 185, 129, 0.4)";
  canvasCtx.lineWidth = 1.5;
  canvasCtx.beginPath();
  canvasCtx.arc(0, 0, radius * 1.14, 0, Math.PI * 2);
  canvasCtx.stroke();

  // Runes tick notches along outer border
  const ticks = 32;
  for (let i = 0; i < ticks; i++) {
    const a = (i * Math.PI * 2) / ticks;
    const len = i % 4 === 0 ? 9 * scale : 4 * scale;
    canvasCtx.strokeStyle = i % 4 === 0 ? "rgba(52, 211, 153, 0.75)" : "rgba(6, 78, 59, 0.6)";
    canvasCtx.lineWidth = i % 4 === 0 ? 2 : 1;
    canvasCtx.beginPath();
    canvasCtx.moveTo(Math.cos(a) * (radius * 1.14 - len), Math.sin(a) * (radius * 1.14 - len));
    canvasCtx.lineTo(Math.cos(a) * (radius * 1.14), Math.sin(a) * (radius * 1.14));
    canvasCtx.stroke();
  }
  canvasCtx.restore();

  // 5. Multi-Pass Rendering of the Authentic Latverian Doom Seal
  // Layer A: Dark Emerald Atmospheric Back-Glow
  canvasCtx.save();
  canvasCtx.rotate(baseAngle);
  canvasCtx.scale(pulse, pulse);
  canvasCtx.shadowColor = "rgba(4, 120, 87, 0.95)";
  canvasCtx.shadowBlur = 40 * scale;
  canvasCtx.globalAlpha = 0.55 + deepPulse * 0.25;
  canvasCtx.drawImage(sealImage, -size / 2, -size / 2, size, size);
  canvasCtx.restore();

  // Layer B: Toxic Eldritch Core Bloom
  canvasCtx.save();
  canvasCtx.rotate(baseAngle);
  canvasCtx.scale(pulse, pulse);
  canvasCtx.shadowColor = "#34d399";
  canvasCtx.shadowBlur = 18 * scale;
  canvasCtx.globalAlpha = 0.75;
  canvasCtx.drawImage(sealImage, -size / 2, -size / 2, size, size);
  canvasCtx.restore();

  // Layer C: Chromatic Aberration & Dark Green Tinting
  canvasCtx.save();
  canvasCtx.rotate(baseAngle);
  canvasCtx.scale(pulse, pulse);

  // Subtle shift 1: Emerald Cyan
  canvasCtx.globalCompositeOperation = "screen";
  canvasCtx.shadowColor = "#059669";
  canvasCtx.shadowBlur = 8;
  canvasCtx.globalAlpha = 0.45;
  canvasCtx.drawImage(sealImage, -size / 2 - 1.5, -size / 2 + 1, size, size);

  // Subtle shift 2: Acidic Lime Green
  canvasCtx.shadowColor = "#10b981";
  canvasCtx.shadowBlur = 6;
  canvasCtx.globalAlpha = 0.5;
  canvasCtx.drawImage(sealImage, -size / 2 + 1.5, -size / 2 - 1, size, size);

  // Crisp high-contrast runes
  canvasCtx.globalCompositeOperation = "source-over";
  canvasCtx.shadowColor = "#6ee7b7";
  canvasCtx.shadowBlur = 4;
  canvasCtx.globalAlpha = 0.92;
  canvasCtx.drawImage(sealImage, -size / 2, -size / 2, size, size);
  canvasCtx.restore();

  // 6. Central Arcane Nexus Core
  const coreGrad = canvasCtx.createRadialGradient(0, 0, 0, 0, 0, 32 * scale);
  coreGrad.addColorStop(0, "rgba(220, 255, 230, 0.95)");
  coreGrad.addColorStop(0.3, "rgba(52, 211, 153, 0.8)");
  coreGrad.addColorStop(0.7, "rgba(5, 150, 105, 0.35)");
  coreGrad.addColorStop(1, "rgba(2, 44, 25, 0)");
  canvasCtx.fillStyle = coreGrad;
  canvasCtx.beginPath();
  canvasCtx.arc(0, 0, 32 * scale, 0, Math.PI * 2);
  canvasCtx.fill();

  canvasCtx.restore();
}

// Realistic Dark Latverian Lightning (Closed Fist)
function drawDoomLightning(startX, startY, w, h) {
  canvasCtx.save();

  const numBolts = 7;
  for (let b = 0; b < numBolts; b++) {
    const targetX = Math.random() > 0.5 ? (Math.random() < 0.5 ? 0 : w) : Math.random() * w;
    const targetY = (targetX === 0 || targetX === w) ? Math.random() * h : (Math.random() < 0.5 ? 0 : h);

    const boltPoints = [];
    let curX = startX;
    let curY = startY;
    boltPoints.push({ x: curX, y: curY });

    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const trueX = startX + (targetX - startX) * p;
      const trueY = startY + (targetY - startY) * p;

      const variance = 65 * (1 - Math.abs(p - 0.5) * 1.8);
      curX = trueX + (Math.random() - 0.5) * variance;
      curY = trueY + (Math.random() - 0.5) * variance;
      boltPoints.push({ x: curX, y: curY });
    }

    // Outer dark green ambient glow
    canvasCtx.strokeStyle = "rgba(4, 120, 87, 0.5)";
    canvasCtx.lineWidth = 10;
    canvasCtx.shadowColor = "#064e3b";
    canvasCtx.shadowBlur = 28;
    canvasCtx.beginPath();
    canvasCtx.moveTo(boltPoints[0].x, boltPoints[0].y);
    for (let i = 1; i < boltPoints.length; i++) {
      canvasCtx.lineTo(boltPoints[i].x, boltPoints[i].y);
    }
    canvasCtx.stroke();

    // Secondary intense emerald channel
    canvasCtx.strokeStyle = "rgba(16, 185, 129, 0.85)";
    canvasCtx.lineWidth = 4.5;
    canvasCtx.shadowColor = "#10b981";
    canvasCtx.shadowBlur = 18;
    canvasCtx.beginPath();
    canvasCtx.moveTo(boltPoints[0].x, boltPoints[0].y);
    for (let i = 1; i < boltPoints.length; i++) {
      canvasCtx.lineTo(boltPoints[i].x, boltPoints[i].y);
    }
    canvasCtx.stroke();

    // Hot blinding white-mint core
    canvasCtx.strokeStyle = "rgba(236, 253, 245, 0.95)";
    canvasCtx.lineWidth = 1.8;
    canvasCtx.shadowColor = "#6ee7b7";
    canvasCtx.shadowBlur = 8;
    canvasCtx.beginPath();
    canvasCtx.moveTo(boltPoints[0].x, boltPoints[0].y);
    for (let i = 1; i < boltPoints.length; i++) {
      canvasCtx.lineTo(boltPoints[i].x, boltPoints[i].y);
    }
    canvasCtx.stroke();

    // Random forks
    if (Math.random() < 0.6 && boltPoints.length > 6) {
      const forkIdx = Math.floor(Math.random() * (boltPoints.length - 4)) + 2;
      const forkStart = boltPoints[forkIdx];
      let fx = forkStart.x;
      let fy = forkStart.y;

      canvasCtx.strokeStyle = "rgba(52, 211, 153, 0.8)";
      canvasCtx.lineWidth = 2;
      canvasCtx.shadowBlur = 10;
      canvasCtx.beginPath();
      canvasCtx.moveTo(fx, fy);
      for (let s = 0; s < 5; s++) {
        fx += (Math.random() - 0.5) * 50;
        fy += (Math.random() - 0.5) * 50;
        canvasCtx.lineTo(fx, fy);
      }
      canvasCtx.stroke();
    }
  }

  // Core blast glow at hand position
  const handBlast = canvasCtx.createRadialGradient(startX, startY, 0, startX, startY, 70);
  handBlast.addColorStop(0, "rgba(240, 253, 244, 0.95)");
  handBlast.addColorStop(0.3, "rgba(52, 211, 153, 0.7)");
  handBlast.addColorStop(0.7, "rgba(4, 120, 87, 0.4)");
  handBlast.addColorStop(1, "rgba(0, 0, 0, 0)");
  canvasCtx.fillStyle = handBlast;
  canvasCtx.beginPath();
  canvasCtx.arc(startX, startY, 70, 0, Math.PI * 2);
  canvasCtx.fill();

  canvasCtx.restore();
}

async function renderLoop() {
  if (!webcamRunning) return;

  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  
  const w = canvasElement.width;
  const h = canvasElement.height;

  const now = performance.now();
  timeSec = now * 0.001;
  baseAngle += 0.015;

  let startTimeMs = now;
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, startTimeMs);

    canvasCtx.clearRect(0, 0, w, h);

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        const wrist = landmarks[0];
        const index_mcp = landmarks[5];
        const index_tip = landmarks[8];
        const middle_mcp = landmarks[9];
        const middle_tip = landmarks[12];
        const ring_mcp = landmarks[13];
        const ring_tip = landmarks[16];
        const pinky_mcp = landmarks[17];
        const pinky_tip = landmarks[20];

        const indexExt = isExtended(wrist, index_tip, index_mcp, w, h);
        const middleExt = isExtended(wrist, middle_tip, middle_mcp, w, h);
        const ringExt = isExtended(wrist, ring_tip, ring_mcp, w, h);
        const pinkyExt = isExtended(wrist, pinky_tip, pinky_mcp, w, h);

        const isPalmOpen = indexExt && middleExt && ringExt && pinkyExt;
        const isFist = !indexExt && !middleExt && !ringExt && !pinkyExt;

        const centerX = middle_mcp.x * w;
        const centerY = middle_mcp.y * h;
        
        // Scale based on hand size
        const wristToMcpDist = calcDist(wrist, middle_mcp, w, h);
        const scale = wristToMcpDist / 100; 

        if (isPalmOpen) {
          drawDoomSeal(centerX, centerY, scale);
        } else if (isFist) {
          drawDoomLightning(centerX, centerY, w, h);
        }
      }
    }

    // Render active dark eldritch particles
    updateAndDrawParticles();
  }

  requestAnimationFrame(renderLoop);
}

// Enable Webcam
async function enableCam() {
  if (!handLandmarker) return;
  
  webcamRunning = true;
  enableWebcamButton.classList.add("hidden");
  uiPanel.classList.add("webcam-active");

  const constraints = {
    video: { width: 1280, height: 720, facingMode: "user" }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.addEventListener("loadeddata", renderLoop);
  } catch (err) {
    console.error("Webcam error:", err);
  }
}

// App Initialization
async function init() {
  loadingOverlay.classList.add("active");
  await createHandLandmarker();
  loadingOverlay.classList.remove("active");
  enableWebcamButton.addEventListener("click", enableCam);
}

init();
