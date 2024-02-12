import { TreadmillDatabase } from "./storage";
import { TreadmillDataEvent } from "./treadmill";

const db = new TreadmillDatabase();

onmessage = function (e: MessageEvent<TreadmillDataEvent["detail"]>) {
  console.log(e.data);
};
