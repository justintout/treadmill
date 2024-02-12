import { TreadmillDatabase } from "./storage";
import { TrainingStatus, TreadmillData } from "./treadmill";

const db = new TreadmillDatabase();

function isTreadmillDataEvent(
  e: MessageEvent
): e is MessageEvent<TreadmillData> {
  return (
    e.data &&
    ["timestamp", "speed", "distance", "formattedTime"]
      .map((p) => p in e.data)
      .reduce((b, v) => b && v)
  );
}

function isTrainingStatusEvent(
  e: MessageEvent
): e is MessageEvent<TrainingStatus> {
  return (
    e.data &&
    ["timestamp", "stringFromStatus"]
      .map((p) => p in e.data)
      .reduce((b, v) => b && v)
  );
}

async function onTreadmillData(d: TreadmillData) {
  await db.treadmillData.put(d);
}

async function onTrainingStatus(d: TrainingStatus) {
  await db.trainingStatus.put(d);
}

onmessage = async function (e: MessageEvent<TreadmillData | TrainingStatus>) {
  console.log(e.data);
  if (isTreadmillDataEvent(e)) {
    await onTreadmillData(e.data);
    return;
  }
  if (isTrainingStatusEvent(e)) {
    await onTrainingStatus(e.data);
    return;
  }
  throw new Error(
    `storage worker received unknown message type: ${JSON.stringify(e.data)}`
  );
};
