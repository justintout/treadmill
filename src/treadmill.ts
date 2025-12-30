import {
  BluetoothRemoteGATTNotificationEvent,
  DeviceProfile,
  TrainingStatusNotificationData,
  TreadmillNotificationData,
  connect,
  disconnect,
  discover,
  parseTrainingStatusNotification,
  parseTreadmillNotification,
  buildRequestControlCommand,
  buildStartCommand,
  buildStopCommand,
  buildSetSpeedCommand,
  parseControlPointResponse,
  ControlPointOpCode,
  ControlPointResult,
} from "./bluetooth";
import { TreadmillDatabase } from "./storage";

export type Session = {
  id?: number; // autoincremented by Dexie
  started: number;
  ended: number;
  duration: number;
  distance: number;
  averageSpeed: number;
  energyExpended: number;
};

export type SessionEndedEvent = {
  detail: Session;
};

export type TreadmillData = {
  timestamp: number;
  speed: number;
  distance: number;
  elapsedTime: number;
  formattedTime: string;
  kcal: number;
};

export type TreadmillConnectedEvent = {
  detail: {
    treadmill: Treadmill;
  };
};

export type TreadmillDataEvent = {
  detail: TreadmillData;
};

export type TrainingStatus = {
  timestamp: number;
  status: number;
  stringFromStatus: SupportedTrainingStatus;
};

export type TrainingStatusEvent = {
  detail: TrainingStatus;
};

const supportedTrainingStatuses = [
  "Idle",
  "Pre-Workout",
  "Post-Workout",
  "Manual Mode (Quick Start)",
] as const;
type SupportedTrainingStatus = (typeof supportedTrainingStatuses)[number];
const isSupportedTrainingStatus = (s: any): s is SupportedTrainingStatus =>
  supportedTrainingStatuses.includes(s);

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export type ConnectionStateEvent = {
  detail: { state: ConnectionState; attempt?: number };
};

export class Treadmill {
  // todo: there's a better way to do this
  static supportedTrainingStatuses: Array<SupportedTrainingStatus> = [
    "Idle",
    "Pre-Workout",
    "Post-Workout",
    "Manual Mode (Quick Start)",
  ];

  device: BluetoothDevice;
  gatt?: BluetoothRemoteGATTServer;
  profile?: DeviceProfile;

  sessionStarted?: number;
  lastData?: TreadmillData;

  // Target speed for pre-start adjustment and control
  private _targetSpeed: number = 0.6;
  get targetSpeed(): number {
    return this._targetSpeed;
  }
  set targetSpeed(speed: number) {
    this._targetSpeed = Math.max(0, Math.min(speed, 12)); // Clamp 0-12 mph
    document.dispatchEvent(new CustomEvent("targetspeedchanged", { detail: this._targetSpeed }));
  }

  // Reconnection state
  private _connectionState: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private wasConnected = false;

  private _status: SupportedTrainingStatus = "Idle";
  get status(): SupportedTrainingStatus {
    return this._status;
  }
  set status(data: TrainingStatus) {
    this._status = data.stringFromStatus;
    document.dispatchEvent(
      new CustomEvent("trainingstatuschanged", { detail: data })
    );
  }

  get name() {
    return this.device?.name || "Unknown";
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  private setConnectionState(state: ConnectionState, attempt?: number) {
    this._connectionState = state;
    document.dispatchEvent(
      new CustomEvent("connectionstatechanged", { detail: { state, attempt } })
    );
  }

  constructor(d: BluetoothDevice) {
    this.device = d;
  }

  async connect() {
    this.setConnectionState("connecting");
    this.device.addEventListener("gattserverdisconnected", () => {
      this.onDisconnected();
    });
    try {
      this.gatt = await connect(this.device);
    } catch (e) {
      this.setConnectionState("disconnected");
      throw new Error("failed to connect to gatt");
    }
    try {
      this.profile = await discover(this.gatt);
    } catch (e) {
      this.setConnectionState("disconnected");
      throw new Error("failed to discover profile");
    }

    this.profile.fitnessMachine.treadmillData.addEventListener(
      "characteristicvaluechanged",
      (e) => this.onTreadmillDataNotification(e)
    );
    this.profile.fitnessMachine.treadmillData.startNotifications();

    try {
      this.status = await this.readTrainingStatus();
      // if the status is not idle, we connected mid-session
      // we need to set the session start time by catching the next
      // treadmill data and using it to derive start time
      if (this.status !== "Idle")
        this.profile.fitnessMachine.treadmillData.addEventListener(
          "characteristicvaluechanged",
          (_e) => {
            const e = _e as unknown as BluetoothRemoteGATTNotificationEvent;
            const data = toTreadmillData(
              parseTreadmillNotification(e.target.value)
            );
            this.sessionStarted = Date.now() - data.elapsedTime * 1000;
          },
          // @ts-expect-error
          { once: true }
        );
    } catch (e) {
      console.error("could not initialize treadmill status: ", e);
    }

    this.profile.fitnessMachine.trainingStatus.addEventListener(
      "characteristicvaluechanged",
      (e) => this.onTrainingStatusNotification(e)
    );
    this.profile.fitnessMachine.trainingStatus.startNotifications();

    // Try to wake the machine by reading feature characteristic
    await this.readFeature();

    this.setConnectionState("connected");
    this.wasConnected = true;
    this.reconnectAttempts = 0;
  }

  disconnect() {
    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.wasConnected = false;
    this.profile?.fitnessMachine.treadmillData.stopNotifications();
    this.profile?.fitnessMachine.trainingStatus.stopNotifications();
    disconnect(this.device);
    this.setConnectionState("disconnected");
    document.dispatchEvent(new CustomEvent("treadmilldisconnected"));
  }

  private onDisconnected() {
    // If this was an unexpected disconnect and we were connected, try to reconnect
    if (this.wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnect();
    } else {
      this.setConnectionState("disconnected");
      document.dispatchEvent(new CustomEvent("treadmilldisconnected"));
    }
  }

  private attemptReconnect() {
    this.reconnectAttempts++;
    this.setConnectionState("reconnecting", this.reconnectAttempts);

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        if (this.device.gatt) {
          this.gatt = await this.device.gatt.connect();
          this.profile = await discover(this.gatt);

          // Re-setup notifications
          this.profile.fitnessMachine.treadmillData.addEventListener(
            "characteristicvaluechanged",
            (e) => this.onTreadmillDataNotification(e)
          );
          this.profile.fitnessMachine.treadmillData.startNotifications();

          this.profile.fitnessMachine.trainingStatus.addEventListener(
            "characteristicvaluechanged",
            (e) => this.onTrainingStatusNotification(e)
          );
          this.profile.fitnessMachine.trainingStatus.startNotifications();

          this.setConnectionState("connected");
          this.reconnectAttempts = 0;
          document.dispatchEvent(new CustomEvent("treadmillreconnected"));
        }
      } catch (e) {
        console.error("Reconnection attempt failed:", e);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          this.setConnectionState("disconnected");
          document.dispatchEvent(new CustomEvent("treadmilldisconnected"));
        }
      }
    }, delay);
  }

  cancelReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.wasConnected = false;
    this.reconnectAttempts = 0;
    this.setConnectionState("disconnected");
  }

  get hasControlPoint(): boolean {
    return !!this.profile?.fitnessMachine.controlPoint;
  }

  private async writeControlPoint(command: Uint8Array): Promise<boolean> {
    const controlPoint = this.profile?.fitnessMachine.controlPoint;
    if (!controlPoint) {
      console.warn("[CP] Control Point not available");
      return false;
    }
    console.log("[CP] Writing command:", Array.from(command).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    console.log("[CP] Control Point properties:", {
      write: controlPoint.properties.write,
      writeWithoutResponse: controlPoint.properties.writeWithoutResponse,
      indicate: controlPoint.properties.indicate,
      notify: controlPoint.properties.notify,
    });
    try {
      // FTMS Control Point typically requires write-with-response
      if (controlPoint.properties.write) {
        console.log("[CP] Using writeValueWithResponse");
        await controlPoint.writeValueWithResponse(command);
      } else if (controlPoint.properties.writeWithoutResponse) {
        console.log("[CP] Using writeValueWithoutResponse");
        await controlPoint.writeValueWithoutResponse(command);
      } else {
        console.log("[CP] Using writeValue (fallback)");
        await controlPoint.writeValue(command);
      }
      console.log("[CP] Write successful");
      return true;
    } catch (e) {
      console.error("[CP] Failed to write control point:", e);
      return false;
    }
  }

  async requestControl(): Promise<boolean> {
    console.log("[CP] Requesting control...");
    const result = await this.writeControlPoint(buildRequestControlCommand());
    console.log("[CP] Request control result:", result);
    return result;
  }

  async reset(): Promise<boolean> {
    console.log("[CP] Sending RESET command (may wake machine)...");
    const result = await this.writeControlPoint(new Uint8Array([0x01])); // RESET opcode
    console.log("[CP] Reset result:", result);
    return result;
  }

  async readFeature(): Promise<void> {
    const feature = this.profile?.fitnessMachine.feature;
    if (!feature) {
      console.warn("[BT] Feature characteristic not available");
      return;
    }
    try {
      console.log("[BT] Reading Feature characteristic (may wake machine)...");
      const value = await feature.readValue();
      console.log("[BT] Feature value:", new Uint8Array(value.buffer));
    } catch (e) {
      console.warn("[BT] Could not read Feature:", e);
    }
  }

  async start(): Promise<boolean> {
    console.log("[CP] Starting workout...");

    // Subscribe to control point indications to see responses
    const controlPoint = this.profile?.fitnessMachine.controlPoint;
    if (controlPoint && controlPoint.properties.indicate) {
      try {
        console.log("[CP] Subscribing to Control Point indications...");
        controlPoint.addEventListener("characteristicvaluechanged", (e) => {
          const event = e as unknown as BluetoothRemoteGATTNotificationEvent;
          const response = parseControlPointResponse(event.target.value);
          console.log("[CP] Response received:", {
            opCode: '0x' + response.opCode.toString(16),
            requestOpCode: '0x' + response.requestOpCode.toString(16),
            result: '0x' + response.result.toString(16),
            resultMeaning: response.result === 1 ? 'SUCCESS' :
                          response.result === 2 ? 'OP_CODE_NOT_SUPPORTED' :
                          response.result === 3 ? 'INVALID_PARAMETER' :
                          response.result === 4 ? 'OPERATION_FAILED' :
                          response.result === 5 ? 'CONTROL_NOT_PERMITTED' : 'UNKNOWN'
          });
        });
        await controlPoint.startNotifications();
        console.log("[CP] Subscribed to indications");
      } catch (e) {
        console.warn("[CP] Could not subscribe to indications:", e);
      }
    }

    // Try to wake the machine first with a reset
    console.log("[CP] Attempting to wake machine with RESET...");
    await this.reset();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Request control
    const hasControl = await this.requestControl();
    console.log("[CP] Has control:", hasControl);
    if (!hasControl) return false;

    // Some treadmills require setting a speed before starting
    console.log("[CP] Setting initial speed to", this._targetSpeed, "mph...");
    await this.setSpeed(this._targetSpeed);

    // Small delay to let the treadmill process
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now send start command
    const result = await this.writeControlPoint(buildStartCommand());
    console.log("[CP] Start result:", result);
    return result;
  }

  async stop(): Promise<boolean> {
    console.log("[CP] Stopping workout...");
    return this.writeControlPoint(buildStopCommand());
  }

  async setSpeed(speedMph: number): Promise<boolean> {
    // Convert mph to km/h for the command
    const speedKmph = speedMph / 0.6213712;
    return this.writeControlPoint(buildSetSpeedCommand(speedKmph));
  }

  async increaseSpeed(increment: number = 0.1): Promise<boolean> {
    const currentSpeed = this.lastData?.speed ?? this._targetSpeed;
    const newSpeed = currentSpeed + increment;
    this.targetSpeed = newSpeed; // Update target

    // If running, also send command to treadmill
    if (this.status === "Manual Mode (Quick Start)") {
      return this.setSpeed(newSpeed);
    }
    return true; // Just updated target, no command needed
  }

  async decreaseSpeed(decrement: number = 0.1): Promise<boolean> {
    const currentSpeed = this.lastData?.speed ?? this._targetSpeed;
    const newSpeed = Math.max(0.6, currentSpeed - decrement); // Min 0.6 mph
    this.targetSpeed = newSpeed; // Update target

    // If running, also send command to treadmill
    if (this.status === "Manual Mode (Quick Start)") {
      return this.setSpeed(newSpeed);
    }
    return true; // Just updated target, no command needed
  }

  async readTrainingStatus() {
    const v = await this.profile?.fitnessMachine.trainingStatus.readValue();
    if (!v) {
      throw new Error("no training status value read");
    }
    return toTrainingStatus(parseTrainingStatusNotification(v));
  }

  onTreadmillDataNotification(_e: Event) {
    const e = _e as unknown as BluetoothRemoteGATTNotificationEvent;
    if (this.status === "Idle") {
      // machine sends constant treadmill notifications. ignore these until we're
      // out of idle state.
      return;
    }
    const data = toTreadmillData(parseTreadmillNotification(e.target.value));
    if (this.status === "Manual Mode (Quick Start)") {
      this.lastData = data;
    }
    document.dispatchEvent(new CustomEvent("treadmilldata", { detail: data }));
  }

  async onTrainingStatusNotification(_e: Event) {
    const e = _e as unknown as BluetoothRemoteGATTNotificationEvent;
    try {
      const data = toTrainingStatus(
        parseTrainingStatusNotification(e.target.value)
      );
      this.status = data;
      if (data.stringFromStatus === "Pre-Workout") {
        this.sessionStarted = data.timestamp;
      }
      if (data.stringFromStatus === "Post-Workout") {
        // if we don't have a last notification, we're kinda screwed.
        // TODO: handle this
        if (!this.lastData) {
          console.error("no previous notification available to finish session");
          return;
        }
        // session is ended. box up a new session and send it off
        // if we haven't found a start time at this point, derive it from the
        // last notification
        // TODO: listen for the 'Idle' status event once to get the last notification of the session
        if (!this.sessionStarted) {
          this.sessionStarted = Date.now() - this.lastData?.elapsedTime * 1000;
        }
        const session: Session = {
          started: this.sessionStarted,
          ended: data.timestamp,
          distance: this.lastData.distance,
          duration: this.lastData.elapsedTime,
          energyExpended: this.lastData.kcal, // TODO: don't trust treadmill calculated kcal, use our calc
          averageSpeed: await averageSpeed(
            this.sessionStarted,
            this.lastData.timestamp
          ),
        };
        document.dispatchEvent(
          new CustomEvent("sessionended", { detail: session })
        );
      }
    } catch (e) {
      console.error(e);
      return;
    }
  }
}

function kmphToMph(kmph: number) {
  return Math.round(kmph * 0.6213712 * 10) / 10;
}

function metersToMiles(meters: number) {
  return Math.round(meters * 0.000621371 * 100) / 100;
}

function formatTime(seconds: number) {
  return new Date(seconds * 1000).toISOString().substring(11, 19);
}

function toTreadmillData(d: TreadmillNotificationData): TreadmillData {
  return {
    timestamp: Date.now(),
    speed: kmphToMph(d.instantaneousSpeed),
    distance: metersToMiles(d.totalDistance),
    formattedTime: formatTime(d.elapsedTime),
    elapsedTime: d.elapsedTime,
    kcal: d.totalEnergy,
  };
}

function toTrainingStatus(d: TrainingStatusNotificationData): TrainingStatus {
  if (isSupportedTrainingStatus(d.stringFromStatus)) {
    return {
      timestamp: Date.now(),
      status: d.status,
      stringFromStatus: d.stringFromStatus,
    };
  }
  throw new Error(
    `cannot convert unsupported training status: ${d.stringFromStatus}`
  );
}

async function averageSpeed(start: number, end: number) {
  const db = new TreadmillDatabase();
  const points = await db.treadmillData
    .where("timestamp")
    .between(start, end)
    .toArray();
  console.log(points);
  return points.map((p) => p.speed).reduce((s, v) => s + v, 0) / points.length;
}
