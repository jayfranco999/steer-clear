/**
 * FLIP CUP - Ceremony Box Edition
 * 
 * The classic flip cup game with hand tracking.
 * Player flips their hand to flip the cup.
 * 
 * Integrated with Ceremony Engine for dramatic reveals.
 */

import { PHASES } from '../../shared/ceremony-engine.js';

// Game constants
const FLIP_THRESHOLD = 0.15;
const MAX_TIME = 30000; // 30 seconds per turn
const DRINK_THRESHOLDS = {
    disaster: 5,      // 5+ failed flips = bottoms up
    bad: 3,           // 3-4 failed flips = 2 sips
    ok: 1,            // 1-2 failed flips = 1 sip
    clean: 0          // 0 failed flips = pick someone
};

let container = null;
let ceremony = null;
let sync = null;
let pose = null;
let camera = null;

const gameState = {
    phase: 'waiting',
    currentPlayer: null,
    cupState: 'upright', // 'upright' | 'flipping' | 'flipped'
    flipAttempts: 0,
    successfulFlips: 0,
    failedFlips: 0,
    startTime: null,
    handY: 0,
    lastHandY: 0,
    flipVelocity: 0,
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
        <div class="flipcup-game">
            <style>
                .flipcup-game {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, #1a0a2e 0%, #2d1b69 50%, #1a0a2e 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Press Start 2P', monospace;
                }
                
                /* Vaporwave grid floor */
                .grid-floor {
                    position: absolute;
                    bottom: 0;
                    left: -50%;
                    width: 200%;
                    height: 50%;
                    background-image:
                        linear-gradient(to right, #ff00ff44 1px, transparent 1px),
                        linear-gradient(to bottom, #00ffff44 1px, transparent 1px);
                    background-size: 60px 60px;
                    transform: perspective(500px) rotateX(60deg);
                    transform-origin: top;
                    animation: gridScroll 2s linear infinite;
                }
                
                @keyframes gridScroll {
                    from { background-position: 0 0; }
                    to { background-position: 0 60px; }
                }
                
                /* Table */
                .table {
                    width: 80%;
                    max-width: 600px;
                    height: 20px;
                    background: linear-gradient(90deg, #4a2c7a, #6b4d9a, #4a2c7a);
                    border-radius: 10px;
                    position: relative;
                    box-shadow: 
                        0 10px 30px rgba(0, 0, 0, 0.5),
                        0 0 20px rgba(255, 0, 255, 0.3);
                    z-index: 10;
                }
                
                /* Cup */
                .cup-container {
                    position: absolute;
                    bottom: calc(50% + 10px);
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 20;
                }
                
                .cup {
                    width: 80px;
                    height: 120px;
                    position: relative;
                    transform-origin: bottom center;
                    transition: transform 0.15s ease-out;
                }
                
                .cup.flipping {
                    animation: cupFlip 0.4s ease-out forwards;
                }
                
                .cup.flipped {
                    transform: rotate(180deg);
                }
                
                .cup.failed {
                    animation: cupFail 0.5s ease-out;
                }
                
                @keyframes cupFlip {
                    0% { transform: rotate(0deg); }
                    50% { transform: rotate(100deg) translateY(-30px); }
                    100% { transform: rotate(180deg) translateY(0); }
                }
                
                @keyframes cupFail {
                    0% { transform: rotate(0deg); }
                    30% { transform: rotate(60deg) translateY(-20px); }
                    100% { transform: rotate(0deg) translateY(0); }
                }
                
                .cup-body {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #ff6b9d 0%, #ff3366 50%, #cc0044 100%);
                    clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
                    border-radius: 0 0 10px 10px;
                    box-shadow: 
                        inset -5px 0 15px rgba(0, 0, 0, 0.3),
                        0 0 30px rgba(255, 51, 102, 0.5);
                }
                
                .cup-liquid {
                    position: absolute;
                    bottom: 10%;
                    left: 15%;
                    right: 15%;
                    height: 60%;
                    background: linear-gradient(180deg, #ffcc00 0%, #ff9900 100%);
                    border-radius: 0 0 5px 5px;
                    opacity: 0.9;
                }
                
                .cup.flipped .cup-liquid {
                    display: none;
                }
                
                /* Stats */
                .game-stats {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    right: 20px;
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
                    margin-bottom: 5px;
                }
                
                .stat-value {
                    font-size: 24px;
                    color: #00ffff;
                    text-shadow: 0 0 10px #00ffff;
                }
                
                .stat-value.bad {
                    color: #ff3366;
                    text-shadow: 0 0 10px #ff3366;
                }
                
                /* Timer bar */
                .timer-bar {
                    position: absolute;
                    bottom: 30%;
                    left: 10%;
                    right: 10%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    z-index: 30;
                }
                
                .timer-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #00ff88, #00ffff);
                    border-radius: 4px;
                    transition: width 0.1s linear;
                }
                
                .timer-fill.danger {
                    background: linear-gradient(90deg, #ff3366, #ff6b9d);
                }
                
                /* Instructions */
                .instructions {
                    position: absolute;
                    bottom: 15%;
                    font-size: 12px;
                    color: #ffff00;
                    text-shadow: 0 0 10px #ffff00;
                    animation: pulse 1s ease infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                /* Flip indicator */
                .flip-indicator {
                    position: absolute;
                    top: 40%;
                    font-size: 48px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    z-index: 40;
                }
                
                .flip-indicator.show {
                    opacity: 1;
                    animation: popIn 0.3s ease;
                }
                
                @keyframes popIn {
                    0% { transform: scale(0); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
                
                /* Success streak */
                .streak {
                    position: absolute;
                    top: 35%;
                    display: flex;
                    gap: 10px;
                }
                
                .streak-cup {
                    font-size: 24px;
                    opacity: 0.3;
                }
                
                .streak-cup.done {
                    opacity: 1;
                }
                
                /* Camera */
                .game-camera {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    width: 200px;
                    height: 150px;
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
            </style>
            
            <div class="grid-floor"></div>
            
            <div class="game-stats">
                <div class="stat">
                    <div class="stat-label">FLIPS</div>
                    <div class="stat-value" id="flip-count">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">FAILS</div>
                    <div class="stat-value" id="fail-count">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">TIME</div>
                    <div class="stat-value" id="time-display">30</div>
                </div>
            </div>
            
            <div class="streak" id="streak">
                <span class="streak-cup">🥤</span>
                <span class="streak-cup">🥤</span>
                <span class="streak-cup">🥤</span>
                <span class="streak-cup">🥤</span>
                <span class="streak-cup">🥤</span>
            </div>
            
            <div class="table"></div>
            
            <div class="cup-container">
                <div class="cup" id="cup">
                    <div class="cup-body"></div>
                    <div class="cup-liquid"></div>
                </div>
            </div>
            
            <div class="flip-indicator" id="flip-indicator">✓</div>
            
            <div class="timer-bar">
                <div class="timer-fill" id="timer-fill"></div>
            </div>
            
            <div class="instructions" id="instructions">
                👋 FLIP YOUR HAND TO FLIP THE CUP
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
        width: 640,
        height: 480
    });
    
    await camera.start();
}

function onPoseResults(results) {
    if (!results.poseLandmarks || gameState.phase !== 'running') return;
    
    // Track wrist position for flip detection
    const rightWrist = results.poseLandmarks[16];
    const leftWrist = results.poseLandmarks[15];
    
    // Use the more active hand
    const activeWrist = Math.abs(rightWrist.y - gameState.lastHandY) > 
                        Math.abs(leftWrist.y - gameState.lastHandY) 
                        ? rightWrist : leftWrist;
    
    gameState.lastHandY = gameState.handY;
    gameState.handY = activeWrist.y;
    
    // Calculate flip velocity (positive = hand moving down = flip motion)
    gameState.flipVelocity = gameState.handY - gameState.lastHandY;
    
    // Detect flip gesture
    if (gameState.flipVelocity > FLIP_THRESHOLD && gameState.cupState === 'upright') {
        attemptFlip();
    }
}

// === GAME LOGIC ===
function startRun(player) {
    gameState.phase = 'running';
    gameState.currentPlayer = player;
    gameState.cupState = 'upright';
    gameState.flipAttempts = 0;
    gameState.successfulFlips = 0;
    gameState.failedFlips = 0;
    gameState.startTime = Date.now();
    
    // Reset UI
    updateUI();
    
    // Start timer
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameState.phase !== 'running') return;
    
    const elapsed = Date.now() - gameState.startTime;
    const remaining = Math.max(0, MAX_TIME - elapsed);
    const progress = remaining / MAX_TIME;
    
    // Update timer
    document.getElementById('time-display').textContent = Math.ceil(remaining / 1000);
    document.getElementById('timer-fill').style.width = `${progress * 100}%`;
    
    if (progress < 0.3) {
        document.getElementById('timer-fill').classList.add('danger');
    }
    
    // Check for time up
    if (remaining <= 0) {
        endRun('timeout');
        return;
    }
    
    // Check for win (5 successful flips)
    if (gameState.successfulFlips >= 5) {
        endRun('success');
        return;
    }
    
    requestAnimationFrame(gameLoop);
}

function attemptFlip() {
    if (gameState.cupState !== 'upright') return;
    
    gameState.flipAttempts++;
    gameState.cupState = 'flipping';
    
    const cup = document.getElementById('cup');
    cup.classList.add('flipping');
    
    // Random success based on flip velocity (better flip = higher chance)
    // Base 60% chance, up to 90% with perfect flip
    const velocityBonus = Math.min(gameState.flipVelocity / 0.3, 1) * 0.3;
    const successChance = 0.6 + velocityBonus;
    const success = Math.random() < successChance;
    
    setTimeout(() => {
        cup.classList.remove('flipping');
        
        if (success) {
            // Successful flip!
            gameState.successfulFlips++;
            gameState.cupState = 'flipped';
            cup.classList.add('flipped');
            
            showIndicator('✓', '#00ff88');
            updateStreak();
            
            // Reset for next flip after delay
            setTimeout(() => {
                cup.classList.remove('flipped');
                gameState.cupState = 'upright';
            }, 500);
        } else {
            // Failed flip
            gameState.failedFlips++;
            gameState.cupState = 'upright';
            cup.classList.add('failed');
            
            showIndicator('✗', '#ff3366');
            
            setTimeout(() => {
                cup.classList.remove('failed');
            }, 500);
        }
        
        updateUI();
    }, 400);
}

function endRun(reason) {
    gameState.phase = 'ended';
    
    const score = gameState.successfulFlips * 10 - gameState.failedFlips * 5;
    const result = {
        score: Math.max(0, score),
        flips: gameState.successfulFlips,
        fails: gameState.failedFlips,
        time: Date.now() - gameState.startTime,
        reason: reason,
        failed: gameState.successfulFlips < 5,
        disastrous: gameState.failedFlips >= DRINK_THRESHOLDS.disaster
    };
    
    gameState.roundScores.push(result);
    
    // Notify ceremony engine
    ceremony.completeRun(result);
}

function calculatePenalty(result) {
    if (result.fails >= DRINK_THRESHOLDS.disaster) {
        return { drinks: 1, type: 'bottoms_up' };
    } else if (result.fails >= DRINK_THRESHOLDS.bad) {
        return { drinks: 2, type: 'sips' };
    } else if (result.fails >= DRINK_THRESHOLDS.ok) {
        return { drinks: 1, type: 'sip' };
    }
    return { drinks: 0, type: 'none' };
}

// === UI HELPERS ===
function updateUI() {
    document.getElementById('flip-count').textContent = gameState.successfulFlips;
    document.getElementById('fail-count').textContent = gameState.failedFlips;
    
    if (gameState.failedFlips >= 3) {
        document.getElementById('fail-count').classList.add('bad');
    }
}

function updateStreak() {
    const cups = document.querySelectorAll('.streak-cup');
    cups.forEach((cup, i) => {
        if (i < gameState.successfulFlips) {
            cup.classList.add('done');
        }
    });
}

function showIndicator(text, color) {
    const indicator = document.getElementById('flip-indicator');
    indicator.textContent = text;
    indicator.style.color = color;
    indicator.style.textShadow = `0 0 20px ${color}`;
    indicator.classList.add('show');
    
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 500);
}

// === CLEANUP ===
export function destroy() {
    if (camera) camera.stop();
    gameState.phase = 'destroyed';
}
