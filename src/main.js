import './style.css';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

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

let rotationAngle = 0;

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

// Draw Technomagic Shield (Open Palm)
function drawTechnoShield(x, y, scale) {
  canvasCtx.save();
  canvasCtx.translate(x, y);
  
  const baseRadius = 80 * scale;
  rotationAngle += 0.05;
  
  canvasCtx.strokeStyle = "rgba(74, 222, 128, 0.9)";
  canvasCtx.lineWidth = 3;
  canvasCtx.lineCap = "round";
  canvasCtx.shadowColor = "#4ade80";
  canvasCtx.shadowBlur = 15;

  // Outer ring
  canvasCtx.rotate(rotationAngle);
  canvasCtx.beginPath();
  canvasCtx.arc(0, 0, baseRadius * 1.5, 0, Math.PI * 2);
  canvasCtx.stroke();
  
  // Outer dashes
  canvasCtx.setLineDash([15, 10]);
  canvasCtx.beginPath();
  canvasCtx.arc(0, 0, baseRadius * 1.3, 0, Math.PI * 2);
  canvasCtx.stroke();
  canvasCtx.setLineDash([]);
  
  // Inner Hexagon
  canvasCtx.rotate(-rotationAngle * 1.5);
  canvasCtx.beginPath();
  for(let i=0; i<6; i++) {
    const angle = i * Math.PI / 3;
    const px = Math.cos(angle) * baseRadius;
    const py = Math.sin(angle) * baseRadius;
    if(i===0) canvasCtx.moveTo(px, py);
    else canvasCtx.lineTo(px, py);
  }
  canvasCtx.closePath();
  canvasCtx.stroke();

  // Inner Runes (abstract lines)
  canvasCtx.rotate(rotationAngle * 2);
  for(let i=0; i<3; i++) {
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, -baseRadius*0.5);
    canvasCtx.lineTo(baseRadius*0.4, baseRadius*0.4);
    canvasCtx.lineTo(-baseRadius*0.4, baseRadius*0.4);
    canvasCtx.closePath();
    canvasCtx.stroke();
    canvasCtx.rotate(Math.PI * 2 / 3);
  }

  canvasCtx.restore();
}

// Draw Lightning (Closed Fist)
function drawLightning(startX, startY, w, h) {
  canvasCtx.save();
  canvasCtx.shadowColor = "#4ade80";
  canvasCtx.shadowBlur = 20;
  canvasCtx.strokeStyle = "rgba(163, 230, 53, 0.9)"; // Lighter green core
  canvasCtx.lineWidth = 4;
  canvasCtx.lineJoin = "miter";
  
  const numBolts = 5;
  for(let b=0; b<numBolts; b++) {
    const targetX = Math.random() > 0.5 ? (Math.random() < 0.5 ? 0 : w) : Math.random() * w;
    const targetY = (targetX === 0 || targetX === w) ? Math.random() * h : (Math.random() < 0.5 ? 0 : h);
    
    let curX = startX;
    let curY = startY;
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(curX, curY);
    
    const steps = 10;
    for(let i=1; i<=steps; i++) {
      const p = i / steps;
      const trueX = startX + (targetX - startX) * p;
      const trueY = startY + (targetY - startY) * p;
      
      const variance = 50 * (1 - Math.abs(p - 0.5)*2); // Max variance in middle
      curX = trueX + (Math.random() - 0.5) * variance;
      curY = trueY + (Math.random() - 0.5) * variance;
      
      canvasCtx.lineTo(curX, curY);
      
      // Forking
      if(Math.random() < 0.3) {
        const forkX = curX + (Math.random() - 0.5) * 100;
        const forkY = curY + (Math.random() - 0.5) * 100;
        canvasCtx.lineTo(forkX, forkY);
        canvasCtx.moveTo(curX, curY); // move back
      }
    }
    canvasCtx.stroke();
  }
  
  canvasCtx.restore();
}

async function renderLoop() {
  if (!webcamRunning) return;

  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  
  const w = canvasElement.width;
  const h = canvasElement.height;

  let startTimeMs = performance.now();
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
          drawTechnoShield(centerX, centerY, scale);
        } else if (isFist) {
          drawLightning(centerX, centerY, w, h);
        }
      }
    }
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
