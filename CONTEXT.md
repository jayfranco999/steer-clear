# STEER CLEAR - Game Context & Design

## Live URL
**https://jayfranco999.github.io/steer-clear/**

GitHub: https://github.com/jayfranco999/steer-clear

---

## Current State (v2.0 - Jan 2025)

### What's Working
- Full gesture-controlled driving game
- MediaPipe Pose detection for steering wheel motion
- 3-lane road with perspective obstacles
- Hot-seat multiplayer (2-8 players)
- Calibration test drive (once per player per game)
- Progressive speed (2% per dodge, caps at 1.8x)
- **5 chaos mechanics** (REVERSED, LIGHTS OUT, DRUNK DRIVER, CONVOY, WIDE LOAD)
- **Visual chaos effects** (drunk vision, tunnel vision, neon overload at high chains)
- **Hype messages** at milestones
- Drinking rules integrated with center pop-up cues
- Clean unified visual aesthetic (landing + game)
- Camera capture 1280x720 (wide FOV)
- Camera preview 320x180 with object-fit: contain

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
- 2 crashes (you're out) = BOTTOMS UP
- Chain of 10 = Pick someone to drink
- Chain of 25 = Pick 2 people
- Most crashes at end = BOTTOMS UP

---

## CHAOS MECHANICS (IMPLEMENTED)

### Chaos Modes (triggers every 3rd dodge after warmup)
| Mode | Chance | Effect |
|------|--------|--------|
| REVERSED | 20% | Controls flip for 5 dodges. HUGE persistent popup stays centered. |
| POTHOLE | 15% | Violent screen shake + car spawns right after. |
| DRUNK DRIVER | 20% | Car swerves between lanes. Spawns in YOUR lane with taunting messages. |
| CONVOY | 25% | 3 cars spawn rapid-fire (400ms apart). |
| WIDE LOAD | 20% | Truck spans 2 lanes, only one escape route. |

### Visual Chaos (progressive)
| Chain | Effect |
|-------|--------|
| 15+ | Drunk Vision - subtle screen wobble |
| 25+ | Tunnel Vision - edges darken |
| 35+ | Neon Overload - colors intensify |

### Hype Messages
- Chain 5: "NOT BAD"
- Chain 10: "GETTING SPICY"
- Chain 15: "UNKILLABLE"
- Chain 20: "JESUS TAKE THE WHEEL"
- Chain 30: "ARE YOU EVEN HUMAN?"
- Chain 40: "LEGEND STATUS"
- Chain 50: "LITERALLY IMPOSSIBLE"

### Speed Progression
- Starts at 0.7x, increases 2% per dodge
- Caps at 1.8x (reached around chain 55)
- Resets per player

### Future Additions (Maybe)
- **Audio cues**: Engine revving, tire screech, crash sounds
- **Power-ups**: Shield (survive crash), Slow-Mo, Lane Lock

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

## Session Log

### v1.0 - Initial Build (Jan 2025)
- Full game implementation
- Steering detection with threshold 0.12
- Speed progression system
- Drinking rules with center popups

### v1.1 - Design Principles Polish (Jan 2025)
- **Camera capture**: 640x480 → 1280x720 (wider FOV)
- **Camera preview**: 240x170 → 320x180 (16:9 ratio)
- **object-fit**: cover → contain (proper aspect ratio)

### v2.0 - CHAOS UPDATE (Jan 2025)
- **Removed time-based warmup** - chaos starts after 2 dodges
- **Progressive speed** - 2% per dodge, starts at 0.7x, caps at 1.8x
- **5 chaos mechanics**:
  - REVERSED (20%) - controls flip for 5 dodges
  - LIGHTS OUT (15%) - road goes dark for 3 dodges
  - DRUNK DRIVER (20%) - car swerves between lanes
  - CONVOY (25%) - 3 cars rapid-fire
  - WIDE LOAD (20%) - truck spans 2 lanes
- **Visual chaos effects** at high chains:
  - 15+: drunk vision (subtle wobble)
  - 25+: tunnel vision (edges darken)
  - 35+: neon overload (colors intensify)
- **Hype messages** at milestones (5, 10, 15, 20, 30, 40, 50)

### v2.1 - Feedback Polish (Jan 2025)
- **REVERSED indicator** - Now a HUGE centered popup that stays until it clears
- **LIGHTS OUT → POTHOLE** - Replaced with violent screen shake + car spawn (fairer)
- **2 lives** - Changed from 3 crashes to 2 crashes per player
- **DRUNK DRIVER taunts** - Random taunting messages ("MOVE. NOW.", "get out the way", etc.)
- **DRUNK DRIVER spawns in YOUR lane** - Forces you to move

---

*Last updated: Jan 2025 - v2.1 Feedback Polish*
