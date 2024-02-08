import { detect, getDevice } from "./bluetooth";
import {
  CurrentDataEvent,
  Treadmill,
  TreadmillConnectedEvent,
} from "./treadmill";

const noBluetoothDivID = "warn-no-blueooth";

const deviceNameID = "controls-device-name";
const connectButtonID = "controls-connect";
const disconnectButtonID = "controls-disconnect";

const currentSpeedID = "data-current-speed";
const currentDistanceID = "data-current-distance";
const currentTimeID = "data-current-time";
const currentKcalID = "data-current-kcal";

(async function () {
  if (!(await detect())) {
    document.querySelector(`#${noBluetoothDivID}`)?.classList.remove("hidden");
    throw new Error("webbluetooth not supported");
  }

  let treadmill: Treadmill | null = null;

  const connectButton = findElement<HTMLButtonElement>(connectButtonID);
  const disconnectButton = findElement<HTMLButtonElement>(disconnectButtonID);
  const deviceName = findElement<HTMLSpanElement>(deviceNameID);
  const currentSpeed = findElement<HTMLSpanElement>(currentSpeedID);
  const currentDistance = findElement<HTMLSpanElement>(currentDistanceID);
  const currentTime = findElement<HTMLSpanElement>(currentTimeID);
  const currentKcal = findElement<HTMLSpanElement>(currentKcalID);

  connectButton.addEventListener("click", async () => {
    connectButton.disabled = true;
    const d = await getDevice();
    treadmill = new Treadmill(d);
    await treadmill.connect();
    deviceName.textContent = treadmill.name;
    document.addEventListener("treadmilldisconnected", () => {
      treadmill = null;
      deviceName.textContent = "nothing";
      disconnectButton.disabled = true;
      disconnectButton.classList.add("hidden");
      connectButton.classList.remove("hidden");
      connectButton.disabled = false;
    });
    document.addEventListener("currentdata", (e) => {
      const d = e as unknown as CurrentDataEvent;
      currentSpeed.textContent = d.detail.speed.toString();
      currentDistance.textContent = d.detail.distance.toString();
      currentTime.textContent = d.detail.formattedTime;
      currentKcal.textContent = d.detail.kcal.toString();
    });
    connectButton.classList.add("hidden");
    disconnectButton.disabled = false;
    disconnectButton.classList.remove("hidden");
  });

  disconnectButton.addEventListener("click", () => {
    treadmill?.disconnect();
  });

  connectButton.disabled = false;
})();

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
