import {
  BluetoothRemoteGATTNotificationEvent,
  DeviceProfile,
  connect,
  disconnect,
  discover,
  parseTreadmillNotification,
} from "./bluetooth";

export type TreadmillConnectedEvent = {
  detail: {
    treadmill: Treadmill;
  };
};

export type CurrentDataEvent = {
  detail: {
    speed: number;
    distance: number;
    formattedTime: string;
    kcal: number;
  };
};

export class Treadmill {
  device: BluetoothDevice;
  gatt?: BluetoothRemoteGATTServer;
  profile?: DeviceProfile;

  constructor(d: BluetoothDevice) {
    this.device = d;
  }

  get name() {
    return this.device?.name || "Unknown";
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
      (e) =>
        this.onTreadmillDataNotification(
          e as unknown as BluetoothRemoteGATTNotificationEvent
        )
    );
    this.profile.fitnessMachine.treadmillData.startNotifications();
  }

  disconnect() {
    this.profile?.fitnessMachine.treadmillData.stopNotifications();
    disconnect(this.device);
    document.dispatchEvent(new CustomEvent("treadmilldisconnected"));
  }

  onTreadmillDataNotification(e: BluetoothRemoteGATTNotificationEvent) {
    const data = parseTreadmillNotification(e.target.value);
    document.dispatchEvent(
      new CustomEvent("currentdata", {
        detail: {
          speed: kmphToMph(data.instantaneousSpeed),
          distance: metersToMiles(data.totalDistance),
          formattedTime: formatTime(data.elapsedTime),
          kcal: data.totalEnergy,
        },
      })
    );
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
