import Dexie from "dexie";
import { Session, TrainingStatus, TreadmillData } from "./treadmill";

export type Settings = {
  id: number; // always 1, singleton
  weightLbs: number;
  goalDistanceMiles: number | null;
  goalDurationMinutes: number | null;
};

export class TreadmillDatabase extends Dexie {
  treadmillData!: Dexie.Table<TreadmillData, TreadmillData["timestamp"]>;
  trainingStatus!: Dexie.Table<TrainingStatus, TrainingStatus["timestamp"]>;
  session!: Dexie.Table<Session, Session["id"]>;
  settings!: Dexie.Table<Settings, Settings["id"]>;

  constructor() {
    super("treadmill");
    this.version(1).stores({
      treadmillData: "timestamp",
      trainingStatus: "timestamp",
      session:
        "++id, started, ended, duration, distance, averageSpeed, energyExpended",
    });
    this.version(2).stores({
      treadmillData: "timestamp",
      trainingStatus: "timestamp",
      session:
        "++id, started, ended, duration, distance, averageSpeed, energyExpended",
      settings: "id",
    });
  }

  async getSettings(): Promise<Settings> {
    const settings = await this.settings.get(1);
    if (settings) return settings;
    const defaultSettings: Settings = {
      id: 1,
      weightLbs: 0,
      goalDistanceMiles: null,
      goalDurationMinutes: null,
    };
    await this.settings.put(defaultSettings);
    return defaultSettings;
  }

  async saveSettings(settings: Partial<Omit<Settings, "id">>): Promise<void> {
    const current = await this.getSettings();
    await this.settings.put({ ...current, ...settings });
  }
}
