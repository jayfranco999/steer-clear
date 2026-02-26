/**
 * CEREMONY ENGINE
 * 
 * The core insight: drinking games fail because drinking is a side effect.
 * Good drinking games make drinking THE CLIMAX.
 * 
 * Every round follows 4 phases:
 * 1. ARENA SETUP - Build anticipation, announce player, crowd locks in
 * 2. THE RUN - Actual gameplay, NO drinking cues, just tension building
 * 3. PUBLIC VERDICT - Dramatic reveal, rank players, spotlight the loser
 * 4. THE RITUAL - Countdown, crowd chant, theatrical drinking
 */

export const PHASES = {
  LOBBY: 'lobby',
  ARENA_SETUP: 'arena_setup',
  THE_RUN: 'the_run',
  PUBLIC_VERDICT: 'public_verdict',
  THE_RITUAL: 'the_ritual',
  FINAL_LEADERBOARD: 'final_leaderboard'
};

// Jackass-style announcements
const ARENA_ANNOUNCEMENTS = [
  "OH SHIT, HERE COMES",
  "EVERYONE SHUT UP FOR",
  "LOOK AT THIS ABSOLUTE LEGEND:",
  "PLACE YOUR BETS ON",
  "THIS COULD GET UGLY...",
  "BRACE YOURSELVES FOR",
  "THE CROWD GOES MILD FOR",
  "FRESH MEAT:",
];

const VERDICT_WINNER = [
  "UNTOUCHABLE",
  "ACTUALLY DISGUSTING HOW GOOD THAT WAS",
  "PICK YOUR VICTIM",
  "THE BAR HAS BEEN SET",
  "CERTIFIED MENACE",
];

const VERDICT_LOSER = [
  "ABSOLUTE DISASTER",
  "THAT WAS PAINFUL TO WATCH",
  "YOUR UBER IS HERE",
  "INSURANCE WON'T COVER THIS",
  "THE WALK OF SHAME AWAITS",
  "BOTTOMS UP, BUTTERCUP",
];

const RITUAL_CHANTS = [
  "DRINK! DRINK! DRINK!",
  "DOWN IT GOES!",
  "CHUG CHUG CHUG!",
  "NO MERCY!",
  "SEND IT!",
];

export class CeremonyEngine {
  constructor(options = {}) {
    this.phase = PHASES.LOBBY;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.roundResults = []; // { playerId, score, rank }
    this.onPhaseChange = options.onPhaseChange || (() => {});
    this.onAnnouncement = options.onAnnouncement || (() => {});
    this.gameCallbacks = {}; // Game-specific phase handlers
  }

  // Register game-specific callbacks
  registerGame(callbacks) {
    this.gameCallbacks = callbacks;
  }

  addPlayer(player) {
    this.players.push({
      ...player,
      score: 0,
      totalDrinks: 0,
      rounds: []
    });
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // === PHASE TRANSITIONS ===

  async startGame() {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players');
    }
    this.currentPlayerIndex = 0;
    await this.transitionTo(PHASES.ARENA_SETUP);
  }

  async transitionTo(phase, data = {}) {
    this.phase = phase;
    this.onPhaseChange(phase, data);

    switch (phase) {
      case PHASES.ARENA_SETUP:
        await this.runArenaSetup();
        break;
      case PHASES.THE_RUN:
        await this.runTheRun();
        break;
      case PHASES.PUBLIC_VERDICT:
        await this.runPublicVerdict(data);
        break;
      case PHASES.THE_RITUAL:
        await this.runTheRitual(data);
        break;
      case PHASES.FINAL_LEADERBOARD:
        await this.runFinalLeaderboard();
        break;
    }
  }

  // === PHASE 1: ARENA SETUP ===
  async runArenaSetup() {
    const player = this.getCurrentPlayer();
    const announcement = ARENA_ANNOUNCEMENTS[Math.floor(Math.random() * ARENA_ANNOUNCEMENTS.length)];
    
    // Dramatic pause, then announce
    await this.delay(500);
    this.onAnnouncement(announcement, 'buildup');
    await this.delay(1500);
    this.onAnnouncement(player.name, 'player_name');
    await this.delay(2000);
    
    // Countdown
    for (let i = 3; i > 0; i--) {
      this.onAnnouncement(String(i), 'countdown');
      await this.delay(1000);
    }
    this.onAnnouncement('GO!', 'go');
    await this.delay(500);
    
    // Hand off to game
    await this.transitionTo(PHASES.THE_RUN);
  }

  // === PHASE 2: THE RUN ===
  async runTheRun() {
    // Game takes over here - calls completeRun() when done
    if (this.gameCallbacks.onRunStart) {
      this.gameCallbacks.onRunStart(this.getCurrentPlayer());
    }
  }

  // Called by game when player's run is complete
  async completeRun(result) {
    const player = this.getCurrentPlayer();
    player.rounds.push(result);
    player.score += result.score || 0;
    
    this.roundResults.push({
      playerId: player.id,
      playerName: player.name,
      ...result
    });

    await this.transitionTo(PHASES.PUBLIC_VERDICT, { result });
  }

  // === PHASE 3: PUBLIC VERDICT ===
  async runPublicVerdict({ result }) {
    const player = this.getCurrentPlayer();
    
    await this.delay(500);
    
    // Dramatic score reveal
    this.onAnnouncement(`SCORE: ${result.score}`, 'score_reveal');
    await this.delay(2000);
    
    // Determine drinking penalty
    const penalty = this.calculatePenalty(result);
    
    if (penalty.drinks > 0) {
      const verdictLine = VERDICT_LOSER[Math.floor(Math.random() * VERDICT_LOSER.length)];
      this.onAnnouncement(verdictLine, 'verdict_loser');
      await this.delay(1500);
      await this.transitionTo(PHASES.THE_RITUAL, { penalty, player });
    } else {
      const verdictLine = VERDICT_WINNER[Math.floor(Math.random() * VERDICT_WINNER.length)];
      this.onAnnouncement(verdictLine, 'verdict_winner');
      await this.delay(2000);
      await this.nextPlayer();
    }
  }

  // Override this per game
  calculatePenalty(result) {
    // Default: bottom half drinks
    return {
      drinks: result.failed ? 1 : 0,
      type: result.disastrous ? 'bottoms_up' : 'sip'
    };
  }

  // === PHASE 4: THE RITUAL ===
  async runTheRitual({ penalty, player }) {
    const chant = RITUAL_CHANTS[Math.floor(Math.random() * RITUAL_CHANTS.length)];
    
    // Spotlight on the drinker
    this.onAnnouncement(`${player.name}...`, 'spotlight');
    await this.delay(1500);
    
    // Countdown to drink
    for (let i = 5; i > 0; i--) {
      this.onAnnouncement(String(i), 'ritual_countdown');
      await this.delay(800);
    }
    
    // THE MOMENT
    this.onAnnouncement(chant, 'drink_chant');
    player.totalDrinks += penalty.drinks;
    
    await this.delay(3000); // Let them drink
    
    await this.nextPlayer();
  }

  // === NAVIGATION ===
  async nextPlayer() {
    this.currentPlayerIndex++;
    
    if (this.currentPlayerIndex >= this.players.length) {
      // Round complete - check if game is over
      if (this.gameCallbacks.isGameOver && this.gameCallbacks.isGameOver()) {
        await this.transitionTo(PHASES.FINAL_LEADERBOARD);
      } else {
        // Start new round
        this.currentPlayerIndex = 0;
        await this.transitionTo(PHASES.ARENA_SETUP);
      }
    } else {
      await this.transitionTo(PHASES.ARENA_SETUP);
    }
  }

  // === FINAL LEADERBOARD ===
  async runFinalLeaderboard() {
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    
    this.onAnnouncement('FINAL STANDINGS', 'leaderboard_title');
    await this.delay(1500);
    
    // Announce from worst to best
    for (let i = sorted.length - 1; i >= 0; i--) {
      const player = sorted[i];
      const rank = i + 1;
      const isLast = i === sorted.length - 1;
      const isFirst = i === 0;
      
      this.onAnnouncement({
        rank,
        player,
        isLast,
        isFirst
      }, 'leaderboard_entry');
      
      await this.delay(2000);
    }
    
    // Crown the winner
    this.onAnnouncement(sorted[0], 'winner');
    
    // Shame the loser
    await this.delay(2000);
    this.onAnnouncement(sorted[sorted.length - 1], 'biggest_loser');
  }

  // === UTILITIES ===
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayer: this.getCurrentPlayer(),
      roundResults: this.roundResults
    };
  }
}
