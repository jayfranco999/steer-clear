/**
 * STEER CLEAR - Ceremony Box Edition
 * 
 * Gesture-controlled driving game with body tilt steering.
 * Tilt left/right to dodge obstacles. Chain dodges, survive chaos.
 * 
 * Integrated with Ceremony Engine for dramatic reveals.
 */

import { PHASES } from '../../shared/ceremony-engine.js';

// Game constants
const TILT_THRESHOLD = 0.12; // Requires deliberate swerve, not twitchy
const MAX_CRASHES = 2; // 2 crashes = out
const BASE_SPAWN_DELAY = 2800;
const MIN_SPAWN_DELAY = 1200;
const SPEED_INCREMENT = 0.02; // 2% per dodge

const DRINK_THRESHOLDS = {
    disaster: 5,    // Survived <5 = bottoms up
    bad: 10,        // Survived <10 = 2 sips
    ok: 15,         // Survived <15 = 1 sip
    good: 15        // Survived 15+ = pick someone
};

// Chaos mechanics
const CHAOS_MODES = {
    REVERSED: { name: 'REVERSED', chance: 0.25, duration: 5, icon: '🔄' },
    DRUNK_DRIVER: { name: 'DRUNK DRIVER', chance: 0.25, duration: 3, icon: '🍺' },
    CONVOY: { name: 'CONVOY', chance: 0.25, cars: 3, icon: '🚗🚗🚗' },
    WIDE_LOAD: { name: 'WIDE LOAD', chance: 0.25, icon: '🚛' }
};

// Hype messages
const HYPE_MESSAGES = {
    5: "NOT BAD",
    10: "GETTING SPICY",
    15: "UNKILLABLE",
    20: "JESUS TAKE THE WHEEL",
    30: "ARE YOU EVEN HUMAN?",
    40: "LEGEND STATUS",
    50: "LITERALLY IMPOSSIBLE"
};

let container = null;
let ceremony = null;
let sync = null;
let pose = null;
let camera = null;
let animationId = null;
let spawnTimeout = null;

const gameState = {
    phase: 'waiting',
    currentPlayer: null,
    currentLane: 1, // 0=left, 1=center, 2=right
    steeringPose: 'center',
    obstacles: [],
    obstacleId: 0,
    chain: 0,
    bestChain: 0,
    crashes: 0,
    gameSpeed: 0.7,
    chaosMode: null,
    chaosRemaining: 0,
    reversed: false,
    roundScores: []
};

// === INITIALIZATION ===
export async function init(containerEl, options) {
    container = containerEl;
    ceremony = options.ceremony;
    sync = options.sync;
    
    // Render game UI
    render();
    
    // Register with ceremony engine
    ceremony.registerGame({
        onRunStart: startRun,
        isGameOver: () => gameState.roundScores.length >= options.players.length,
        calculatePenalty: calculatePenalty
    });
    
    // Init pose detection
    await initPose();
}

function render() {
    container.innerHTML = `
        <div class="steerclear-game">
            <style>
                .steerclear-game {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, #020008 0%, #0a0020 40%, #120030 70%, #0a0a15 100%);
                    position: relative;
                    overflow: hidden;
                    font-family: 'Press Start 2P', monospace;
                }
                
                /* Stars */
                .stars {
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 50%;
                    background-image:
                        radial-gradient(1px 1px at 10% 10%, rgba(255,255,255,0.8), transparent),
                        radial-gradient(2px 2px at 30% 15%, rgba(0,255,255,0.6), transparent),
                        radial-gradient(1px 1px at 50% 8%, rgba(255,255,255,0.7), transparent),
                        radial-gradient(2px 2px at 70% 20%, rgba(255,0,255,0.5), transparent),
                        radial-gradient(1px 1px at 90% 12%, rgba(255,255,255,0.8), transparent);
                    animation: starTwinkle 4s ease-in-out infinite;
                }
                
                @keyframes starTwinkle {
                    0%, 100% { opacity: 0.8; }
                    50% { opacity: 1; }
                }
                
                /* Road */
                .road {
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    height: 70%;
                    clip-path: polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%);
                    background: linear-gradient(180deg, #0a0a12 0%, #050508 100%);
                }
                
                .road-lines {
                    position: absolute;
                    bottom: 0; left: 50%;
                    transform: translateX(-50%);
                    width: 4px;
                    height: 100%;
                    background: repeating-linear-gradient(
                        to bottom,
                        rgba(0, 255, 255, 0.8) 0px,
                        rgba(0, 255, 255, 0.8) 40px,
                        transparent 40px,
                        transparent 80px
                    );
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
                    animation: roadScroll 1.5s linear infinite;
                }
                
                @keyframes roadScroll {
                    from { background-position-y: 0; }
                    to { background-position-y: 80px; }
                }
                
                .road-glow-left, .road-glow-right {
                    position: absolute;
                    bottom: 0; height: 100%; width: 3px;
                    box-shadow: 0 0 20px rgba(255, 0, 255, 0.6);
                }
                .road-glow-left { left: 32%; background: rgba(255, 0, 255, 0.5); }
                .road-glow-right { right: 32%; background: rgba(255, 0, 255, 0.5); }
                
                /* Lanes */
                .lane-marker {
                    position: absolute;
                    width: 2px;
                    height: 100%;
                    background: repeating-linear-gradient(
                        to bottom,
                        rgba(255, 255, 255, 0.15) 0px,
                        rgba(255, 255, 255, 0.15) 30px,
                        transparent 30px,
                        transparent 60px
                    );
                    animation: roadScroll 1.5s linear infinite;
                }
                .lane-marker.left { left: 40%; }
                .lane-marker.right { left: 60%; }
                
                /* Player car */
                .player-car {
                    position: absolute;
                    bottom: 10%;
                    width: 60px;
                    height: 100px;
                    transition: left 0.15s ease-out;
                    z-index: 20;
                }
                
                .player-car.lane-0 { left: 15%; }
                .player-car.lane-1 { left: calc(50% - 30px); }
                .player-car.lane-2 { left: 75%; }
                
                .car-body {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, #00ddff 0%, #0088bb 40%, #004466 100%);
                    border-radius: 12px 12px 6px 6px;
                    box-shadow: 0 0 30px rgba(0, 255, 255, 0.6), 0 15px 40px rgba(0, 0, 0, 0.5);
                    position: relative;
                }
                
                .car-body::before {
                    content: '';
                    position: absolute;
                    top: 20px; left: 10px; right: 10px;
                    height: 30px;
                    background: rgba(0, 0, 0, 0.4);
                    border-radius: 6px;
                }
                
                .car-body::after {
                    content: '';
                    position: absolute;
                    bottom: -20px; left: 50%;
                    transform: translateX(-50%);
                    width: 50px; height: 35px;
                    background: radial-gradient(ellipse, rgba(255, 200, 50, 0.5), transparent);
                    filter: blur(10px);
                }
                
                /* Obstacles */
                .obstacle {
                    position: absolute;
                    width: 50px;
                    height: 80px;
                    z-index: 15;
                    transform-origin: center center;
                }
                
                .obstacle.lane-0 { left: 17%; }
                .obstacle.lane-1 { left: calc(50% - 25px); }
                .obstacle.lane-2 { left: 73%; }
                
                .obstacle.wide { width: calc(50% + 10px); left: 25% !important; }
                
                .obstacle-body {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, #ff3366 0%, #cc0044 100%);
                    border-radius: 8px 8px 4px 4px;
                    box-shadow: 0 0 25px rgba(255, 51, 102, 0.6);
                }
                
                .obstacle.wide .obstacle-body {
                    background: linear-gradient(180deg, #ff9900 0%, #cc6600 100%);
                    box-shadow: 0 0 25px rgba(255, 153, 0, 0.6);
                }
                
                /* Stats */
                .game-stats {
                    position: absolute;
                    top: 15px; left: 15px; right: 15px;
                    display: flex;
                    justify-content: space-between;
                    z-index: 30;
                }
                
                .stat {
                    text-align: center;
                }
                
                .stat-label {
                    font-size: 8px;
                    color: rgba(255, 255, 255, 0.5);
                    margin-bottom: 4px;
                }
                
                .stat-value {
                    font-size: 22px;
                    color: #00ffff;
                    text-shadow: 0 0 10px #00ffff;
                }
                
                .stat-value.bad { color: #ff3366; text-shadow: 0 0 10px #ff3366; }
                
                /* Chaos indicator */
                .chaos-indicator {
                    position: absolute;
                    top: 80px; left: 50%;
                    transform: translateX(-50%);
                    padding: 10px 25px;
                    background: rgba(255, 0, 0, 0.2);
                    border: 2px solid #ff3366;
                    font-size: 14px;
                    color: #ff3366;
                    text-shadow: 0 0 10px #ff3366;
                    z-index: 35;
                    display: none;
                }
                
                .chaos-indicator.active { display: block; animation: chaosPulse 0.5s ease infinite; }
                
                @keyframes chaosPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                /* Hype message */
                .hype-message {
                    position: absolute;
                    top: 40%; left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 28px;
                    color: #ffff00;
                    text-shadow: 0 0 30px #ffff00, 0 0 60px #ff8800;
                    z-index: 40;
                    opacity: 0;
                    pointer-events: none;
                }
                
                .hype-message.show {
                    animation: hypeIn 0.8s ease forwards;
                }
                
                @keyframes hypeIn {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
                }
                
                /* Crash overlay */
                .crash-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(255, 0, 0, 0.4);
                    z-index: 50;
                    display: none;
                }
                
                .crash-overlay.show {
                    display: block;
                    animation: crashFlash 0.5s ease;
                }
                
                @keyframes crashFlash {
                    0%, 100% { opacity: 0; }
                    50% { opacity: 1; }
                }
                
                /* Camera */
                .game-camera {
                    position: absolute;
                    bottom: 15px; right: 15px;
                    width: 180px; height: 135px;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    z-index: 50;
                }
                
                .game-camera video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transform: scaleX(-1);
                }
                
                /* Steering indicator */
                .steering-indicator {
                    position: absolute;
                    bottom: 15px; left: 15px;
                    padding: 8px 15px;
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 8px;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.7);
                    z-index: 50;
                }
                
                .steering-dir {
                    font-size: 16px;
                    margin-left: 8px;
                }
            </style>
            
            <div class="stars"></div>
            
            <div class="road">
                <div class="road-lines"></div>
                <div class="road-glow-left"></div>
                <div class="road-glow-right"></div>
                <div class="lane-marker left"></div>
                <div class="lane-marker right"></div>
            </div>
            
            <div class="game-stats">
                <div class="stat">
                    <div class="stat-label">CHAIN</div>
                    <div class="stat-value" id="chain-count">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">BEST</div>
                    <div class="stat-value" id="best-count">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">CRASHES</div>
                    <div class="stat-value" id="crash-count">0</div>
                </div>
            </div>
            
            <div class="chaos-indicator" id="chaos-indicator"></div>
            <div class="hype-message" id="hype-message"></div>
            <div class="crash-overlay" id="crash-overlay"></div>
            
            <div class="player-car lane-1" id="player-car">
                <div class="car-body"></div>
            </div>
            
            <div class="steering-indicator">
                TILT <span class="steering-dir" id="steering-dir">⬆️</span>
            </div>
            
            <div class="game-camera">
                <video id="game-webcam" autoplay playsinline></video>
            </div>
        </div>
    `;
}

// === POSE DETECTION ===
async function initPose() {
    const video = document.getElementById('game-webcam');
    
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    pose.onResults(onPoseResults);
    
    camera = new Camera(video, {
        onFrame: async () => {
            await pose.send({ image: video });
        },
        width: 1280,
        height: 720
    });
    
    await camera.start();
}

function onPoseResults(results) {
    if (!results.poseLandmarks || gameState.phase !== 'running') return;
    
    // Get wrist positions for steering detection
    const leftWrist = results.poseLandmarks[15];
    const rightWrist = results.poseLandmarks[16];
    
    // Calculate tilt (positive = tilted left, negative = tilted right)
    const tilt = leftWrist.y - rightWrist.y;
    
    let newPose = 'center';
    if (tilt > TILT_THRESHOLD) {
        newPose = gameState.reversed ? 'right' : 'left';
    } else if (tilt < -TILT_THRESHOLD) {
        newPose = gameState.reversed ? 'left' : 'right';
    }
    
    // Update steering direction indicator
    const dirIndicator = document.getElementById('steering-dir');
    if (newPose === 'left') {
        dirIndicator.textContent = '⬅️';
    } else if (newPose === 'right') {
        dirIndicator.textContent = '➡️';
    } else {
        dirIndicator.textContent = '⬆️';
    }
    
    // Change lane if steering changed
    if (newPose !== gameState.steeringPose) {
        gameState.steeringPose = newPose;
        
        if (newPose === 'left' && gameState.currentLane > 0) {
            gameState.currentLane--;
            updateCarPosition();
        } else if (newPose === 'right' && gameState.currentLane < 2) {
            gameState.currentLane++;
            updateCarPosition();
        }
    }
}

function updateCarPosition() {
    const car = document.getElementById('player-car');
    car.classList.remove('lane-0', 'lane-1', 'lane-2');
    car.classList.add(`lane-${gameState.currentLane}`);
}

// === GAME LOGIC ===
function startRun(player) {
    gameState.phase = 'running';
    gameState.currentPlayer = player;
    gameState.currentLane = 1;
    gameState.chain = 0;
    gameState.bestChain = 0;
    gameState.crashes = 0;
    gameState.gameSpeed = 0.7;
    gameState.obstacles = [];
    gameState.chaosMode = null;
    gameState.chaosRemaining = 0;
    gameState.reversed = false;
    
    // Reset UI
    updateUI();
    updateCarPosition();
    document.getElementById('chaos-indicator').classList.remove('active');
    
    // Start spawning obstacles
    scheduleObstacle();
    
    // Start game loop
    animationId = requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameState.phase !== 'running') return;
    
    // Move obstacles
    gameState.obstacles.forEach(obs => {
        if (!obs.passed) {
            moveObstacle(obs);
        }
    });
    
    // Clean up passed obstacles
    gameState.obstacles = gameState.obstacles.filter(o => !o.destroyed);
    
    animationId = requestAnimationFrame(gameLoop);
}

function scheduleObstacle() {
    if (gameState.phase !== 'running') return;
    
    const delay = Math.max(MIN_SPAWN_DELAY, BASE_SPAWN_DELAY / gameState.gameSpeed);
    
    spawnTimeout = setTimeout(() => {
        spawnObstacle();
        scheduleObstacle();
    }, delay);
}

function spawnObstacle() {
    if (gameState.phase !== 'running') return;
    
    // Check for chaos trigger (every 3rd dodge after warmup)
    if (gameState.chain >= 2 && gameState.chain % 3 === 0 && !gameState.chaosMode) {
        triggerChaos();
    }
    
    // Check for convoy (spawn multiple)
    if (gameState.chaosMode === 'CONVOY' && gameState.chaosRemaining > 0) {
        spawnConvoyObstacle();
        return;
    }
    
    // Determine lane
    let lane;
    if (gameState.chaosMode === 'DRUNK_DRIVER') {
        // Spawn in player's current lane
        lane = gameState.currentLane;
    } else if (gameState.chaosMode === 'WIDE_LOAD') {
        // Wide obstacle - random side
        lane = Math.random() < 0.5 ? 0.5 : 1.5; // Covers 2 lanes
    } else {
        // Random lane
        lane = Math.floor(Math.random() * 3);
    }
    
    createObstacle(lane, gameState.chaosMode === 'WIDE_LOAD');
}

function spawnConvoyObstacle() {
    const lane = Math.floor(Math.random() * 3);
    createObstacle(lane, false);
    
    gameState.chaosRemaining--;
    
    if (gameState.chaosRemaining > 0) {
        setTimeout(() => {
            if (gameState.phase === 'running') {
                spawnConvoyObstacle();
            }
        }, 400);
    } else {
        endChaos();
    }
}

function createObstacle(lane, wide = false) {
    const id = gameState.obstacleId++;
    const obs = {
        id,
        lane,
        wide,
        progress: 0,
        passed: false,
        destroyed: false
    };
    
    gameState.obstacles.push(obs);
    
    // Create DOM element
    const obsEl = document.createElement('div');
    obsEl.id = `obstacle-${id}`;
    obsEl.className = `obstacle lane-${Math.floor(lane)}${wide ? ' wide' : ''}`;
    obsEl.innerHTML = '<div class="obstacle-body"></div>';
    obsEl.style.top = '-100px';
    
    document.querySelector('.steerclear-game').appendChild(obsEl);
}

function moveObstacle(obs) {
    const el = document.getElementById(`obstacle-${obs.id}`);
    if (!el) return;
    
    // Move down
    obs.progress += 1.0 * gameState.gameSpeed;
    
    // Calculate position (perspective effect)
    const topPercent = (obs.progress / 100) * 90 - 10;
    const scale = 0.3 + (obs.progress / 100) * 0.7;
    
    el.style.top = `${topPercent}%`;
    el.style.transform = `scale(${scale})`;
    
    // Check collision (when obstacle is at player level ~80-95%)
    if (obs.progress >= 80 && obs.progress <= 95 && !obs.passed) {
        const playerLane = gameState.currentLane;
        const obsLane = Math.floor(obs.lane);
        
        // Wide obstacles cover 2 lanes
        const collision = obs.wide 
            ? (playerLane === obsLane || playerLane === obsLane + 1)
            : playerLane === obsLane;
        
        if (collision) {
            crash();
        } else {
            dodge();
        }
        
        obs.passed = true;
    }
    
    // Remove when off screen
    if (obs.progress > 120) {
        el.remove();
        obs.destroyed = true;
    }
}

function dodge() {
    gameState.chain++;
    if (gameState.chain > gameState.bestChain) {
        gameState.bestChain = gameState.chain;
    }
    
    // Speed increase
    gameState.gameSpeed = Math.min(1.8, gameState.gameSpeed + SPEED_INCREMENT);
    
    // Check for hype message
    if (HYPE_MESSAGES[gameState.chain]) {
        showHypeMessage(HYPE_MESSAGES[gameState.chain]);
    }
    
    // Decrement chaos remaining
    if (gameState.chaosRemaining > 0 && gameState.chaosMode !== 'CONVOY') {
        gameState.chaosRemaining--;
        if (gameState.chaosRemaining <= 0) {
            endChaos();
        }
    }
    
    updateUI();
}

function crash() {
    gameState.crashes++;
    gameState.chain = 0;
    gameState.gameSpeed = 0.7; // Reset speed
    
    // Show crash effect
    const overlay = document.getElementById('crash-overlay');
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 500);
    
    // End any chaos
    endChaos();
    
    updateUI();
    
    // Check for game over
    if (gameState.crashes >= MAX_CRASHES) {
        endRun('crashed');
    }
}

function triggerChaos() {
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [key, mode] of Object.entries(CHAOS_MODES)) {
        cumulative += mode.chance;
        if (rand <= cumulative) {
            gameState.chaosMode = key;
            gameState.chaosRemaining = mode.duration || mode.cars || 1;
            
            if (key === 'REVERSED') {
                gameState.reversed = true;
            }
            
            const indicator = document.getElementById('chaos-indicator');
            indicator.textContent = `${mode.icon} ${mode.name}`;
            indicator.classList.add('active');
            
            return;
        }
    }
}

function endChaos() {
    gameState.chaosMode = null;
    gameState.chaosRemaining = 0;
    gameState.reversed = false;
    document.getElementById('chaos-indicator').classList.remove('active');
}

function showHypeMessage(message) {
    const el = document.getElementById('hype-message');
    el.textContent = message;
    el.classList.remove('show');
    void el.offsetWidth; // Force reflow
    el.classList.add('show');
}

function endRun(reason) {
    gameState.phase = 'ended';
    
    // Stop spawning
    if (spawnTimeout) {
        clearTimeout(spawnTimeout);
        spawnTimeout = null;
    }
    
    // Stop game loop
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Clear obstacles
    gameState.obstacles.forEach(obs => {
        const el = document.getElementById(`obstacle-${obs.id}`);
        if (el) el.remove();
    });
    
    const score = gameState.bestChain * 10;
    const result = {
        score,
        dodges: gameState.bestChain,
        crashes: gameState.crashes,
        reason,
        failed: gameState.bestChain < DRINK_THRESHOLDS.ok,
        disastrous: gameState.bestChain < DRINK_THRESHOLDS.disaster
    };
    
    gameState.roundScores.push(result);
    
    // Notify ceremony engine
    ceremony.completeRun(result);
}

function calculatePenalty(result) {
    if (result.dodges < DRINK_THRESHOLDS.disaster) {
        return { drinks: 1, type: 'bottoms_up' };
    } else if (result.dodges < DRINK_THRESHOLDS.bad) {
        return { drinks: 2, type: 'sips' };
    } else if (result.dodges < DRINK_THRESHOLDS.ok) {
        return { drinks: 1, type: 'sip' };
    }
    return { drinks: 0, type: 'pick_someone' };
}

function updateUI() {
    document.getElementById('chain-count').textContent = gameState.chain;
    document.getElementById('best-count').textContent = gameState.bestChain;
    document.getElementById('crash-count').textContent = gameState.crashes;
    
    if (gameState.crashes >= 1) {
        document.getElementById('crash-count').classList.add('bad');
    }
}

// === CLEANUP ===
export function destroy() {
    if (camera) camera.stop();
    if (spawnTimeout) clearTimeout(spawnTimeout);
    if (animationId) cancelAnimationFrame(animationId);
    gameState.phase = 'destroyed';
}
