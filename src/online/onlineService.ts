import { MqttWebSocketClient } from './mqttWebSocket';
import { OnlineConnectionStatus, OnlinePlayerHome, OnlineVisitEvent, VisitInteractionKind } from './types';

const PLAYER_ID_STORAGE_KEY = 'meowchi_online_player_id_v1';
const PRESENCE_TOPIC_PREFIX = 'meowchi/v1/presence/';
const EVENTS_TOPIC_PREFIX = 'meowchi/v1/events/';
const BROADCAST_CHANNEL_NAME = 'meowchi_online_v1';
const LIVE_PLAYER_TTL_MS = 48_000;

const PUBLIC_WSS_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

export function getOrCreateLocalPlayerId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
      if (existing && existing.length >= 6) return existing;
      const fresh = `mc_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, fresh);
      return fresh;
    }
  } catch {
    // Fallback for Node test env
  }
  return `mc_${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveHomeCode(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[hash % alphabet.length];
    hash = Math.floor(hash / alphabet.length);
  }
  return `MC-${code}`;
}

export function encodeHomeInviteParam(home: OnlinePlayerHome): string {
  try {
    const json = JSON.stringify({
      ...home,
      isLive: true
    });
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeHomeInviteParam(encoded: string): OnlinePlayerHome | null {
  try {
    const pad = encoded.length % 4 === 0 ? '' : '='.repeat(4 - (encoded.length % 4));
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<OnlinePlayerHome>;
    if (!parsed || !parsed.playerId || !parsed.catIdentity || !parsed.humanAppearance) {
      return null;
    }
    return {
      ...(parsed as OnlinePlayerHome),
      isLive: true,
      lastSeenUtc: Date.now()
    };
  } catch {
    return null;
  }
}

export interface OnlineServiceCallbacks {
  getOwnHomeSnapshot: () => OnlinePlayerHome;
  onStatusChange: (status: OnlineConnectionStatus) => void;
  onLivePlayersChange: (players: OnlinePlayerHome[]) => void;
  onVisitEventReceived: (ev: OnlineVisitEvent) => void;
}

/**
 * Coordinates real-time online player discovery and live home-visit events across:
 * 1) Public WSS MQTT relay (cross-device worldwide presence on static GitHub Pages)
 * 2) Same-browser BroadcastChannel (instant zero-latency local multi-tab sync)
 */
export class OnlinePresenceService {
  public readonly playerId: string;
  public readonly homeCode: string;

  private readonly callbacks: OnlineServiceCallbacks;
  private mqtt: MqttWebSocketClient | null = null;
  private channel: BroadcastChannel | null = null;
  private livePlayers = new Map<string, OnlinePlayerHome>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(callbacks: OnlineServiceCallbacks) {
    this.callbacks = callbacks;
    this.playerId = getOrCreateLocalPlayerId();
    this.homeCode = deriveHomeCode(this.playerId);
  }

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.callbacks.onStatusChange('connecting');

    // 1. Instant cross-tab BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (e) => {
          const data = e.data as { kind: 'presence'; home: OnlinePlayerHome } | { kind: 'event'; event: OnlineVisitEvent };
          if (!data) return;
          if (data.kind === 'presence') {
            this.ingestPresence(data.home);
          } else if (data.kind === 'event' && data.event.targetPlayerId === this.playerId) {
            this.callbacks.onVisitEventReceived(data.event);
          }
        };
      } catch {
        this.channel = null;
      }
    }

    // 2. Real-time WSS MQTT Relay for cross-device online players
    this.mqtt = new MqttWebSocketClient({
      brokerUrls: PUBLIC_WSS_BROKERS,
      clientId: `${this.playerId}_${Math.random().toString(36).slice(2, 6)}`,
      topics: [`${PRESENCE_TOPIC_PREFIX}+`, `${EVENTS_TOPIC_PREFIX}${this.playerId}`],
      onConnect: () => {
        this.callbacks.onStatusChange('connected');
        this.publishOwnPresence();
      },
      onDisconnect: () => {
        this.callbacks.onStatusChange(this.channel ? 'local_only' : 'offline');
      },
      onMessage: (topic, payload) => {
        try {
          if (topic.startsWith(PRESENCE_TOPIC_PREFIX)) {
            const home = JSON.parse(payload) as OnlinePlayerHome;
            this.ingestPresence(home);
          } else if (topic === `${EVENTS_TOPIC_PREFIX}${this.playerId}`) {
            const ev = JSON.parse(payload) as OnlineVisitEvent;
            if (ev && ev.fromPlayerId !== this.playerId) {
              this.callbacks.onVisitEventReceived(ev);
            }
          }
        } catch {
          // Ignore malformed third-party packets safely
        }
      }
    });
    this.mqtt.connect();

    // Heartbeat broadcast every 12 seconds
    this.publishOwnPresence();
    this.heartbeatTimer = setInterval(() => this.publishOwnPresence(), 12_000);
    this.pruneTimer = setInterval(() => this.pruneStalePlayers(), 8_000);
  }

  public publishOwnPresence(): void {
    const snapshot = this.callbacks.getOwnHomeSnapshot();
    const packet: OnlinePlayerHome = {
      ...snapshot,
      playerId: this.playerId,
      homeCode: this.homeCode,
      isLive: true,
      lastSeenUtc: Date.now()
    };

    if (this.channel) {
      try {
        this.channel.postMessage({ kind: 'presence', home: packet });
      } catch {
        // Ignore
      }
    }
    if (this.mqtt?.isConnected()) {
      this.mqtt.publish(`${PRESENCE_TOPIC_PREFIX}${this.playerId}`, JSON.stringify(packet), false);
    }
  }

  public sendVisitEvent(
    targetPlayerId: string,
    type: VisitInteractionKind,
    fromName: string,
    fromCatName: string
  ): void {
    const ev: OnlineVisitEvent = {
      type,
      fromPlayerId: this.playerId,
      fromName,
      fromCatName,
      targetPlayerId,
      sentAtUtc: Date.now()
    };
    if (this.channel) {
      try {
        this.channel.postMessage({ kind: 'event', event: ev });
      } catch {
        // Ignore
      }
    }
    if (this.mqtt?.isConnected()) {
      this.mqtt.publish(`${EVENTS_TOPIC_PREFIX}${targetPlayerId}`, JSON.stringify(ev), false);
    }
  }

  private ingestPresence(home: OnlinePlayerHome): void {
    if (!home || !home.playerId || home.playerId === this.playerId) return;
    if (!home.catIdentity || !home.humanAppearance) return;
    this.livePlayers.set(home.playerId, {
      ...home,
      isLive: true,
      lastSeenUtc: Date.now()
    });
    this.emitPlayers();
  }

  private pruneStalePlayers(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, home] of this.livePlayers.entries()) {
      if (now - home.lastSeenUtc > LIVE_PLAYER_TTL_MS) {
        this.livePlayers.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitPlayers();
  }

  private emitPlayers(): void {
    const sorted = Array.from(this.livePlayers.values()).sort(
      (a, b) => b.lastSeenUtc - a.lastSeenUtc
    );
    this.callbacks.onLivePlayersChange(sorted);
  }

  public dispose(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.mqtt?.dispose();
    this.channel?.close();
    this.started = false;
  }
}
