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

  constructor(d: BluetoothDevice) {
    this.device = d;
  }

  async connect() {
    this.device.addEventListener("gattserverdisconnected", () =>
      document.dispatchEvent(new CustomEvent("treadmilldisconnected"))
    );
    try {
      this.gatt = await connect(this.device);
    } catch (e) {
      throw new Error("failed to connect to gatt");
    }
    try {
      this.profile = await discover(this.gatt);
    } catch (e) {
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
  }

  disconnect() {
    this.profile?.fitnessMachine.treadmillData.stopNotifications();
    this.profile?.fitnessMachine.trainingStatus.stopNotifications();
    disconnect(this.device);
    document.dispatchEvent(new CustomEvent("treadmilldisconnected"));
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
