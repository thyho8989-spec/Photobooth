// ===== Elements =====
const video = document.getElementById("video");
const stripCanvas = document.getElementById("strip");
const stripCtx = stripCanvas.getContext("2d");

const countdownEl = document.getElementById("countdown");
const shotBadgeEl = document.getElementById("shotBadge");

const btnStart = document.getElementById("btnStart");
const btnRun = document.getElementById("btnRun");
const btnReset = document.getElementById("btnReset");
const btnDownload = document.getElementById("btnDownload");
const btnPrint = document.getElementById("btnPrint");

const flipToggle = document.getElementById("flipToggle");

// ===== State =====
let stream = null;
let running = false;
let mirrorPreview = true; // default ON

// ===== Your frame size =====
const FRAME_W = 682;
const FRAME_H = 2048;

// ===== Slot rectangles (px) from your Frame.png =====
const SLOTS_PX = [
  { x: 41, y: 233, w: 604, h: 407 },  // slot 1
  { x: 41, y: 633, w: 603, h: 445 },  // slot 2
  { x: 38, y: 1108, w: 605, h: 408 }, // slot 3
  { x: 37, y: 1546, w: 604, h: 408 }  // slot 4
];

// Inset so photos don't touch rounded border
const INSET = 10;

// Frame image overlay
const frameImg = new Image();
frameImg.src = "./Frame.png";

// ===== Helpers =====
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function applyVideoMirror() {
  video.style.transform = mirrorPreview ? "scaleX(-1)" : "scaleX(1)";
}

function clearStrip() {
  stripCtx.clearRect(0, 0, stripCanvas.width, stripCanvas.height);
  stripCtx.fillStyle = "#000";
  stripCtx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
}

// object-fit: cover into a rectangle
function drawCoverCrop(ctx, img, dx, dy, dw, dh) {
  const sw = img.width;
  const sh = img.height;

  const scale = Math.max(dw / sw, dh / sh);
  const cw = dw / scale;
  const ch = dh / scale;

  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;

  ctx.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
}

// Capture a still from video, matching mirror setting
function captureFromVideo() {
  const cap = document.createElement("canvas");
  cap.width = video.videoWidth;
  cap.height = video.videoHeight;

  const cctx = cap.getContext("2d");

  if (mirrorPreview) {
    cctx.translate(cap.width, 0);
    cctx.scale(-1, 1);
  }

  cctx.drawImage(video, 0, 0);

  const img = new Image();
  img.src = cap.toDataURL("image/png");
  return new Promise((resolve) => {
    img.onload = () => resolve(img);
  });
}

async function countdown(seconds, shotIndex) {
  shotBadgeEl.textContent = `Shot ${shotIndex + 1} / 4`;
  shotBadgeEl.classList.remove("hidden");

  countdownEl.classList.remove("hidden");

  for (let s = seconds; s >= 1; s--) {
    countdownEl.textContent = String(s);
    await sleep(800);
  }

  countdownEl.textContent = "📸";
  await sleep(250);

  countdownEl.classList.add("hidden");
}

async function buildStrip(photos) {
  // wait for frame image
  if (!frameImg.complete) {
    await new Promise((r) => (frameImg.onload = r));
  }

  stripCanvas.width = FRAME_W;
  stripCanvas.height = FRAME_H;

  clearStrip();

  // Draw 4 photos into the 4 slots
  for (let i = 0; i < 4; i++) {
    const slot = SLOTS_PX[i];
    const x = slot.x + INSET;
    const y = slot.y + INSET;
    const w = slot.w - INSET * 2;
    const h = slot.h - INSET * 2;

    drawCoverCrop(stripCtx, photos[i], x, y, w, h);
  }

  // Overlay frame last
  stripCtx.drawImage(frameImg, 0, 0, FRAME_W, FRAME_H);
}

async function startCamera() {
  if (stream) return;

  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  applyVideoMirror();

  btnRun.disabled = false;
  btnReset.disabled = false;
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function runPhotobooth() {
  if (!stream || running) return;
  running = true;

  btnRun.disabled = true;
  btnStart.disabled = true;
  btnDownload.disabled = true;
  btnPrint.disabled = true;

  try {
    const photos = [];

    for (let i = 0; i < 4; i++) {
      await countdown(3, i);
      const shot = await captureFromVideo();
      photos.push(shot);
      await sleep(350);
    }

    shotBadgeEl.classList.add("hidden");

    await buildStrip(photos);

    btnDownload.disabled = false;
    btnPrint.disabled = false;
  } catch (err) {
    console.error(err);
    alert("Something went wrong. Open DevTools Console (F12) to see errors.");
  } finally {
    running = false;
    btnRun.disabled = false;
    btnStart.disabled = false;
  }
}

function downloadPNG() {
  const a = document.createElement("a");
  a.download = "VLUTE_photostrip.png";
  a.href = stripCanvas.toDataURL("image/png");
  a.click();
}

function printStrip() {
  const dataUrl = stripCanvas.toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup blocked. Allow popups to print.");
    return;
  }

  w.document.write(`
    <html>
      <head>
        <title>Print</title>
        <style>
          body { margin: 0; display: grid; place-items: center; }
          img { width: 100%; max-width: 420px; height: auto; }
          @media print { img { width: 60mm; max-width: none; } }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" />
        <script>
          window.onload = () => { window.print(); window.close(); };
        </script>
      </body>
    </html>
  `);

  w.document.close();
}

function resetAll() {
  clearStrip();
  btnDownload.disabled = true;
  btnPrint.disabled = true;
  shotBadgeEl.classList.add("hidden");
  countdownEl.classList.add("hidden");
}

// ===== Events =====
btnStart.addEventListener("click", startCamera);
btnRun.addEventListener("click", runPhotobooth);
btnReset.addEventListener("click", resetAll);
btnDownload.addEventListener("click", downloadPNG);
btnPrint.addEventListener("click", printStrip);

flipToggle.addEventListener("change", () => {
  mirrorPreview = flipToggle.checked;
  applyVideoMirror();
});

// Spacebar = run photobooth (after camera started)
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    runPhotobooth();
  }
});

// Init
clearStrip();
window.addEventListener("beforeunload", () => stopCamera());