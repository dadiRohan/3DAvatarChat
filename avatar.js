// ---------------- IMPORTS ----------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---------------- THREE SETUP ----------------
const container = document.getElementById("three-container");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
camera.position.set(0, 2.5, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0xcccccc);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableZoom = false;
controls.target.set(0, 1.6, 0);
controls.update();

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dir = new THREE.DirectionalLight(0xffffff, 1.8);
dir.position.set(5, 10, 5);
scene.add(dir);

// ---------------- LOAD AVATAR ----------------
const loader = new GLTFLoader();

let avatar, headMesh, teethMesh;
let eyeLeftMesh, eyeRightMesh;

let bodyMesh = null;
let bodyMorphs = {};
let currentBody  = {};
let targetBody   = {};

// morph indices
let mouthOpenIndex  = -1;
let mouthSmileIndex = -1;

let eyeBlinkLeftIndex  = -1;
let eyeBlinkRightIndex = -1;

const Avatar = 'avatar_male.glb';

loader.load('/public/models/' + Avatar, (gltf) => {
    avatar = gltf.scene;
    avatar.scale.set(1.5, 1.5, 1.5);
    avatar.position.y = 0;

    avatar.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary) {

            // --- Head Mesh ---
            if (child.name.includes("Wolf3D_Head")) {
                headMesh = child;
                const dict = headMesh.morphTargetDictionary;
                mouthOpenIndex  = dict["mouthOpen"]  ?? -1;
                mouthSmileIndex = dict["mouthSmile"] ?? -1;
                console.log("HEAD MORPH: mouthOpen =", mouthOpenIndex, "mouthSmile =", mouthSmileIndex);
            }

            // --- Teeth Mesh ---
            if (child.name.includes("Wolf3D_Teeth")) {
                teethMesh = child;
                const dict = teethMesh.morphTargetDictionary;
                console.log("TEETH DICT:", dict);
                if (dict["mouthOpen"]  !== undefined) teethMesh.morphTargetInfluences[dict["mouthOpen"]]  = 0;
                if (dict["mouthSmile"] !== undefined) teethMesh.morphTargetInfluences[dict["mouthSmile"]] = 0;
            }

            // ---- Eye Left ----
            if (child.name.includes("EyeLeft")) {
                eyeLeftMesh = child;
                const dict = eyeLeftMesh.morphTargetDictionary;
                eyeBlinkLeftIndex = dict["eyeBlinkLeft"] ?? dict["Blink"] ?? dict["eyeBlink"] ?? -1;
                console.log("eyeBlinkLeft =", eyeBlinkLeftIndex);
            }

            // ---- Eye Right ----
            if (child.name.includes("EyeRight")) {
                eyeRightMesh = child;
                const dict = eyeRightMesh.morphTargetDictionary;
                eyeBlinkRightIndex = dict["eyeBlinkRight"] ?? dict["Blink"] ?? dict["eyeBlink"] ?? -1;
                console.log("eyeBlinkRight =", eyeBlinkRightIndex);
            }

            // ---- Body / Hand Gestures ----
            if (child.name.includes("Wolf3D_Body")) {
                bodyMesh = child;
                const dict = child.morphTargetDictionary;
                console.log("BODY MORPHS:", dict);
                for (const name in dict) {
                    bodyMorphs[name]  = dict[name];
                    currentBody[name] = 0;
                    targetBody[name]  = 0;
                }
            }
        }
    });

    scene.add(avatar);
}, undefined, (err) => {
    console.error("Avatar load error:", err);
});

// ---------------- RANDOM BODY GESTURE ----------------
let bodyTimer = 0;

function animateBody(delta) {
    if (!bodyMesh) return;

    bodyTimer += delta;

    // every 3–5 seconds change to a new random gesture
    if (bodyTimer > 3 + Math.random() * 2) {
        bodyTimer = 0;
        for (const name in targetBody) {
            targetBody[name] = Math.random() * 0.8;
        }
    }

    // Smooth lerp toward target
    for (const name in bodyMorphs) {
        const i = bodyMorphs[name];
        currentBody[name] += (targetBody[name] - currentBody[name]) * 0.05;
        bodyMesh.morphTargetInfluences[i] = currentBody[name];
    }
}

// ---------------- VISEME MAP ----------------
// Maps API single-letter viseme codes → { open, smile } morph values
const visemeMap = {
    // Broad open vowels
    "A":  { open: 0.95, smile: 0.10 },
    "AA": { open: 1.00, smile: 0.10 },
    "AH": { open: 0.95, smile: 0.10 },
    "AO": { open: 0.90, smile: 0.05 },
    "AW": { open: 0.90, smile: 0.05 },

    // Smile vowels
    "AE": { open: 0.75, smile: 0.30 },
    "EH": { open: 0.65, smile: 0.35 },
    "E":  { open: 0.65, smile: 0.40 },
    "IY": { open: 0.55, smile: 0.55 },
    "EE": { open: 0.55, smile: 0.55 },
    "I":  { open: 0.55, smile: 0.50 },

    // Round vowels
    "OW": { open: 0.75, smile: 0.02 },
    "O":  { open: 0.80, smile: 0.02 },
    "UH": { open: 0.55, smile: 0.00 },
    "UW": { open: 0.40, smile: 0.00 },
    "OO": { open: 0.40, smile: 0.00 },
    "U":  { open: 0.45, smile: 0.00 },

    // Closed lips
    "B":  { open: 0.00, smile: 0.05 },
    "P":  { open: 0.00, smile: 0.05 },
    "M":  { open: 0.00, smile: 0.05 },

    // Mid tongue
    "D":  { open: 0.30, smile: 0.10 },
    "L":  { open: 0.30, smile: 0.10 },
    "T":  { open: 0.28, smile: 0.10 },
    "S":  { open: 0.25, smile: 0.15 },
    "Z":  { open: 0.25, smile: 0.15 },
    "N":  { open: 0.28, smile: 0.10 },

    // Back tongue
    "K":  { open: 0.20, smile: 0.00 },
    "G":  { open: 0.22, smile: 0.00 },
    "NG": { open: 0.18, smile: 0.00 },

    // Teeth on lip
    "F":  { open: 0.15, smile: 0.25 },
    "V":  { open: 0.15, smile: 0.25 },

    // Round/wh
    "W":  { open: 0.35, smile: 0.00 },
    "Q":  { open: 0.35, smile: 0.00 },

    // Sibilants
    "SH": { open: 0.22, smile: 0.10 },
    "CH": { open: 0.22, smile: 0.10 },
    "JH": { open: 0.22, smile: 0.10 },
    "ZH": { open: 0.22, smile: 0.10 },

    // Dental
    "TH": { open: 0.35, smile: 0.15 },
    "DH": { open: 0.35, smile: 0.15 },

    // R-sounds
    "R":  { open: 0.35, smile: 0.05 },
    "ER": { open: 0.35, smile: 0.05 },

    // Y
    "Y":  { open: 0.45, smile: 0.25 },

    // Rest / silence
    "rest":    { open: 0.00, smile: 0.00 },
    "default": { open: 0.05, smile: 0.02 },
};

// ---------------- EMOTION MAP ----------------
// Maps API emotion strings → smile morph override applied at speech start
const emotionSmileMap = {
    "happy":    0.70,
    "excited":  0.80,
    "sad":      0.00,
    "angry":    0.00,
    "surprised": 0.40,
    "neutral":  0.05,
};

// ---------------- LIP SYNC ----------------
let lipSyncTimeouts = [];   // track all scheduled timeouts so we can cancel
let isTalking = false;

function setMorph(mesh, index, value) {
    if (!mesh || index == null || index < 0) return;
    mesh.morphTargetInfluences[index] = Math.max(0, Math.min(1, value));
}

function applyViseme(open, smile) {
    setMorph(headMesh, mouthOpenIndex,  open);
    setMorph(headMesh, mouthSmileIndex, smile);

    if (teethMesh) {
        const td = teethMesh.morphTargetDictionary;
        if (td["mouthOpen"]  !== undefined) setMorph(teethMesh, td["mouthOpen"],  open);
        if (td["mouthSmile"] !== undefined) setMorph(teethMesh, td["mouthSmile"], smile);
    }
}

/**
 * Precision viseme playback using the API's timing data.
 * @param {Array}  visemes  - array of { viseme, start, end } in seconds
 * @param {number} duration - total speech duration in seconds
 * @param {string} emotion  - emotion string from API
 */
function startLipSyncFromVisemes(visemes, duration, emotion) {
    stopLipSync(); // cancel any previous
    isTalking = true;

    // Apply emotion smile baseline
    const emotionSmile = emotionSmileMap[emotion] ?? emotionSmileMap["neutral"];

    visemes.forEach(({ viseme, start }) => {
        const key  = (viseme || "default").toUpperCase();
        const data = visemeMap[key] || visemeMap["default"];

        // Blend emotion smile into viseme smile (take whichever is higher)
        const blendedSmile = Math.max(data.smile, emotionSmile * 0.5);

        const t = setTimeout(() => {
            if (!isTalking) return;
            applyViseme(data.open, blendedSmile);
        }, start * 1000);

        lipSyncTimeouts.push(t);
    });

    // Schedule mouth close at end of speech
    const endT = setTimeout(() => {
        stopLipSync();
    }, duration * 1000 + 100); // small buffer

    lipSyncTimeouts.push(endT);
}

/**
 * Fallback: character-based lip sync when no viseme data.
 */
function startLipSyncFallback(text) {
    stopLipSync();
    isTalking = true;

    text = text.toUpperCase();
    const patterns = ["TH", "SH", "CH", "OO", "EE"];
    const phonemes  = [];

    let i = 0;
    while (i < text.length) {
        const pair = text.substring(i, i + 2);
        if (patterns.includes(pair)) {
            phonemes.push(pair);
            i += 2;
            continue;
        }
        if (/[A-Z]/.test(text[i])) phonemes.push(text[i]);
        i++;
    }

    let idx = 0;
    const interval = setInterval(() => {
        if (!isTalking) { clearInterval(interval); return; }
        const key  = phonemes[idx] || "default";
        const data = visemeMap[key] || visemeMap["default"];
        applyViseme(data.open, data.smile);
        idx++;
        if (idx >= phonemes.length) idx = 0;
    }, 85);

    // store as a fake timeout handle so stopLipSync can clear it
    lipSyncTimeouts.push({ _interval: interval });
}

function stopLipSync() {
    isTalking = false;

    // Clear all scheduled viseme timeouts
    lipSyncTimeouts.forEach(t => {
        if (t && t._interval !== undefined) clearInterval(t._interval);
        else clearTimeout(t);
    });
    lipSyncTimeouts = [];

    // Close mouth
    applyViseme(0, 0);
}

// ---------------- BLINKING ----------------
let blinkCooldown = 0;

function handleBlink(delta) {
    blinkCooldown += delta;

    if (blinkCooldown > 2 + Math.random() * 2) {
        blinkCooldown = 0;
        if (!eyeLeftMesh || !eyeRightMesh) return;

        eyeLeftMesh.visible  = false;
        eyeRightMesh.visible = false;

        setTimeout(() => {
            eyeLeftMesh.visible  = true;
            eyeRightMesh.visible = true;
        }, 120);
    }
}

// ---------------- VOICE SETUP ----------------
let femaleVoice = null;

function loadFemaleVoice() {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;

    const preferred = [
        "Google UK English Female",
        "Google US English Female",
        "Microsoft Zira",
        "Microsoft Aria",
        "Microsoft Jenny",
        "Microsoft Sara",
        "en-US-AriaNeural",
        "en-US-JennyNeural"
    ];

    femaleVoice = voices.find(v => preferred.includes(v.name))
        ?? voices.find(v =>
            v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("woman")  ||
            v.name.toLowerCase().includes("aria")   ||
            v.name.toLowerCase().includes("zira")
        )
        ?? voices[0];

    console.log("Selected voice:", femaleVoice?.name);
}

speechSynthesis.onvoiceschanged = loadFemaleVoice;

// ---------------- SPEECH SYNTHESIS ----------------
/**
 * Speak reply text, synced to API viseme timing.
 * @param {string} text
 * @param {Array}  visemes  - from API response
 * @param {number} duration - from API response (seconds)
 * @param {string} emotion  - from API response
 */
function avatarSpeak(text, visemes = [], duration = 0, emotion = "neutral") {
    const utter = new SpeechSynthesisUtterance(text);

    if (Avatar === 'avatar_female.glb' && femaleVoice) {
        utter.voice = femaleVoice;
    }

    utter.pitch = 1.2;
    utter.rate  = 0.95;

    utter.onstart = () => {
        if (visemes && visemes.length > 0) {
            startLipSyncFromVisemes(visemes, duration, emotion);
        } else {
            startLipSyncFallback(text);
        }
    };

    utter.onend = () => stopLipSync();

    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
}

window.avatarSpeak = avatarSpeak;

// ---------------- BACKEND API ----------------
const logEl  = document.getElementById("log");
const API_URL = "https://twodavatarchat-1.onrender.com/chat";

// ---------------- SEND USER MESSAGE ----------------
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("message").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const inputEl = document.getElementById("message");
    const msg = inputEl.value.trim();
    if (!msg) return;

    logEl.innerHTML += `<div><b>You:</b> ${msg}</div>`;
    inputEl.value = "";

    // Disable input while waiting
    inputEl.disabled = true;
    document.getElementById("sendBtn").disabled = true;

    // Typing indicator
    const typingId = `typing-${Date.now()}`;
    logEl.innerHTML += `<div id="${typingId}" style="color:gray;font-style:italic">● Bot is typing...</div>`;
    logEl.scrollTop = logEl.scrollHeight;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: msg })   // ✅ API expects "text" field
        });

        if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);

        const data = await response.json();
        console.log("API response:", data);

        document.getElementById(typingId)?.remove();

        // ✅ Extract all fields from the API response
        const replyText = data.reply   || data.text || data.response || data.message || JSON.stringify(data);
        const visemes   = data.visemes  || [];
        const emotion   = data.emotion  || "neutral";
        const duration  = data.duration || 0;

        logEl.innerHTML += `<div><b>Bot:</b> ${replyText}</div>`;
        logEl.scrollTop = logEl.scrollHeight;

        // ✅ Speak with precise viseme timing + emotion
        avatarSpeak(replyText, visemes, duration, emotion);

    } catch (err) {
        document.getElementById(typingId)?.remove();
        logEl.innerHTML += `<div style="color:red">✖ Error: ${err.message}</div>`;
        console.error("API error:", err);
    } finally {
        inputEl.disabled = false;
        document.getElementById("sendBtn").disabled = false;
        inputEl.focus();
    }
}

// ---------------- RENDER LOOP ----------------
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now   = performance.now();
    const delta = (now - prevTime) / 1000;
    prevTime    = now;

    handleBlink(delta);
    animateBody(delta);

    renderer.render(scene, camera);
}
animate();

// ---------------- RESIZE ----------------
window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});