/**
 * GOALKEEPER - Ceremony Box Edition
 * 
 * Motion-tracked goalkeeper game. Reach to save.
 * 4-zone coverage: reach up+left, up+right, out-left, out-right.
 * 
 * Integrated with Ceremony Engine for dramatic reveals.
 */

import { PHASES } from '../../shared/ceremony-engine.js';

// Game constants
const EXTENSION_THRESHOLD = 0.15;
const SHOT_DELAY_BASE = 2000;
const SHOT_DELAY_MIN = 800;
const BALL_TRAVEL_TIME = 800;
const REACTION_WINDOW = 500;
const SPEED_INCREMENT = 0.02;
const MAX_GOALS = 3;

const DRINK_THRESHOLDS = {
    disaster: 1,
    bad: 3,
    ok: 4,
    good: 5
};

const ZONES = {
    TOP_LEFT: { name: 'TOP LEFT', color: '#ff3366', icon: '↖️' },
    TOP_RIGHT: { name: 'TOP RIGHT', color: '#00ffff', icon: '↗️' },
    BOTTOM_LEFT: { name: 'BOTTOM LEFT', color: '#ffcc00', icon: '↙️' },
    BOTTOM_RIGHT: { name: 'BOTTOM RIGHT', color: '#00ff88', icon: '↘️' }
};

const CHAOS_MODES = {
    REVERSED: { name: 'REVERSED', chance: 0.20, duration: 3, icon: '🔄' },
    BLIND: { name: 'BLIND', chance: 0.15, duration: 1, icon: '🙈' },
    FAKEOUT: { name: 'FAKEOUT', chance: 0.25, duration: 1, icon: '🎭' },
    PRESSURE: { name: 'PRESSURE', chance: 0.30, duration: 1, icon: '💥' }
};

const SAVE_COMMENTS = [
    "WHAT A SAVE!",
    "CAT-LIKE REFLEXES!",
    "THE WALL STANDS!",
    "DENIED!",
    "NOT TODAY!",
    "BEAUTIFUL STOP!"
];

const GOAL_COMMENTS = [
    "ABSOLUTE HOWLER!",
    "THE WALL HAS CRUMBLED",
    "THEY'VE DONE YOU DIRTY",
    "THAT'S EMBARRASSING",
    "WRONG WAY, MATE",
    "TOO SLOW!"
];

let container = null;
let ceremony = null;
let sync = null;
let pose = null;
let camera = null;
let shotTimeout = null;

const gameState = {
    phase: 'waiting',
    currentPlayer: null,
    currentZone: null,
    targetZone: null,
    saves: 0,
    goals: 0,
    shotCount: 0,
    gameSpeed: 1.0,
    chaosMode: null,
    chaosRemaining: 0,
    reversed: false,
    fakeoutZone: null,
    roundScores: []
};

export async function init(containerEl, options) {
    container = containerEl;
    ceremony = options.ceremony;
    sync = options.sync;
    
    render();
    
    ceremony.registerGame({
        onRunStart: startRun,
        isGameOver: () => gameState.roundScores.length >= options.players.length,
        calculatePenalty: calculatePenalty
    });
    
    await initPose();
}

function render() {
    container.innerHTML = \`
        <div class="goalkeeper-game">
            <style>
                .goalkeeper-game {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, #001a00 0%, #002200 30%, #003300 60%, #001a00 100%);
                    position: relative;
                    overflow: hidden;
                    font-family: 'Press Start 2P', monospace;
                }
                
                .stadium-bg {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 40%;
                    background: 
                        radial-gradient(ellipse at 50% 100%, rgba(0, 255, 0, 0.1) 0%, transparent 60%),
                        linear-gradient(180deg, #001100 0%, #002200 100%);
                }
                
                .crowd {
                    position: absolute;
                    top: 5%; left: 0; right: 0; height: 15%;
                    background: 
                        repeating-linear-gradient(
                            90deg,
                            transparent 0px,
                            transparent 20px,
                            rgba(0, 0, 0, 0.6) 20px,
                            rgba(0, 0, 0, 0.6) 25px
                        );
                    filter: blur(2px);
                    opacity: 0.5;
                }
                
                .goal-frame {
                    position: absolute;
                    top: 20%; left: 10%; right: 10%; height: 55%;
                    border: 8px solid #ffffff;
                    border-bottom: none;
                    box-shadow: 
                        0 0 30px rgba(255, 255, 255, 0.3),
                        inset 0 0 50px rgba(0, 0, 0, 0.5);
                }
                
                .goal-net {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-image:
                        linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
                    background-size: 30px 30px;
                }
                
                .zones {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: 1fr 1fr;
                    gap: 4px;
                    padding: 4px;
                }
                
                .zone {
                    border: 3px solid rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    color: rgba(255, 255, 255, 0.3);
                    transition: all 0.15s ease;
                }
                
                .zone.active {
                    background: rgba(0, 255, 0, 0.3);
                    border-color: #00ff00;
                    box-shadow: inset 0 0 30px rgba(0, 255, 0, 0.5);
                }
                
                .zone.target {
                    border-color: #ff3366;
                    animation: zonePulse 0.3s ease infinite;
                }
                
                @keyframes zonePulse {
                    0%, 100% { box-shadow: inset 0 0 20px rgba(255, 51, 102, 0.5); }
                    50% { box-shadow: inset 0 0 40px rgba(255, 51, 102, 0.8); }
                }
                
                .zone.hit {
                    background: rgba(255, 51, 102, 0.6);
                    animation: zoneHit 0.5s ease;
                }
                
                .zone.saved {
                    background: rgba(0, 255, 0, 0.6);
                    animation: zoneSaved 0.5s ease;
                }
                
                @keyframes zoneHit {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                
                @keyframes zoneSaved {
                    0% { transform: scale(1); }
                    50% { transform: scale(0.95); }
                    100% { transform: scale(1); }
                }
                
                .zone#TOP_LEFT { border-radius: 8px 0 0 0; }
                .zone#TOP_RIGHT { border-radius: 0 8px 0 0; }
                .zone#BOTTOM_LEFT { border-radius: 0 0 0 8px; }
                .zone#BOTTOM_RIGHT { border-radius: 0 0 8px 0; }
                
                .ball {
                    position: absolute;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: 
                        radial-gradient(circle at 30% 30%, #ffffff 0%, #cccccc 50%, #999999 100%);
                    box-shadow: 
                        0 0 20px rgba(255, 255, 255, 0.5),
                        inset -5px -5px 15px rgba(0, 0, 0, 0.3);
                    opacity: 0;
                    z-index: 20;
                    transition: none;
                }
                
                .ball::before {
                    content: '';
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 80%;
                    height: 80%;
                    border: 2px solid rgba(0, 0, 0, 0.2);
                    border-radius: 50%;
                }
                
                .ball.flying {
                    opacity: 1;
                    animation: ballFly var(--travel-time, 800ms) ease-out forwards;
                }
                
                @keyframes ballFly {
                    0% { transform: scale(0.3) rotate(0deg); }
                    100% { transform: scale(1.2) rotate(720deg); }
                }
                
                .grass {
                    position: absolute;
                    bottom: 0; left: 0; right: 0; height: 25%;
                    background: linear-gradient(180deg, #004400 0%, #003300 100%);
                }
                
                .grass-lines {
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 100%;
                    background: repeating-linear-gradient(
                        90deg,
                        transparent 0px,
                        transparent 40px,
                        rgba(0, 80, 0, 0.3) 40px,
                        rgba(0, 80, 0, 0.3) 80px
                    );
                }
                
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
                    color: #00ff88;
                    text-shadow: 0 0 10px #00ff88;
                }
                
                .stat-value.bad { color: #ff3366; text-shadow: 0 0 10px #ff3366; }
                
                .chaos-indicator {
                    position: absolute;
                    top: 70px; left: 50%;
                    transform: translateX(-50%);
                    padding: 10px 25px;
                    background: rgba(255, 0, 0, 0.2);
                    border: 2px solid #ff3366;
                    font-size: 12px;
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
                
                .commentary {
                    position: absolute;
                    bottom: 30%; left: 50%;
                    transform: translateX(-50%);
                    font-size: 18px;
                    text-shadow: 0 0 20px currentColor;
                    z-index: 40;
                    opacity: 0;
                    white-space: nowrap;
                }
                
                .commentary.show {
                    animation: commentaryIn 1.5s ease forwards;
                }
                
                .commentary.save { color: #00ff88; }
                .commentary.goal { color: #ff3366; }
                
                @keyframes commentaryIn {
                    0% { opacity: 0; transform: translateX(-50%) scale(0.5); }
                    20% { opacity: 1; transform: translateX(-50%) scale(1.1); }
                    80% { opacity: 1; transform: translateX(-50%) scale(1); }
                    100% { opacity: 0; transform: translateX(-50%) scale(1); }
                }
                
                .zone-indicator {
                    position: absolute;
                    bottom: 28%; left: 50%;
                    transform: translateX(-50%);
                    padding: 8px 20px;
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 8px;
                    font-size: 12px;
                    color: #00ffff;
                    z-index: 30;
                }
                
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
            </style>
            
            <div class="stadium-bg">
                <div class="crowd"></div>
            </div>
            
            <div class="goal-frame">
                <div class="goal-net"></div>
                <div class="zones">
                    <div class="zone" id="TOP_LEFT">↖️</div>
                    <div class="zone" id="TOP_RIGHT">↗️</div>
                    <div class="zone" id="BOTTOM_LEFT">↙️</div>
                    <div class="zone" id="BOTTOM_RIGHT">↘️</div>
                </div>
            </div>
            
            <div class="ball" id="ball"></div>
            
            <div class="grass">
                <div class="grass-lines"></div>
            </div>
            
            <div class="game-stats">
                <div class="stat">
                    <div class="stat-label">SAVES</div>
                    <div class="stat-value" id="save-count">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">SHOTS</div>
                    <div class="stat-value" id="shot-count">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">GOALS</div>
                    <div class="stat-value" id="goal-count">0</div>
                </div>
            </div>
            
            <div class="chaos-indicator" id="chaos-indicator"></div>
            <div class="commentary" id="commentary"></div>
            <div class="zone-indicator" id="zone-indicator">COVERING: CENTER</div>
            
            <div class="game-camera">
                <video id="game-webcam" autoplay playsinline></video>
            </div>
        </div>
    \`;
}

async function initPose() {
    const video = document.getElementById('game-webcam');
    
    pose = new Pose({
        locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/pose/\${file}\`
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
    
    const leftShoulder = results.poseLandmarks[11];
    const rightShoulder = results.poseLandmarks[12];
    const leftWrist = results.poseLandmarks[15];
    const rightWrist = results.poseLandmarks[16];
    
    const centerX = (leftShoulder.x + rightShoulder.x) / 2;
    const centerY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    
    let detectedZone = null;
    
    const leftExtX = centerX - leftWrist.x;
    const leftExtY = centerY - leftWrist.y;
    const rightExtX = rightWrist.x - centerX;
    const rightExtY = centerY - rightWrist.y;
    
    const leftExt = Math.sqrt(leftExtX * leftExtX + leftExtY * leftExtY);
    const rightExt = Math.sqrt(rightExtX * rightExtX + rightExtY * rightExtY);
    
    const useLeft = leftExt > rightExt;
    const extX = useLeft ? leftExtX : rightExtX;
    const extY = useLeft ? leftExtY : rightExtY;
    const extension = useLeft ? leftExt : rightExt;
    
    if (extension > shoulderWidth * EXTENSION_THRESHOLD * 5) {
        const isHigh = extY > 0.1;
        const isLeft = useLeft ? (leftWrist.x < centerX) : (rightWrist.x < centerX);
        
        const effectiveLeft = gameState.reversed ? !isLeft : isLeft;
        
        if (isHigh && effectiveLeft) {
            detectedZone = 'TOP_LEFT';
        } else if (isHigh && !effectiveLeft) {
            detectedZone = 'TOP_RIGHT';
        } else if (!isHigh && effectiveLeft) {
            detectedZone = 'BOTTOM_LEFT';
        } else {
            detectedZone = 'BOTTOM_RIGHT';
        }
    }
    
    if (detectedZone !== gameState.currentZone) {
        gameState.currentZone = detectedZone;
        updateZoneDisplay();
    }
}

function updateZoneDisplay() {
    Object.keys(ZONES).forEach(zone => {
        document.getElementById(zone).classList.remove('active');
    });
    
    if (gameState.currentZone) {
        document.getElementById(gameState.currentZone).classList.add('active');
        document.getElementById('zone-indicator').textContent = 
            \`COVERING: \${ZONES[gameState.currentZone].name}\`;
    } else {
        document.getElementById('zone-indicator').textContent = 'COVERING: CENTER';
    }
}

function startRun(player) {
    gameState.phase = 'running';
    gameState.currentPlayer = player;
    gameState.currentZone = null;
    gameState.targetZone = null;
    gameState.saves = 0;
    gameState.goals = 0;
    gameState.shotCount = 0;
    gameState.gameSpeed = 1.0;
    gameState.chaosMode = null;
    gameState.chaosRemaining = 0;
    gameState.reversed = false;
    gameState.fakeoutZone = null;
    
    updateUI();
    updateZoneDisplay();
    
    scheduleShot();
}

function scheduleShot() {
    if (gameState.phase !== 'running') return;
    
    const delay = Math.max(SHOT_DELAY_MIN, SHOT_DELAY_BASE / gameState.gameSpeed);
    
    shotTimeout = setTimeout(() => {
        takeShot();
    }, delay);
}

function takeShot() {
    if (gameState.phase !== 'running') return;
    
    gameState.shotCount++;
    
    if (gameState.shotCount >= 2 && gameState.shotCount % 2 === 0) {
        triggerChaos();
    }
    
    const zoneKeys = Object.keys(ZONES);
    let targetZone = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
    
    if (gameState.chaosMode === 'FAKEOUT') {
        gameState.fakeoutZone = targetZone;
        const otherZones = zoneKeys.filter(z => z !== targetZone);
        const fakeZone = otherZones[Math.floor(Math.random() * otherZones.length)];
        showTargetZone(fakeZone);
        
        setTimeout(() => {
            showTargetZone(targetZone);
            fireBall(targetZone);
        }, 300);
    } else if (gameState.chaosMode === 'BLIND') {
        showTargetZone(targetZone);
        setTimeout(() => hideTargetZone(), 250);
        setTimeout(() => fireBall(targetZone), 400);
    } else if (gameState.chaosMode === 'PRESSURE') {
        showTargetZone(targetZone);
        setTimeout(() => {
            fireBall(targetZone);
            setTimeout(() => {
                const zone2 = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
                showTargetZone(zone2);
                setTimeout(() => fireBall(zone2), 200);
            }, 200);
        }, 100);
        return;
    } else {
        showTargetZone(targetZone);
        setTimeout(() => fireBall(targetZone), 500);
    }
}

function showTargetZone(zone) {
    gameState.targetZone = zone;
    
    Object.keys(ZONES).forEach(z => {
        document.getElementById(z).classList.remove('target');
    });
    
    document.getElementById(zone).classList.add('target');
}

function hideTargetZone() {
    Object.keys(ZONES).forEach(z => {
        document.getElementById(z).classList.remove('target');
    });
}

function fireBall(targetZone) {
    const ball = document.getElementById('ball');
    const goalFrame = document.querySelector('.goal-frame');
    const zoneEl = document.getElementById(targetZone);
    
    const frameRect = goalFrame.getBoundingClientRect();
    const zoneRect = zoneEl.getBoundingClientRect();
    
    const startX = window.innerWidth / 2 - 30;
    const startY = window.innerHeight - 100;
    
    const endX = zoneRect.left + zoneRect.width / 2 - 30;
    const endY = zoneRect.top + zoneRect.height / 2 - 30;
    
    const travelTime = Math.max(400, BALL_TRAVEL_TIME / gameState.gameSpeed);
    ball.style.setProperty('--travel-time', \`\${travelTime}ms\`);
    ball.style.left = \`\${startX}px\`;
    ball.style.top = \`\${startY}px\`;
    ball.classList.remove('flying');
    void ball.offsetWidth;
    
    ball.style.left = \`\${endX}px\`;
    ball.style.top = \`\${endY}px\`;
    ball.classList.add('flying');
    
    setTimeout(() => {
        checkSave(targetZone);
    }, travelTime);
}

function checkSave(targetZone) {
    const ball = document.getElementById('ball');
    const zoneEl = document.getElementById(targetZone);
    
    hideTargetZone();
    
    const saved = gameState.currentZone === targetZone;
    
    if (saved) {
        gameState.saves++;
        zoneEl.classList.add('saved');
        showCommentary(SAVE_COMMENTS[Math.floor(Math.random() * SAVE_COMMENTS.length)], 'save');
    } else {
        gameState.goals++;
        zoneEl.classList.add('hit');
        showCommentary(GOAL_COMMENTS[Math.floor(Math.random() * GOAL_COMMENTS.length)], 'goal');
    }
    
    setTimeout(() => {
        ball.classList.remove('flying');
        ball.style.opacity = '0';
    }, 200);
    
    setTimeout(() => {
        zoneEl.classList.remove('saved', 'hit');
    }, 500);
    
    gameState.gameSpeed = Math.min(1.5, gameState.gameSpeed + SPEED_INCREMENT);
    
    if (gameState.chaosRemaining > 0) {
        gameState.chaosRemaining--;
        if (gameState.chaosRemaining <= 0) {
            endChaos();
        }
    }
    
    updateUI();
    
    if (gameState.goals >= MAX_GOALS) {
        endRun('conceded');
    } else {
        scheduleShot();
    }
}

function showCommentary(text, type) {
    const el = document.getElementById('commentary');
    el.textContent = text;
    el.className = 'commentary show ' + type;
    
    setTimeout(() => {
        el.classList.remove('show');
    }, 1500);
}

function triggerChaos() {
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [key, mode] of Object.entries(CHAOS_MODES)) {
        cumulative += mode.chance;
        if (rand <= cumulative) {
            gameState.chaosMode = key;
            gameState.chaosRemaining = mode.duration || 1;
            
            if (key === 'REVERSED') {
                gameState.reversed = true;
            }
            
            const indicator = document.getElementById('chaos-indicator');
            indicator.textContent = \`\${mode.icon} \${mode.name}\`;
            indicator.classList.add('active');
            
            return;
        }
    }
}

function endChaos() {
    gameState.chaosMode = null;
    gameState.chaosRemaining = 0;
    gameState.reversed = false;
    gameState.fakeoutZone = null;
    document.getElementById('chaos-indicator').classList.remove('active');
}

function endRun(reason) {
    gameState.phase = 'ended';
    
    if (shotTimeout) {
        clearTimeout(shotTimeout);
        shotTimeout = null;
    }
    
    const score = gameState.saves * 20;
    const result = {
        score,
        saves: gameState.saves,
        goals: gameState.goals,
        shots: gameState.shotCount,
        reason,
        failed: gameState.saves < DRINK_THRESHOLDS.ok,
        disastrous: gameState.saves <= DRINK_THRESHOLDS.disaster
    };
    
    gameState.roundScores.push(result);
    
    ceremony.completeRun(result);
}

function calculatePenalty(result) {
    if (result.saves <= DRINK_THRESHOLDS.disaster) {
        return { drinks: 1, type: 'bottoms_up' };
    } else if (result.saves <= DRINK_THRESHOLDS.bad) {
        return { drinks: 2, type: 'sips' };
    } else if (result.saves <= DRINK_THRESHOLDS.ok) {
        return { drinks: 1, type: 'sip' };
    }
    return { drinks: 0, type: 'pick_someone' };
}

function updateUI() {
    document.getElementById('save-count').textContent = gameState.saves;
    document.getElementById('shot-count').textContent = gameState.shotCount;
    document.getElementById('goal-count').textContent = gameState.goals;
    
    if (gameState.goals >= 2) {
        document.getElementById('goal-count').classList.add('bad');
    }
}

export function destroy() {
    if (camera) camera.stop();
    if (shotTimeout) clearTimeout(shotTimeout);
    gameState.phase = 'destroyed';
}
