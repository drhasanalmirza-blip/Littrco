import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import type { RealtimeAdapter } from "./realtime";

export interface MqttAdapterOptions {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  topicPrefix?: string;
}

export class MqttRealtimeAdapter implements RealtimeAdapter {
  private client: MqttClient | null = null;
  private readonly topicPrefix: string;
  private readonly brokerUrl: string;
  private readonly opts: IClientOptions;
  private connected = false;

  constructor(options: MqttAdapterOptions) {
    this.brokerUrl = options.brokerUrl;
    this.topicPrefix = options.topicPrefix ?? "bins";
    this.opts = {
      clientId: options.clientId ?? `littr-server-${Math.random().toString(16).slice(2, 10)}`,
      username: options.username,
      password: options.password,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true,
    };
  }

  async connect(): Promise<void> {
    if (this.client) return;
    this.client = mqtt.connect(this.brokerUrl, this.opts);

    this.client.on("connect", () => {
      this.connected = true;
      console.log(`[Realtime/MQTT] connected to ${this.brokerUrl}`);
    });
    this.client.on("reconnect", () => {
      console.log("[Realtime/MQTT] reconnecting…");
    });
    this.client.on("error", (err) => {
      console.error("[Realtime/MQTT] error:", err.message);
    });
    this.client.on("close", () => {
      this.connected = false;
      console.log("[Realtime/MQTT] connection closed");
    });

    // Resolve as soon as the first connect fires, but never block server boot
    // beyond 5s — broker outage shouldn't take the API down.
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 5000);
      this.client!.once("connect", () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  private publish(topic: string, payload: unknown, qos: 0 | 1 = 1): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client || !this.connected) {
        console.warn(`[Realtime/MQTT] dropping publish to ${topic} — not connected`);
        resolve();
        return;
      }
      this.client.publish(
        topic,
        JSON.stringify(payload),
        { qos, retain: false },
        (err) => {
          if (err) console.error(`[Realtime/MQTT] publish ${topic} failed:`, err.message);
          resolve();
        },
      );
    });
  }

  async sendArmVeriScan(
    binId: number,
    sessionId: number,
    expiresAt: Date,
    expectedCount: number,
  ): Promise<void> {
    await this.publish(`${this.topicPrefix}/${binId}/commands/arm_veriscan`, {
      type: "arm_veriscan",
      sessionId,
      expiresAt: expiresAt.toISOString(),
      expectedCount,
      ts: new Date().toISOString(),
    });
  }

  async sendRewardUpdate(
    binId: number,
    dropId: number,
    status: string,
    points: number,
  ): Promise<void> {
    await this.publish(`${this.topicPrefix}/${binId}/commands/reward_update`, {
      type: "reward_update",
      dropId,
      status,
      points,
      ts: new Date().toISOString(),
    });
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    await new Promise<void>((resolve) => this.client!.end(false, {}, () => resolve()));
    this.client = null;
    this.connected = false;
  }
}

// Bootstrap helper: reads env, returns null if MQTT not configured.
// Caller is responsible for calling setRealtimeAdapter() when a non-null
// adapter is returned. Never throws — broker problems must not crash boot.
export async function tryBootstrapMqttAdapter(): Promise<MqttRealtimeAdapter | null> {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) return null;

  try {
    const adapter = new MqttRealtimeAdapter({
      brokerUrl,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID,
      topicPrefix: process.env.MQTT_TOPIC_PREFIX,
    });
    await adapter.connect();
    return adapter;
  } catch (err) {
    console.error("[Realtime/MQTT] bootstrap failed, staying on noOp adapter:", err);
    return null;
  }
}
