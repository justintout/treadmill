import Dexie from "dexie";
import { Session, TrainingStatus, TreadmillData } from "./treadmill";

export class TreadmillDatabase extends Dexie {
  treadmillData!: Dexie.Table<TreadmillData, TreadmillData["timestamp"]>;
  trainingStatus!: Dexie.Table<TrainingStatus, TrainingStatus["timestamp"]>;
  session!: Dexie.Table<Session, Session["id"]>;

  constructor() {
    super("treadmill");
    this.version(1).stores({
      treadmillData: "timestamp",
      trainingStatus: "timestamp",
      session:
        "++id, started, ended, duration, distance, averageSpeed, energyExpended",
    });
  }
}
