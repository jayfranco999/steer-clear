# STEER CLEAR - Game Context & Design

## Live URL
**https://jayfranco999.github.io/steer-clear/**

GitHub: https://github.com/jayfranco999/steer-clear

---

## Current State (v1.0 - Jan 2025)

### What's Working
- Full gesture-controlled driving game
- MediaPipe Pose detection for steering wheel motion
- 3-lane road with perspective obstacles
- Hot-seat multiplayer (2-8 players)
- Calibration test drive (once per player per game)
- Gradual speed progression (CHILL → SMOOTH → CRUISING → FAST → INTENSE)
- Drinking rules integrated with center pop-up cues
- Clean unified visual aesthetic (landing + game)

### Core Mechanics
- **Steering**: Hold invisible wheel, tilt left/right to change lanes
- **Tilt threshold**: 0.12 (requires deliberate swerve, not twitchy)
- **3 crashes = out**: Player eliminated, next player takes wheel
- **Chain system**: Dodge streaks build chain, triggers speed increases

### Speed Progression (Current)
| Chain | Speed | Status |
|-------|-------|--------|
| 0-5 | 0.6x | CHILL |
| 6-10 | 0.8x | WARMING UP |
| 11-15 | 1.0x | SMOOTH |
| 16-25 | 1.2x | CRUISING |
| 26-35 | 1.5x | FAST |
| 36+ | 1.8x | INTENSE |

### Drinking Rules (In-Game)
- Crash = 1 sip
- 3 crashes (you're out) = BOTTOMS UP
- Chain of 10 = Pick someone to drink
- Chain of 25 = Pick 2 people
- Most crashes at end = BOTTOMS UP

---

## CHAOS LAYERS (TODO - Future Iterations)

### Layer 1: Visual Chaos (Chain 15+)
Add screen effects as chain builds to disorient player:
- **Drunk Vision**: Subtle screen wobble/sway
- **Tunnel Vision**: Vignette edges darken
- **Neon Overload**: Colors intensify, bloom effects
- **Screen Tilt**: Slight rotation of game view

Implementation:
```css
.drunk-vision { animation: wobble 2s ease-in-out infinite; }
.tunnel-vision { box-shadow: inset 0 0 150px rgba(0,0,0,0.8); }
```

### Layer 2: Obstacle Variety
Add new obstacle types beyond basic cars:
- **Wide Trucks**: Span 2 lanes, force specific dodge direction
- **Swerving Cars**: Move between lanes as they approach
- **Motorcycles**: Faster, smaller, harder to track
- **Broken Down Car**: Stationary, appears suddenly

Implementation: Add `obstacle.wide`, `obstacle.swerving` classes with different behaviors in animateObstacle()

### Layer 3: Hype Messages
Flash encouraging/taunting messages at milestones:
- Chain 5: "NOT BAD"
- Chain 10: "GETTING SPICY"
- Chain 15: "UNKILLABLE"
- Chain 20: "JESUS TAKE THE WHEEL"
- Chain 30: "ARE YOU EVEN HUMAN?"
- Chain 40: "LEGEND STATUS"

### Layer 4: Audio Cues (Optional)
- Engine revving that increases with speed
- Tire screech on lane change
- Crash sound effect
- Crowd cheering at high chains

### Layer 5: Power-ups (Maybe Later)
- **Shield**: Survive one crash
- **Slow-Mo**: Temporary speed reduction
- **Lane Lock**: Obstacles only spawn in other lanes briefly

---

## Technical Reference

### Key Files
- `index.html` - Complete game (single file)
- `drinking_rules.md` - Printable drinking rules
- `CONTEXT.md` - This file

### Steering Detection (detectSteering function)
```javascript
const tilt = leftWrist.y - rightWrist.y;
// Higher threshold = needs more deliberate swerve
if (tilt > 0.12) {
    state.steeringPose = 'left';
} else if (tilt < -0.12) {
    state.steeringPose = 'right';
} else {
    state.steeringPose = 'center';
}
```

### Lane Positions
```css
.player-car.lane-0 { left: 8%; }
.player-car.lane-1 { left: 41%; }
.player-car.lane-2 { left: 74%; }

.obstacle.lane-0 { left: 10%; }
.obstacle.lane-1 { left: 43%; }
.obstacle.lane-2 { left: 76%; }
```

### State Object
```javascript
const state = {
    players: [],
    currentPlayerIndex: 0,
    chain: 0,
    bestChain: 0,
    crashes: {},        // { playerName: crashCount }
    calibrated: {},     // { playerName: true/false }
    currentLane: 1,     // 0=left, 1=center, 2=right
    obstacles: [],
    obstacleId: 0,
    roundActive: false,
    calibrationActive: false,
    gameSpeed: 1,
    steeringPose: null, // 'left', 'right', 'center', null
    lastSteer: 'center',
    nearMissShown: {},
    obstacleCount: 0,
    warmupActive: false
};
```

### Key Functions
- `runCalibration()` - Test drive sequence (left → right → center)
- `runCountdown()` - "BUCKLE UP" → "HANDS ON WHEEL" → "DON'T CRASH" → "GO!"
- `spawnLoop()` - Creates obstacles at intervals based on gameSpeed
- `animateObstacle(id)` - Moves obstacle down screen, checks collision
- `updateDifficulty()` - Adjusts speed based on chain count
- `crash()` - Handles crash, drink cue, player rotation
- `nextPlayer()` - Rotates to next player, calibrates if needed

### Spawn & Animation Timing
```javascript
// Spawn delay (longer = more time between cars)
const delay = Math.max(1200, 2800 / state.gameSpeed);

// Obstacle movement speed (lower = slower approach)
obs.progress += 1.0 * state.gameSpeed;
```

---

## Design Decisions Made

1. **Steering threshold 0.12** - Prevents accidental lane changes, requires real swerve
2. **Calibration once per player** - Not every round, reduces tedium
3. **Slow start (0.6x)** - Players can breathe and ease into game
4. **Road fills screen** - No wasted UI space, road dominates view
5. **Center drink pop-ups** - More visible than side slides, can't miss them
6. **Unified color scheme** - Dark purple/cyan/magenta throughout landing and game

---

## What NOT to Do
- Don't make steering too sensitive (was 0.06, now 0.12)
- Don't spawn first obstacle immediately after GO
- Don't run calibration every round (only first time per player)
- Don't block gameplay with drink notifications (centered but brief)
- Don't waste screen space with static elements

---

## To Continue Development
1. Read this file for context
2. Open `index.html` to see current implementation
3. Implement chaos layers in order (visual effects → obstacle variety → hype messages)
4. Test each layer before adding next
5. Push changes: `git add -A && git commit -m "message" && git push`

---

*Last updated: Jan 2025*
