# STEER CLEAR - Game Design Document

## Overview

**Concept:** Drunk driving obstacle dodger. Steer to avoid obstacles, don't crash, pass the wheel when you fail.

**Vibe:** Neon night driving, arcade racer aesthetic, tense hot-seat chaos

**Players:** 2-8 (hot seat rotation)

**Detection:** MediaPipe Pose - steering wheel pose with tilt detection

---

## Core Gameplay

### The Setup
- Player holds invisible steering wheel (hands up, shoulder-width apart)
- 3-lane road scrolling toward camera
- Player's car at bottom of screen

### The Challenge
- Obstacles spawn and scroll down the road
- Player steers LEFT/RIGHT to change lanes and dodge
- VROOM = stay in current lane (no obstacles in path)
- Speed increases as chain builds

### The Rotation
- Crash = you're out, next player takes the wheel
- Quick 3-second countdown between players
- Chain resets on crash, builds across successful dodges

---

## Visual Design

### Road & Environment
- 3 clearly defined lanes with lane markers
- Neon city skyline in background
- Night driving aesthetic - dark with glowing elements
- Road scrolls continuously (speed increases with chain)

### Player's Car
- Positioned at bottom center
- Visually moves between lanes when steering detected
- Headlights illuminate the road ahead
- Tilt animation when turning

### Obstacles
- **Traffic cones** (easy) - single lane block
- **Barriers** (medium) - spans 1-2 lanes
- **Other cars** (hard) - move between lanes
- **Drunk pedestrian** (chaos) - stumbles unpredictably

### UI Elements
- Current driver name (top left)
- Chain counter (top center) - glows brighter with higher chain
- Camera feed (bottom right, 30% width)
- Steering wheel overlay on camera showing detected pose

### Effects
- Lane change: tire screech visual, car tilts
- Near miss: sparks, "CLOSE!" popup, screen shake
- Crash: explosion effect, screen shake, car spins out
- High chain: road gets neon trails, more visual intensity

---

## Gesture Detection

### Steering Wheel Pose (Required to play)
- Both wrists above shoulder level
- Hands roughly shoulder-width apart
- This is the "ready" state

### Steer Left
- Left wrist higher than right wrist (wheel tilted counter-clockwise)
- Threshold: 0.08 difference in Y position
- Car moves to left lane

### Steer Right
- Right wrist higher than left wrist (wheel tilted clockwise)
- Threshold: 0.08 difference in Y position
- Car moves to right lane

### Center (VROOM)
- Both wrists at similar height
- Car stays in current lane

---

## Difficulty Progression

### Speed Tiers
| Chain | Road Speed | Obstacle Frequency |
|-------|------------|-------------------|
| 0-5   | Slow       | Every 2 seconds   |
| 6-15  | Medium     | Every 1.5 seconds |
| 16-30 | Fast       | Every 1 second    |
| 31+   | Insane     | Every 0.7 seconds |

### Chaos Mechanics (activate at higher chains)
- **Drunk Vision** (chain 10+): Screen wobbles slightly
- **Lane Drift** (chain 20+): Lanes visually shift
- **Blackout** (chain 30+): Brief screen flicker

---

## Demo Mode

### Purpose
Show players how the game works before they play

### Implementation
- AI "ghost" player demonstrates for 10 seconds
- Shows steering wheel pose overlay
- Shows car responding to steering
- Text callouts: "STEER LEFT TO DODGE" etc.
- Plays automatically on instructions screen or on-demand

---

## Drinking Rules

| Event | Penalty |
|-------|---------|
| Crash (any obstacle) | 1 drink |
| 3 crashes same player | 2 drinks + shame |
| Chain of 10+ | Nominate someone |
| Chain of 25+ | Everyone else drinks |

---

## Screen Flow

```
LANDING          →    INSTRUCTIONS    →    SETUP         →    GAME
"STEER CLEAR"         Demo plays           Enter names        Gameplay
"don't crash"         Visual how-to        2-8 players        Hot seat
[PLAY]                [GOT IT]             [START]            rotation
```

---

## Technical Notes

### Camera FOV
- Request wider FOV if available via MediaPipe constraints
- Ensure full upper body visible for steering detection

### Performance
- Road scroll via CSS animation (GPU accelerated)
- Obstacles as simple divs with transform animations
- Car movement via CSS transitions

### Assets Needed
- Car sprite (top-down or angled view)
- Obstacle sprites (cones, barriers, cars)
- City skyline background
- Neon glow effects (CSS)

---

## File Location
`/Users/jayfrancis/claude-test/steer-clear/index.html`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | Jan 2025 | Initial build - basic command matching |
| v0.2 | TBD | Rebuild with proper visuals, obstacles, demo mode |

---

*Reference GAME_DESIGN_PRINCIPLES.md for universal standards*
