import { detect, getDevice } from "./bluetooth";
import {
  TreadmillDataEvent,
  Treadmill,
  TreadmillConnectedEvent,
  TrainingStatusEvent,
} from "./treadmill";

const noBluetoothDivID = "warn-no-blueooth";
const deviceNameID = "controls-device-name";
const connectButtonID = "controls-connect";
const disconnectButtonID = "controls-disconnect";
const currentStatusID = "data-current-status";
const currentSpeedID = "data-current-speed";
const currentDistanceID = "data-current-distance";
const currentTimeID = "data-current-time";
const currentKcalID = "data-current-kcal";

const deviceName = findElement<HTMLSpanElement>(deviceNameID);
const connectButton = findElement<HTMLButtonElement>(connectButtonID);
const disconnectButton = findElement<HTMLButtonElement>(disconnectButtonID);
const currentStatus = findElement<HTMLSpanElement>(currentStatusID);
const currentSpeed = findElement<HTMLSpanElement>(currentSpeedID);
const currentDistance = findElement<HTMLSpanElement>(currentDistanceID);
const currentTime = findElement<HTMLSpanElement>(currentTimeID);
const currentKcal = findElement<HTMLSpanElement>(currentKcalID);

let treadmill: Treadmill | null = null;

function findElement<T extends Element>(id: string): T {
  const e = document.querySelector<T>(`#${id}`);
  if (!e) {
    throw elementNotFoundError(id);
  }
  return e;
}

function elementNotFoundError(name: string) {
  return new Error(`element not found: ${name}`);
}

function connectButtonClickListener(worker: Worker) {
  return async () => {
    connectButton.disabled = true;
    try {
      const d = await getDevice();
      treadmill = new Treadmill(d);
      await treadmill.connect();
      deviceName.textContent = treadmill.name;
      connectButton.classList.add("hidden");
      disconnectButton.disabled = false;
      disconnectButton.classList.remove("hidden");
    } catch (e) {
      connectButton.disabled = false;
      console.error("treadmill failed to connect: ", e);
    }
  };
}

function treadmillDataEventListener(worker: Worker) {
  return (e: Event) => {
    const d = e as unknown as TreadmillDataEvent;
    worker.postMessage(d.detail);
    currentSpeed.textContent = d.detail.speed.toString();
    currentDistance.textContent = d.detail.distance.toString();
    currentTime.textContent = d.detail.formattedTime;
    currentKcal.textContent = d.detail.kcal.toString();
  };
}

function onTreadmillDisconnected() {
  treadmill = null;
  deviceName.textContent = "nothing";
  disconnectButton.disabled = true;
  disconnectButton.classList.add("hidden");
  connectButton.classList.remove("hidden");
  connectButton.disabled = false;
}

function onTrainingStatusChanged(e: Event) {
  const d = e as unknown as TrainingStatusEvent;
  currentStatus.textContent = d.detail.stringFromStatus;
}

(async function () {
  if (!(await detect())) {
    document.querySelector(`#${noBluetoothDivID}`)?.classList.remove("hidden");
    throw new Error("webbluetooth not supported");
  }
  //@ts-expect-error 1343
  const worker = new Worker(new URL("storage-worker.ts", import.meta.url), {
    type: "module",
  });
  document.addEventListener("treadmilldisconnected", onTreadmillDisconnected);
  document.addEventListener(
    "treadmilldata",
    treadmillDataEventListener(worker)
  );
  document.addEventListener("trainingstatuschanged", onTrainingStatusChanged);
  connectButton.addEventListener("click", connectButtonClickListener(worker));
  disconnectButton.addEventListener("click", () => {
    treadmill?.disconnect();
  });
  connectButton.disabled = false;
})();
