import { MqttWebSocketClient } from './mqttWebSocket';
import {
  LiveGuestPresence,
  LiveHostSyncPacket,
  OnlineConnectionStatus,
  OnlinePlayerHome,
  OnlineVisitEvent,
  VisitInteractionKind
} from './types';

const PLAYER_ID_STORAGE_KEY = 'meowchi_online_player_id_v1';
const PRESENCE_TOPIC_PREFIX = 'meowchi/v2/presence/';
const DISCOVERY_TOPIC = 'meowchi/v2/discovery';
const EVENTS_TOPIC_PREFIX = 'meowchi/v2/events/';
const GUESTS_TOPIC_PREFIX = 'meowchi/v2/guests/'; // guests inside <hostId>'s home
const HOST_SYNC_TOPIC_PREFIX = 'meowchi/v2/hostsync/'; // live host movement in <hostId>'s home
const LIVE_PLAYER_TTL_MS = 38_000;
const LIVE_GUEST_TTL_MS = 18_000;

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
    const json = JSON.stringify(home);
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
  onHomeGuestsChange: (guests: LiveGuestPresence[]) => void;
  onHostLiveSync: (sync: LiveHostSyncPacket) => void;
  onVisitEventReceived: (ev: OnlineVisitEvent) => void;
}

/**
 * Pure real-player cross-device online multiplayer service over WSS MQTT.
 * ZERO AI bots or fake NPCs — every player listed is a real connected human client!
 * Features:
 * - Instant discovery ping on connect (<200ms player list population)
 * - MQTT Last Will & Testament (LWT) + pagehide goodbye for instant offline removal
 * - Real-time guest presence inside your living room when another player visits you
 * - Real-time host movement sync when you visit another player's living room
 */
export class OnlinePresenceService {
  public readonly playerId: string;
  public readonly homeCode: string;

  private readonly callbacks: OnlineServiceCallbacks;
  private mqtt: MqttWebSocketClient | null = null;
  private livePlayers = new Map<string, OnlinePlayerHome>();
  private homeGuests = new Map<string, LiveGuestPresence>();
  private subscribedHostId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private lastDiscoveryReplyMs = 0;

  constructor(callbacks: OnlineServiceCallbacks) {
    this.callbacks = callbacks;
    this.playerId = getOrCreateLocalPlayerId();
    this.homeCode = deriveHomeCode(this.playerId);
  }

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.callbacks.onStatusChange('connecting');

    const myPresenceTopic = `${PRESENCE_TOPIC_PREFIX}${this.playerId}`;
    const offlineWillPayload = JSON.stringify({ offline: true, playerId: this.playerId });

    this.mqtt = new MqttWebSocketClient({
      brokerUrls: PUBLIC_WSS_BROKERS,
      clientId: `${this.playerId}_${Math.random().toString(36).slice(2, 6)}`,
      topics: [
        `${PRESENCE_TOPIC_PREFIX}+`,
        DISCOVERY_TOPIC,
        `${EVENTS_TOPIC_PREFIX}${this.playerId}`,
        `${GUESTS_TOPIC_PREFIX}${this.playerId}/+`
      ],
      will: {
        topic: myPresenceTopic,
        payload: offlineWillPayload
      },
      onConnect: () => {
        this.callbacks.onStatusChange('connected');
        this.publishOwnPresence();
        // Ask all currently online real players to immediately announce themselves!
        this.mqtt?.publish(
          DISCOVERY_TOPIC,
          JSON.stringify({ type: 'who_is_online', from: this.playerId }),
          false
        );
      },
      onDisconnect: () => {
        this.callbacks.onStatusChange('offline');
      },
      onMessage: (topic, payload) => {
        try {
          if (topic === DISCOVERY_TOPIC) {
            const msg = JSON.parse(payload) as { type?: string; from?: string };
            if (msg?.type === 'who_is_online' && msg.from !== this.playerId) {
              const now = Date.now();
              if (now - this.lastDiscoveryReplyMs > 1200) {
                this.lastDiscoveryReplyMs = now;
                this.publishOwnPresence();
              }
            }
          } else if (topic.startsWith(PRESENCE_TOPIC_PREFIX)) {
            const data = JSON.parse(payload) as OnlinePlayerHome & { offline?: boolean };
            if (!data || data.playerId === this.playerId) return;
            if (data.offline) {
              if (this.livePlayers.delete(data.playerId)) {
                this.emitPlayers();
              }
              return;
            }
            this.ingestPresence(data);
          } else if (topic === `${EVENTS_TOPIC_PREFIX}${this.playerId}`) {
            const ev = JSON.parse(payload) as OnlineVisitEvent;
            if (ev && ev.fromPlayerId !== this.playerId) {
              this.callbacks.onVisitEventReceived(ev);
            }
          } else if (topic.startsWith(`${GUESTS_TOPIC_PREFIX}${this.playerId}/`)) {
            const guest = JSON.parse(payload) as LiveGuestPresence & { left?: boolean };
            if (!guest || guest.playerId === this.playerId) return;
            if (guest.left) {
              if (this.homeGuests.delete(guest.playerId)) {
                this.emitGuests();
              }
              return;
            }
            this.homeGuests.set(guest.playerId, { ...guest, lastSeenUtc: Date.now() });
            this.emitGuests();
          } else if (
            this.subscribedHostId &&
            topic === `${HOST_SYNC_TOPIC_PREFIX}${this.subscribedHostId}`
          ) {
            const sync = JSON.parse(payload) as LiveHostSyncPacket;
            if (sync && sync.hostPlayerId === this.subscribedHostId) {
              this.callbacks.onHostLiveSync(sync);
            }
          }
        } catch {
          // Ignore malformed external packets safely
        }
      }
    });
    this.mqtt.connect();

    // Clean offline goodbye when tab/app closes
    const handleUnload = () => {
      this.mqtt?.disconnectGracefully(myPresenceTopic, offlineWillPayload);
    };
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    this.heartbeatTimer = setInterval(() => this.publishOwnPresence(), 12_000);
    this.pruneTimer = setInterval(() => this.pruneStale(), 6_000);
  }

  public requestRefresh(): void {
    this.publishOwnPresence();
    this.mqtt?.publish(
      DISCOVERY_TOPIC,
      JSON.stringify({ type: 'who_is_online', from: this.playerId }),
      false
    );
  }

  public publishOwnPresence(): void {
    if (!this.mqtt?.isConnected()) return;
    const snapshot = this.callbacks.getOwnHomeSnapshot();
    const packet: OnlinePlayerHome = {
      ...snapshot,
      playerId: this.playerId,
      homeCode: this.homeCode,
      lastSeenUtc: Date.now()
    };
    this.mqtt.publish(`${PRESENCE_TOPIC_PREFIX}${this.playerId}`, JSON.stringify(packet), false);
  }

  public subscribeToHostRoom(hostPlayerId: string | null): void {
    if (this.subscribedHostId === hostPlayerId) return;
    if (this.subscribedHostId) {
      this.mqtt?.unsubscribe(`${HOST_SYNC_TOPIC_PREFIX}${this.subscribedHostId}`);
    }
    this.subscribedHostId = hostPlayerId;
    if (hostPlayerId) {
      this.mqtt?.subscribe(`${HOST_SYNC_TOPIC_PREFIX}${hostPlayerId}`);
    }
  }

  public publishGuestState(hostPlayerId: string, guest: LiveGuestPresence): void {
    if (!this.mqtt?.isConnected()) return;
    this.mqtt.publish(
      `${GUESTS_TOPIC_PREFIX}${hostPlayerId}/${this.playerId}`,
      JSON.stringify(guest),
      false
    );
  }

  public publishGuestLeft(hostPlayerId: string): void {
    if (!this.mqtt?.isConnected()) return;
    this.mqtt.publish(
      `${GUESTS_TOPIC_PREFIX}${hostPlayerId}/${this.playerId}`,
      JSON.stringify({ playerId: this.playerId, left: true }),
      false
    );
  }

  public publishHostLiveSync(sync: LiveHostSyncPacket): void {
    if (!this.mqtt?.isConnected()) return;
    this.mqtt.publish(`${HOST_SYNC_TOPIC_PREFIX}${this.playerId}`, JSON.stringify(sync), false);
  }

  public sendVisitEvent(
    targetPlayerId: string,
    type: VisitInteractionKind,
    fromName: string,
    fromCatName: string,
    message?: string
  ): void {
    if (!this.mqtt?.isConnected()) return;
    const ev: OnlineVisitEvent = {
      type,
      fromPlayerId: this.playerId,
      fromName,
      fromCatName,
      targetPlayerId,
      message,
      sentAtUtc: Date.now()
    };
    this.mqtt.publish(`${EVENTS_TOPIC_PREFIX}${targetPlayerId}`, JSON.stringify(ev), false);
  }

  private ingestPresence(home: OnlinePlayerHome): void {
    if (!home || !home.playerId || home.playerId === this.playerId) return;
    if (!home.catIdentity || !home.humanAppearance) return;
    this.livePlayers.set(home.playerId, {
      ...home,
      lastSeenUtc: Date.now()
    });
    this.emitPlayers();
  }

  private pruneStale(): void {
    const now = Date.now();
    let playersChanged = false;
    for (const [id, home] of this.livePlayers.entries()) {
      if (now - home.lastSeenUtc > LIVE_PLAYER_TTL_MS) {
        this.livePlayers.delete(id);
        playersChanged = true;
      }
    }
    if (playersChanged) this.emitPlayers();

    let guestsChanged = false;
    for (const [id, g] of this.homeGuests.entries()) {
      if (now - g.lastSeenUtc > LIVE_GUEST_TTL_MS) {
        this.homeGuests.delete(id);
        guestsChanged = true;
      }
    }
    if (guestsChanged) this.emitGuests();
  }

  private emitPlayers(): void {
    const sorted = Array.from(this.livePlayers.values()).sort(
      (a, b) => b.lastSeenUtc - a.lastSeenUtc
    );
    this.callbacks.onLivePlayersChange(sorted);
  }

  private emitGuests(): void {
    this.callbacks.onHomeGuestsChange(Array.from(this.homeGuests.values()));
  }

  public dispose(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.mqtt?.dispose();
    this.started = false;
  }
}
