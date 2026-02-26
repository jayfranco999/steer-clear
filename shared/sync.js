/**
 * SYNC ENGINE
 * 
 * Handles communication between host (TV) and players (phones).
 * 
 * Architecture:
 * - Local mode: BroadcastChannel API (same browser testing)
 * - WebSocket mode: Real-time server (cross-device)
 * - Auto mode: Tries WebSocket first, falls back to BroadcastChannel
 * 
 * Room state is authoritative on the host.
 * Players send actions, host broadcasts state updates.
 */

const CHANNEL_PREFIX = 'ceremony-box-';
const DEFAULT_WS_URL = 'ws://localhost:3001';

export class SyncEngine {
  constructor(options = {}) {
    this.roomCode = options.roomCode || null;
    this.isHost = options.isHost || false;
    this.playerId = options.playerId || null;
    this.mode = options.mode || 'auto'; // 'local' | 'websocket' | 'auto'
    this.wsUrl = options.wsUrl || this._detectWsUrl();
    
    this.state = {
      roomCode: this.roomCode,
      phase: 'lobby',
      players: [],
      currentGame: null,
      hostConnected: false,
      gameState: {}
    };
    
    this.listeners = new Map();
    this.channel = null;  // BroadcastChannel
    this.ws = null;       // WebSocket
    this.activeMode = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Detect WebSocket URL based on current location
  _detectWsUrl() {
    if (typeof window === 'undefined') return DEFAULT_WS_URL;
    
    // If page loaded over HTTPS, use WSS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    
    // If on localhost, use local server port
    if (host === 'localhost' || host === '127.0.0.1') {
      return `ws://${host}:3001`;
    }
    
    // For remote (ngrok, etc.), try same host with /ws path or port 3001
    // Most deployments will need to configure this explicitly
    return `${protocol}//${host}:3001`;
  }

  // === INITIALIZATION ===

  async init() {
    if (!this.roomCode) throw new Error('Room code required');
    
    if (this.mode === 'local') {
      await this.initLocal();
    } else if (this.mode === 'websocket') {
      await this.initWebSocket();
    } else {
      // Auto mode: try WebSocket first, fall back to local
      try {
        await this.initWebSocket();
      } catch (err) {
        console.warn('WebSocket failed, falling back to BroadcastChannel:', err.message);
        await this.initLocal();
      }
    }
  }

  async initLocal() {
    this.channel = new BroadcastChannel(CHANNEL_PREFIX + this.roomCode);
    this.activeMode = 'local';
    
    this.channel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    if (this.isHost) {
      this.state.hostConnected = true;
      this.broadcastState();
    } else {
      // Player joining - request current state
      this.send({ type: 'player_join', playerId: this.playerId });
    }
    
    console.log(`[Sync] Initialized in LOCAL mode for room: ${this.roomCode}`);
  }

  async initWebSocket() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      try {
        this.ws = new WebSocket(this.wsUrl);
        this.activeMode = 'websocket';
        
        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log(`[Sync] WebSocket connected to ${this.wsUrl}`);
          this.reconnectAttempts = 0;
          
          // Join the room
          this.ws.send(JSON.stringify({
            type: 'join_room',
            roomCode: this.roomCode,
            isHost: this.isHost
          }));
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle room join confirmation
            if (data.type === 'room_joined') {
              this.state.hostConnected = data.hostConnected;
              if (data.state) {
                this.state = { ...this.state, ...data.state };
              }
              
              if (this.isHost) {
                this.state.hostConnected = true;
                this.broadcastState();
              }
              
              this.emit('connected', { roomCode: this.roomCode });
              resolve();
              return;
            }
            
            this.handleMessage(data);
          } catch (err) {
            console.error('[Sync] Failed to parse message:', err);
          }
        };
        
        this.ws.onclose = () => {
          console.log('[Sync] WebSocket disconnected');
          this.emit('disconnected');
          this._attemptReconnect();
        };
        
        this.ws.onerror = (err) => {
          clearTimeout(timeout);
          console.error('[Sync] WebSocket error');
          reject(new Error('WebSocket connection failed'));
        };
        
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Sync] Max reconnect attempts reached');
      this.emit('connection_lost');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`[Sync] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.initWebSocket();
      } catch (err) {
        console.error('[Sync] Reconnect failed');
      }
    }, delay);
  }

  // === MESSAGE HANDLING ===

  handleMessage(data) {
    const { type, ...payload } = data;
    
    switch (type) {
      case 'state_update':
        if (!this.isHost) {
          this.state = payload.state;
          this.emit('state', this.state);
        }
        break;
        
      case 'player_join':
        if (this.isHost) {
          this.emit('player_join', payload);
        }
        break;
        
      case 'player_action':
        if (this.isHost) {
          this.emit('player_action', payload);
        }
        break;
        
      case 'player_leave':
        if (this.isHost) {
          this.emit('player_leave', payload);
        }
        break;

      case 'chaos_vote':
        if (this.isHost) {
          this.emit('chaos_vote', payload);
        }
        break;
      
      case 'player_connected':
        // New player connected, broadcast state
        if (this.isHost) {
          this.broadcastState();
        }
        break;
        
      default:
        this.emit(type, payload);
    }
  }

  // === HOST METHODS ===

  // Update state and broadcast to all players
  setState(updates) {
    if (!this.isHost) {
      console.warn('Only host can set state');
      return;
    }
    
    this.state = { ...this.state, ...updates };
    this.broadcastState();
  }

  // Update just the game state
  setGameState(gameState) {
    this.setState({ gameState });
  }

  broadcastState() {
    this.send({ type: 'state_update', state: this.state });
  }

  addPlayer(player) {
    if (!this.isHost) return;
    
    // Check if player already exists
    const existing = this.state.players.find(p => p.id === player.id);
    if (existing) return;
    
    this.state.players.push(player);
    this.broadcastState();
    this.emit('player_added', player);
  }

  removePlayer(playerId) {
    if (!this.isHost) return;
    
    this.state.players = this.state.players.filter(p => p.id !== playerId);
    this.broadcastState();
    this.emit('player_removed', playerId);
  }

  // === PLAYER METHODS ===

  // Player sends action to host
  sendAction(action, data = {}) {
    if (this.isHost) return;
    
    this.send({
      type: 'player_action',
      playerId: this.playerId,
      action,
      ...data
    });
  }

  sendChaosVote(chaosType) {
    this.send({
      type: 'chaos_vote',
      playerId: this.playerId,
      chaosType
    });
  }

  joinRoom(player) {
    this.playerId = player.id;
    this.send({
      type: 'player_join',
      player
    });
  }

  leaveRoom() {
    this.send({
      type: 'player_leave',
      playerId: this.playerId
    });
  }

  // === COMMUNICATION ===

  send(data) {
    if (this.activeMode === 'local' && this.channel) {
      this.channel.postMessage(data);
    } else if (this.activeMode === 'websocket' && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ ...data, roomCode: this.roomCode }));
    }
  }

  // === EVENT SYSTEM ===

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => cb(data));
  }

  // === CLEANUP ===

  destroy() {
    if (this.channel) {
      this.channel.close();
    }
    if (this.ws) {
      this.ws.close();
    }
    this.listeners.clear();
  }

  // === GETTERS ===

  getState() {
    return this.state;
  }

  getPlayers() {
    return this.state.players;
  }

  getPlayer(id) {
    return this.state.players.find(p => p.id === id);
  }

  isInRoom() {
    return this.state.hostConnected;
  }
  
  getMode() {
    return this.activeMode;
  }
}

// Factory functions
export function createHost(roomCode, options = {}) {
  return new SyncEngine({
    roomCode,
    isHost: true,
    mode: options.mode || 'auto',
    wsUrl: options.wsUrl
  });
}

export function createPlayer(roomCode, playerId, options = {}) {
  return new SyncEngine({
    roomCode,
    playerId,
    isHost: false,
    mode: options.mode || 'auto',
    wsUrl: options.wsUrl
  });
}
