/**
 * Minimal zero-dependency MQTT 3.1.1 over WebSocket (WSS) client for browser environments.
 * Supports CONNECT (with Last Will & Testament for instant offline cleanup), CONNACK,
 * dynamic SUBSCRIBE/UNSUBSCRIBE, QoS 0 PUBLISH, PINGREQ/PINGRESP, and broker failover.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeUtf8String(str: string): Uint8Array {
  const bytes = textEncoder.encode(str);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function encodeRemainingLength(len: number): Uint8Array {
  const out: number[] = [];
  let x = len;
  do {
    let digit = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) digit |= 0x80;
    out.push(digit);
  } while (x > 0);
  return new Uint8Array(out);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function buildConnectPacket(
  clientId: string,
  keepAliveSec = 25,
  will?: { topic: string; payload: string }
): Uint8Array {
  const protocolName = encodeUtf8String('MQTT');
  const connectFlags = will ? 0x06 : 0x02; // Clean session (+ Will Flag QoS 0)
  const headerRest = new Uint8Array([
    0x04, // MQTT 3.1.1
    connectFlags,
    (keepAliveSec >> 8) & 0xff,
    keepAliveSec & 0xff
  ]);
  const payloadParts = [encodeUtf8String(clientId)];
  if (will) {
    payloadParts.push(encodeUtf8String(will.topic));
    payloadParts.push(encodeUtf8String(will.payload));
  }
  const body = concatBytes(protocolName, headerRest, ...payloadParts);
  return concatBytes(new Uint8Array([0x10]), encodeRemainingLength(body.length), body);
}

function buildSubscribePacket(packetId: number, topics: string[]): Uint8Array {
  const pid = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const parts: Uint8Array[] = [pid];
  for (const t of topics) {
    parts.push(encodeUtf8String(t));
    parts.push(new Uint8Array([0x00])); // QoS 0
  }
  const body = concatBytes(...parts);
  return concatBytes(new Uint8Array([0x82]), encodeRemainingLength(body.length), body);
}

function buildUnsubscribePacket(packetId: number, topics: string[]): Uint8Array {
  const pid = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const parts: Uint8Array[] = [pid];
  for (const t of topics) {
    parts.push(encodeUtf8String(t));
  }
  const body = concatBytes(...parts);
  return concatBytes(new Uint8Array([0xa2]), encodeRemainingLength(body.length), body);
}

function buildPublishPacket(topic: string, payloadStr: string, retain = false): Uint8Array {
  const topicBytes = encodeUtf8String(topic);
  const payloadBytes = textEncoder.encode(payloadStr);
  const body = concatBytes(topicBytes, payloadBytes);
  const firstByte = 0x30 | (retain ? 0x01 : 0x00);
  return concatBytes(new Uint8Array([firstByte]), encodeRemainingLength(body.length), body);
}

const PINGREQ_PACKET = new Uint8Array([0xc0, 0x00]);
const DISCONNECT_PACKET = new Uint8Array([0xe0, 0x00]);

export interface MqttWsOptions {
  brokerUrls: string[];
  clientId: string;
  topics: string[];
  will?: { topic: string; payload: string };
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (topic: string, payload: string) => void;
}

export class MqttWebSocketClient {
  private readonly opts: MqttWsOptions;
  private ws: WebSocket | null = null;
  private brokerIndex = 0;
  private connected = false;
  private disposed = false;
  private packetId = 1;
  private activeTopics: Set<string>;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rxBuffer: Uint8Array = new Uint8Array(0);

  constructor(opts: MqttWsOptions) {
    this.opts = opts;
    this.activeTopics = new Set(opts.topics);
  }

  public connect(): void {
    if (this.disposed || typeof WebSocket === 'undefined') return;
    this.cleanupSocket();

    const url = this.opts.brokerUrls[this.brokerIndex % this.opts.brokerUrls.length];
    try {
      const ws = new WebSocket(url, ['mqtt']);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        if (this.disposed) {
          ws.close();
          return;
        }
        ws.send(buildConnectPacket(this.opts.clientId, 25, this.opts.will));
      };

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          this.handleBytes(new Uint8Array(ev.data));
        }
      };

      ws.onerror = () => {
        // Handled cleanly by onclose reconnect/failover
      };

      ws.onclose = () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.stopPing();
        if (wasConnected) {
          this.opts.onDisconnect?.();
        }
        if (!this.disposed) {
          this.brokerIndex = (this.brokerIndex + 1) % this.opts.brokerUrls.length;
          this.reconnectTimer = setTimeout(() => this.connect(), 4500);
        }
      };
    } catch {
      if (!this.disposed) {
        this.brokerIndex = (this.brokerIndex + 1) % this.opts.brokerUrls.length;
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    }
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  public subscribe(topic: string): void {
    this.activeTopics.add(topic);
    if (this.isConnected() && this.ws) {
      try {
        this.ws.send(buildSubscribePacket(this.packetId++, [topic]));
      } catch {
        // Ignore
      }
    }
  }

  public unsubscribe(topic: string): void {
    this.activeTopics.delete(topic);
    if (this.isConnected() && this.ws) {
      try {
        this.ws.send(buildUnsubscribePacket(this.packetId++, [topic]));
      } catch {
        // Ignore
      }
    }
  }

  public publish(topic: string, payload: string, retain = false): boolean {
    if (!this.isConnected() || !this.ws) return false;
    try {
      this.ws.send(buildPublishPacket(topic, payload, retain));
      return true;
    } catch {
      return false;
    }
  }

  public disconnectGracefully(offlineTopic?: string, offlinePayload?: string): void {
    if (this.isConnected() && this.ws) {
      try {
        if (offlineTopic && offlinePayload !== undefined) {
          this.ws.send(buildPublishPacket(offlineTopic, offlinePayload, false));
        }
        this.ws.send(DISCONNECT_PACKET);
      } catch {
        // Ignore
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
  }

  private cleanupSocket(): void {
    this.stopPing();
    this.connected = false;
    this.rxBuffer = new Uint8Array(0);
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleBytes(chunk: Uint8Array): void {
    this.rxBuffer = concatBytes(this.rxBuffer, chunk);

    while (this.rxBuffer.length >= 2) {
      const header = this.rxBuffer[0];
      const packetType = header >> 4;

      let multiplier = 1;
      let remLen = 0;
      let pos = 1;
      let completeVarInt = false;
      while (pos < this.rxBuffer.length && pos <= 4) {
        const encoded = this.rxBuffer[pos++];
        remLen += (encoded & 0x7f) * multiplier;
        multiplier *= 128;
        if ((encoded & 0x80) === 0) {
          completeVarInt = true;
          break;
        }
      }
      if (!completeVarInt || this.rxBuffer.length < pos + remLen) {
        break;
      }

      const body = this.rxBuffer.subarray(pos, pos + remLen);
      this.rxBuffer = this.rxBuffer.subarray(pos + remLen);

      if (packetType === 2) {
        if (body.length >= 2 && body[1] === 0x00) {
          this.connected = true;
          const topics = Array.from(this.activeTopics);
          if (topics.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(buildSubscribePacket(this.packetId++, topics));
          }
          this.stopPing();
          this.pingTimer = setInterval(() => {
            if (this.isConnected() && this.ws) {
              try {
                this.ws.send(PINGREQ_PACKET);
              } catch {
                // Ignore
              }
            }
          }, 20000);
          this.opts.onConnect?.();
        }
      } else if (packetType === 3) {
        if (body.length >= 2) {
          const qos = (header >> 1) & 0x03;
          const topicLen = (body[0] << 8) | body[1];
          const topicEnd = 2 + topicLen;
          if (topicEnd <= body.length) {
            const topic = textDecoder.decode(body.subarray(2, topicEnd));
            const payloadStart = topicEnd + (qos > 0 ? 2 : 0);
            if (payloadStart <= body.length) {
              const payload = textDecoder.decode(body.subarray(payloadStart));
              this.opts.onMessage?.(topic, payload);
            }
          }
        }
      }
    }
  }
}
