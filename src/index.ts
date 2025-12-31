import { detect, getDevice } from "./bluetooth";
import {
  TreadmillDataEvent,
  Treadmill,
  TrainingStatusEvent,
  SessionEndedEvent,
  Session,
  ConnectionStateEvent,
} from "./treadmill";
import { TreadmillDatabase, Settings } from "./storage";
import * as echarts from "echarts";

// Element IDs
const noBluetoothDivID = "warn-no-blueooth";
const deviceNameID = "controls-device-name";
const connectButtonID = "controls-connect";
const disconnectButtonID = "controls-disconnect";
const dataSectionID = "data";
const currentStatusID = "data-current-status";
const currentSpeedID = "data-current-speed";
const targetSpeedID = "data-target-speed";
const currentDistanceID = "data-current-distance";
const currentTimeID = "data-current-time";
const currentKcalID = "data-current-kcal";

// Control elements
const dataControlsID = "data-controls";
const speedDecreaseID = "speed-decrease";
const speedIncreaseID = "speed-increase";
const speedDecreaseLargeID = "speed-decrease-large";
const speedIncreaseLargeID = "speed-increase-large";
const controlStartID = "control-start";
const controlStopID = "control-stop";

// Connection status elements
const connectionStatusID = "connection-status";
const connectionMessageID = "connection-message";
const cancelReconnectID = "controls-cancel-reconnect";

// History elements
const historyToggleID = "history-toggle";
const historyContentID = "history-content";
const historyRefreshID = "history-refresh";
const historyDeleteSelectedID = "history-delete-selected";
const historyExportCsvID = "history-export-csv";
const historyExportJsonID = "history-export-json";
const historyListID = "history-list";
const historyEmptyID = "history-empty";
const historyDetailID = "history-detail";
const historyDetailCloseID = "history-detail-close";
const historyDetailContentID = "history-detail-content";

// Goals elements (inputs are now in Settings)
const goalDistanceInputID = "goal-distance";
const goalDurationInputID = "goal-duration";
const goalsProgressID = "goals-section";
const goalDistanceCurrentID = "goal-distance-current";
const goalDistanceTargetID = "goal-distance-target";
const goalDistanceBarID = "goal-distance-bar";
const goalDurationCurrentID = "goal-duration-current";
const goalDurationTargetID = "goal-duration-target";
const goalDurationBarID = "goal-duration-bar";

// Settings elements
const settingsToggleID = "settings-toggle";
const settingsContentID = "settings-content";
const settingsWeightID = "settings-weight";
const settingsSaveID = "settings-save";

// Summary elements
const summaryToggleID = "summary-toggle";
const summaryContentID = "summary-content";
const summaryWeeklyID = "summary-weekly";
const summaryMonthlyID = "summary-monthly";
const summarySessionsID = "summary-sessions";
const summaryDistanceID = "summary-distance";
const summaryTimeID = "summary-time";
const summaryChartID = "summary-chart";

// Toast container
const toastContainerID = "toast-container";

// Cached elements
const deviceName = findElement<HTMLSpanElement>(deviceNameID);
const connectButton = findElement<HTMLButtonElement>(connectButtonID);
const disconnectButton = findElement<HTMLButtonElement>(disconnectButtonID);
const dataSection = findElement<HTMLElement>(dataSectionID);
const currentStatus = findElement<HTMLSpanElement>(currentStatusID);
const currentSpeed = findElement<HTMLSpanElement>(currentSpeedID);
const targetSpeedDisplay = findElement<HTMLSpanElement>(targetSpeedID);
const currentDistance = findElement<HTMLSpanElement>(currentDistanceID);
const currentTime = findElement<HTMLSpanElement>(currentTimeID);
const currentKcal = findElement<HTMLSpanElement>(currentKcalID);

const dataControls = findElement<HTMLDivElement>(dataControlsID);
const speedDecrease = findElement<HTMLButtonElement>(speedDecreaseID);
const speedIncrease = findElement<HTMLButtonElement>(speedIncreaseID);
const speedDecreaseLarge = findElement<HTMLButtonElement>(speedDecreaseLargeID);
const speedIncreaseLarge = findElement<HTMLButtonElement>(speedIncreaseLargeID);
const controlStart = findElement<HTMLButtonElement>(controlStartID);
const controlStop = findElement<HTMLButtonElement>(controlStopID);

const connectionStatus = findElement<HTMLSpanElement>(connectionStatusID);
const connectionMessage = findElement<HTMLDivElement>(connectionMessageID);
const cancelReconnect = findElement<HTMLButtonElement>(cancelReconnectID);

const historyToggle = findElement<HTMLButtonElement>(historyToggleID);
const historyContent = findElement<HTMLDivElement>(historyContentID);
const historyRefresh = findElement<HTMLButtonElement>(historyRefreshID);
const historyDeleteSelected = findElement<HTMLButtonElement>(historyDeleteSelectedID);
const historyExportCsv = findElement<HTMLButtonElement>(historyExportCsvID);
const historyExportJson = findElement<HTMLButtonElement>(historyExportJsonID);
const historyList = findElement<HTMLDivElement>(historyListID);
const historyEmpty = findElement<HTMLParagraphElement>(historyEmptyID);
const historyDetail = findElement<HTMLDivElement>(historyDetailID);
const historyDetailClose = findElement<HTMLButtonElement>(historyDetailCloseID);
const historyDetailContent = findElement<HTMLDivElement>(historyDetailContentID);

const goalDistanceInput = findElement<HTMLInputElement>(goalDistanceInputID);
const goalDurationInput = findElement<HTMLInputElement>(goalDurationInputID);
const goalsProgress = findElement<HTMLDivElement>(goalsProgressID);
const goalDistanceCurrent = findElement<HTMLSpanElement>(goalDistanceCurrentID);
const goalDistanceTarget = findElement<HTMLSpanElement>(goalDistanceTargetID);
const goalDistanceBar = findElement<HTMLProgressElement>(goalDistanceBarID);
const goalDurationCurrent = findElement<HTMLSpanElement>(goalDurationCurrentID);
const goalDurationTarget = findElement<HTMLSpanElement>(goalDurationTargetID);
const goalDurationBar = findElement<HTMLProgressElement>(goalDurationBarID);

const settingsToggle = findElement<HTMLButtonElement>(settingsToggleID);
const settingsContent = findElement<HTMLDivElement>(settingsContentID);
const settingsWeight = findElement<HTMLInputElement>(settingsWeightID);
const settingsSave = findElement<HTMLButtonElement>(settingsSaveID);

const summaryToggle = findElement<HTMLButtonElement>(summaryToggleID);
const summaryContent = findElement<HTMLDivElement>(summaryContentID);
const summaryWeekly = findElement<HTMLButtonElement>(summaryWeeklyID);
const summaryMonthly = findElement<HTMLButtonElement>(summaryMonthlyID);
const summarySessions = findElement<HTMLElement>(summarySessionsID);
const summaryDistance = findElement<HTMLElement>(summaryDistanceID);
const summaryTime = findElement<HTMLElement>(summaryTimeID);

const toastContainer = findElement<HTMLDivElement>(toastContainerID);

let treadmill: Treadmill | null = null;
let db: TreadmillDatabase;
let currentSettings: Settings;
let selectedSessionIds: Set<number> = new Set();
let distanceGoalAlerted = false;
let durationGoalAlerted = false;

function findElement<T extends Element>(id: string): T {
  const e = document.querySelector<T>(`#${id}`);
  if (!e) {
    throw new Error(`element not found: ${id}`);
  }
  return e;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}`;
  }
  return `${m}:00`;
}

// Toggle collapsible sections
function setupToggle(toggle: HTMLButtonElement, content: HTMLElement) {
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", (!expanded).toString());
    toggle.textContent = toggle.textContent?.replace(expanded ? "▼" : "▶", expanded ? "▶" : "▼") || "";
    content.classList.toggle("hidden");
  });
}

// Toast notification system
type ToastType = "success" | "error" | "warning" | "info" | "goal";

function showToast(message: string, type: ToastType = "info", duration: number = 3000) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function playAlertSound(frequency: number = 800, duration: number = 200) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, duration);
  } catch (e) {
    // Audio not supported, ignore
  }
}

function vibrate(pattern: number | number[] = 200) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function alertGoalReached(goalType: "distance" | "duration") {
  const message = goalType === "distance" ? "Distance goal reached!" : "Duration goal reached!";
  showToast(message, "goal", 5000);
  playAlertSound(1000, 300);
  vibrate([200, 100, 200]);
}

function alertSessionStarted() {
  showToast("Workout started", "success");
}

function alertSessionEnded() {
  showToast("Workout complete!", "success", 4000);
  playAlertSound(600, 150);
}

// Session History
async function loadSessions(): Promise<Session[]> {
  return await db.session.orderBy("started").reverse().toArray();
}

async function renderSessionList() {
  const sessions = await loadSessions();
  selectedSessionIds.clear();
  updateDeleteButton();

  if (sessions.length === 0) {
    historyEmpty.classList.remove("hidden");
    // Remove any existing session items
    historyList.querySelectorAll(".session-item").forEach((el) => el.remove());
    return;
  }

  historyEmpty.classList.add("hidden");
  historyList.querySelectorAll(".session-item").forEach((el) => el.remove());

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item";
    item.dataset.sessionId = session.id?.toString();

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selectedSessionIds.add(session.id!);
      } else {
        selectedSessionIds.delete(session.id!);
      }
      updateDeleteButton();
    });

    const info = document.createElement("div");
    info.className = "session-item-info";

    const date = document.createElement("div");
    date.className = "session-item-date";
    date.textContent = formatDate(session.started);

    const stats = document.createElement("div");
    stats.className = "session-item-stats";
    stats.textContent = `${formatDuration(session.duration)} · ${session.distance.toFixed(2)} mi · ${session.averageSpeed.toFixed(1)} mph avg`;

    info.appendChild(date);
    info.appendChild(stats);

    item.appendChild(checkbox);
    item.appendChild(info);

    item.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).tagName !== "INPUT") {
        showSessionDetail(session);
      }
    });

    historyList.appendChild(item);
  });
}

function showSessionDetail(session: Session) {
  historyList.classList.add("hidden");
  historyDetail.classList.remove("hidden");

  historyDetailContent.innerHTML = `
    <div class="detail-row"><span>Date</span><span>${formatDate(session.started)}</span></div>
    <div class="detail-row"><span>Duration</span><span>${formatDuration(session.duration)}</span></div>
    <div class="detail-row"><span>Distance</span><span>${session.distance.toFixed(2)} miles</span></div>
    <div class="detail-row"><span>Average Speed</span><span>${session.averageSpeed.toFixed(1)} mph</span></div>
    <div class="detail-row"><span>Calories</span><span>${session.energyExpended} kcal</span></div>
    <div class="detail-row"><span>Started</span><span>${formatDate(session.started)}</span></div>
    <div class="detail-row"><span>Ended</span><span>${formatDate(session.ended)}</span></div>
    <div class="chart-container" id="session-chart"></div>
  `;

  // Load chart data if ECharts is available
  loadSessionChart(session);
}

async function loadSessionChart(session: Session) {
  const dataPoints = await db.treadmillData
    .where("timestamp")
    .between(session.started, session.ended)
    .toArray();

  if (dataPoints.length === 0) return;

  const chartContainer = document.getElementById("session-chart");
  if (!chartContainer) return;

  const chart = echarts.init(chartContainer);
  const times = dataPoints.map((d) => formatDuration(d.elapsedTime));
  const speeds = dataPoints.map((d) => d.speed);
  const distances = dataPoints.map((d) => d.distance);

  chart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["Speed (mph)", "Distance (mi)"] },
    xAxis: { type: "category", data: times },
    yAxis: [
      { type: "value", name: "Speed (mph)", position: "left" },
      { type: "value", name: "Distance (mi)", position: "right" },
    ],
    series: [
      { name: "Speed (mph)", type: "line", data: speeds, smooth: true },
      { name: "Distance (mi)", type: "line", data: distances, yAxisIndex: 1, smooth: true },
    ],
  });

  window.addEventListener("resize", () => chart.resize());
}

function hideSessionDetail() {
  historyDetail.classList.add("hidden");
  historyList.classList.remove("hidden");
}

function updateDeleteButton() {
  historyDeleteSelected.disabled = selectedSessionIds.size === 0;
}

async function deleteSelectedSessions() {
  if (selectedSessionIds.size === 0) return;
  if (!confirm(`Delete ${selectedSessionIds.size} session(s)?`)) return;

  await db.session.bulkDelete([...selectedSessionIds]);
  await renderSessionList();
}

// Export functions
function exportSessionsCsv(sessions: Session[]) {
  const headers = ["id", "started", "ended", "duration", "distance", "averageSpeed", "energyExpended"];
  const rows = sessions.map((s) => [
    s.id,
    new Date(s.started).toISOString(),
    new Date(s.ended).toISOString(),
    s.duration,
    s.distance,
    s.averageSpeed,
    s.energyExpended,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, "sessions.csv", "text/csv");
}

function exportSessionsJson(sessions: Session[]) {
  const json = JSON.stringify(sessions, null, 2);
  downloadFile(json, "sessions.json", "application/json");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Goals
function updateGoalsFromSettings() {
  if (currentSettings.goalDistanceMiles) {
    goalDistanceInput.value = currentSettings.goalDistanceMiles.toString();
  }
  if (currentSettings.goalDurationMinutes) {
    goalDurationInput.value = currentSettings.goalDurationMinutes.toString();
  }
  updateGoalsVisibility();
}

function updateGoalsVisibility() {
  const hasDistanceGoal = currentSettings.goalDistanceMiles !== null && currentSettings.goalDistanceMiles > 0;
  const hasDurationGoal = currentSettings.goalDurationMinutes !== null && currentSettings.goalDurationMinutes > 0;

  // Update target display values
  if (hasDistanceGoal) {
    goalDistanceTarget.textContent = currentSettings.goalDistanceMiles!.toFixed(1);
  } else {
    goalDistanceTarget.textContent = "0";
  }
  if (hasDurationGoal) {
    goalDurationTarget.textContent = formatMinutes(currentSettings.goalDurationMinutes!);
  } else {
    goalDurationTarget.textContent = "0:00";
  }
}

async function saveGoals() {
  const distanceValue = parseFloat(goalDistanceInput.value);
  const durationValue = parseInt(goalDurationInput.value, 10);

  await db.saveSettings({
    goalDistanceMiles: isNaN(distanceValue) || distanceValue <= 0 ? null : distanceValue,
    goalDurationMinutes: isNaN(durationValue) || durationValue <= 0 ? null : durationValue,
  });
  currentSettings = await db.getSettings();
  updateGoalsVisibility();
}

async function clearGoals() {
  goalDistanceInput.value = "";
  goalDurationInput.value = "";
  await db.saveSettings({
    goalDistanceMiles: null,
    goalDurationMinutes: null,
  });
  currentSettings = await db.getSettings();
  updateGoalsVisibility();
}

function updateGoalProgress(distance: number, elapsedTimeSeconds: number) {
  if (currentSettings.goalDistanceMiles && currentSettings.goalDistanceMiles > 0) {
    goalDistanceCurrent.textContent = distance.toFixed(2);
    const percent = Math.min(100, (distance / currentSettings.goalDistanceMiles) * 100);
    goalDistanceBar.value = percent;
    if (percent >= 100) {
      goalDistanceCurrent.parentElement?.classList.add("goal-reached");
      if (!distanceGoalAlerted) {
        distanceGoalAlerted = true;
        alertGoalReached("distance");
      }
    }
  }

  if (currentSettings.goalDurationMinutes && currentSettings.goalDurationMinutes > 0) {
    const elapsedMinutes = elapsedTimeSeconds / 60;
    goalDurationCurrent.textContent = formatDuration(elapsedTimeSeconds);
    const percent = Math.min(100, (elapsedMinutes / currentSettings.goalDurationMinutes) * 100);
    goalDurationBar.value = percent;
    if (percent >= 100) {
      goalDurationCurrent.parentElement?.classList.add("goal-reached");
      if (!durationGoalAlerted) {
        durationGoalAlerted = true;
        alertGoalReached("duration");
      }
    }
  }
}

function resetGoalProgress() {
  goalDistanceCurrent.textContent = "0";
  goalDurationCurrent.textContent = "0:00";
  goalDistanceBar.value = 0;
  goalDurationBar.value = 0;
  goalDistanceCurrent.parentElement?.classList.remove("goal-reached");
  goalDurationCurrent.parentElement?.classList.remove("goal-reached");
  distanceGoalAlerted = false;
  durationGoalAlerted = false;
}

// Settings
function updateSettingsFromDb() {
  if (currentSettings.weightLbs > 0) {
    settingsWeight.value = currentSettings.weightLbs.toString();
  }
}

async function saveUserSettings() {
  const weightValue = parseFloat(settingsWeight.value);
  await db.saveSettings({
    weightLbs: isNaN(weightValue) || weightValue <= 0 ? 0 : weightValue,
  });
  currentSettings = await db.getSettings();
  showToast("Settings saved!", "success");
}

// Summary Charts
let summaryChart: echarts.ECharts | null = null;
let summaryPeriod: "weekly" | "monthly" = "weekly";

async function loadSummaryChart() {
  const sessions = await loadSessions();
  if (sessions.length === 0) {
    summarySessions.textContent = "0";
    summaryDistance.textContent = "0";
    summaryTime.textContent = "0:00";
    return;
  }

  // Group sessions by period
  const now = Date.now();
  const periodMs = summaryPeriod === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const periods: { [key: string]: { sessions: number; distance: number; duration: number } } = {};

  // Get data for the last 8 weeks or 6 months
  const numPeriods = summaryPeriod === "weekly" ? 8 : 6;
  const periodStart = now - numPeriods * periodMs;

  sessions
    .filter((s) => s.started >= periodStart)
    .forEach((s) => {
      const periodIndex = Math.floor((now - s.started) / periodMs);
      const periodKey = summaryPeriod === "weekly"
        ? `Week -${periodIndex}`
        : `Month -${periodIndex}`;

      if (!periods[periodKey]) {
        periods[periodKey] = { sessions: 0, distance: 0, duration: 0 };
      }
      periods[periodKey].sessions++;
      periods[periodKey].distance += s.distance;
      periods[periodKey].duration += s.duration;
    });

  // Calculate totals for recent period
  const recentPeriodKey = summaryPeriod === "weekly" ? "Week -0" : "Month -0";
  const recent = periods[recentPeriodKey] || { sessions: 0, distance: 0, duration: 0 };
  summarySessions.textContent = recent.sessions.toString();
  summaryDistance.textContent = recent.distance.toFixed(2);
  summaryTime.textContent = formatDuration(recent.duration);

  // Create chart data
  const labels: string[] = [];
  const distanceData: number[] = [];
  const durationData: number[] = [];

  for (let i = numPeriods - 1; i >= 0; i--) {
    const key = summaryPeriod === "weekly" ? `Week -${i}` : `Month -${i}`;
    labels.push(i === 0 ? "Current" : summaryPeriod === "weekly" ? `-${i}w` : `-${i}m`);
    const data = periods[key] || { sessions: 0, distance: 0, duration: 0 };
    distanceData.push(Math.round(data.distance * 100) / 100);
    durationData.push(Math.round(data.duration / 60)); // Convert to minutes
  }

  const chartContainer = document.getElementById(summaryChartID);
  if (!chartContainer) return;

  if (summaryChart) {
    summaryChart.dispose();
  }

  summaryChart = echarts.init(chartContainer);
  summaryChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["Distance (mi)", "Duration (min)"] },
    xAxis: { type: "category", data: labels },
    yAxis: [
      { type: "value", name: "Distance (mi)", position: "left" },
      { type: "value", name: "Duration (min)", position: "right" },
    ],
    series: [
      { name: "Distance (mi)", type: "bar", data: distanceData },
      { name: "Duration (min)", type: "bar", data: durationData, yAxisIndex: 1 },
    ],
  });

  window.addEventListener("resize", () => summaryChart?.resize());
}

function setSummaryPeriod(period: "weekly" | "monthly") {
  summaryPeriod = period;
  summaryWeekly.classList.toggle("active", period === "weekly");
  summaryMonthly.classList.toggle("active", period === "monthly");
  loadSummaryChart();
}

// Calorie calculation using MET formula
function calculateCalories(weightLbs: number, speedMph: number, durationMinutes: number): number {
  if (weightLbs <= 0) return 0;
  // MET values for walking/running at different speeds
  // https://sites.google.com/site/compendiumofphysicalactivities/
  let met: number;
  if (speedMph < 2.0) met = 2.0;
  else if (speedMph < 2.5) met = 2.5;
  else if (speedMph < 3.0) met = 3.0;
  else if (speedMph < 3.5) met = 3.5;
  else if (speedMph < 4.0) met = 4.3;
  else if (speedMph < 4.5) met = 5.0;
  else if (speedMph < 5.0) met = 8.3;
  else if (speedMph < 6.0) met = 9.8;
  else if (speedMph < 7.0) met = 11.0;
  else met = 12.5;

  const weightKg = weightLbs * 0.453592;
  return Math.round((met * weightKg * durationMinutes) / 60);
}

// Connection state handler
function onConnectionStateChanged(e: Event) {
  const event = e as unknown as ConnectionStateEvent;
  const { state, attempt } = event.detail;

  // Update status indicator
  connectionStatus.className = `status-${state}`;

  // Update message and show toasts
  switch (state) {
    case "disconnected":
      connectionMessage.classList.add("hidden");
      cancelReconnect.classList.add("hidden");
      showToast("Disconnected from treadmill", "warning");
      break;
    case "connecting":
      connectionMessage.textContent = "Connecting...";
      connectionMessage.classList.remove("hidden");
      cancelReconnect.classList.add("hidden");
      break;
    case "connected":
      connectionMessage.classList.add("hidden");
      cancelReconnect.classList.add("hidden");
      showToast("Connected to treadmill", "success");
      break;
    case "reconnecting":
      connectionMessage.textContent = `Reconnecting... (attempt ${attempt}/5)`;
      connectionMessage.classList.remove("hidden");
      cancelReconnect.classList.remove("hidden");
      if (attempt === 1) {
        showToast("Connection lost, attempting to reconnect...", "warning");
      }
      break;
  }
}

function onTreadmillReconnected() {
  // Re-show controls if they were visible before
  if (treadmill?.hasControlPoint) {
    dataControls.classList.remove("hidden");
    updateControlButtons();
  }
  showToast("Reconnected to treadmill!", "success");
}

function handleCancelReconnect() {
  treadmill?.cancelReconnect();
  onTreadmillDisconnected();
}

// Connection handlers
function connectButtonClickListener(worker: Worker) {
  return async () => {
    connectButton.disabled = true;
    try {
      const d = await getDevice();
      treadmill = new Treadmill(d);
      await treadmill.connect();
      dataSection.classList.remove("hidden");
      deviceName.textContent = treadmill.name;
      connectButton.classList.add("hidden");
      disconnectButton.disabled = false;
      disconnectButton.classList.remove("hidden");
      resetGoalProgress();

      // Show controls if control point is available
      if (treadmill.hasControlPoint) {
        dataControls.classList.remove("hidden");
        updateControlButtons();
        // Show initial target speed
        targetSpeedDisplay.textContent = treadmill.targetSpeed.toFixed(1);
      }
    } catch (e) {
      connectButton.disabled = false;
      console.error("treadmill failed to connect: ", e);
    }
  };
}

function updateControlButtons() {
  if (!treadmill) return;
  const isRunning = treadmill.status === "Manual Mode (Quick Start)";
  controlStart.classList.toggle("hidden", isRunning);
  controlStop.classList.toggle("hidden", !isRunning);
}

async function handleStart() {
  if (!treadmill) return;
  controlStart.disabled = true;
  const success = await treadmill.start();
  if (!success) {
    console.error("Failed to start treadmill");
  }
  controlStart.disabled = false;
}

async function handleStop() {
  if (!treadmill) return;
  controlStop.disabled = true;
  const success = await treadmill.stop();
  if (!success) {
    console.error("Failed to stop treadmill");
  }
  controlStop.disabled = false;
}

async function handleSpeedDecrease() {
  console.log("[UI] Speed decrease clicked, treadmill:", !!treadmill);
  if (!treadmill) return;
  speedDecrease.disabled = true;
  await treadmill.decreaseSpeed(0.1);
  console.log("[UI] New target speed:", treadmill.targetSpeed);
  speedDecrease.disabled = false;
}

async function handleSpeedIncrease() {
  console.log("[UI] Speed increase clicked, treadmill:", !!treadmill);
  if (!treadmill) return;
  speedIncrease.disabled = true;
  await treadmill.increaseSpeed(0.1);
  console.log("[UI] New target speed:", treadmill.targetSpeed);
  speedIncrease.disabled = false;
}

async function handleSpeedDecreaseLarge() {
  console.log("[UI] Speed decrease large clicked, treadmill:", !!treadmill);
  if (!treadmill) return;
  speedDecreaseLarge.disabled = true;
  await treadmill.decreaseSpeed(0.5);
  console.log("[UI] New target speed:", treadmill.targetSpeed);
  speedDecreaseLarge.disabled = false;
}

async function handleSpeedIncreaseLarge() {
  console.log("[UI] Speed increase large clicked, treadmill:", !!treadmill);
  if (!treadmill) return;
  speedIncreaseLarge.disabled = true;
  await treadmill.increaseSpeed(0.5);
  console.log("[UI] New target speed:", treadmill.targetSpeed);
  speedIncreaseLarge.disabled = false;
}

function treadmillDataEventListener(worker: Worker) {
  return (e: Event) => {
    const d = e as unknown as TreadmillDataEvent;
    worker.postMessage(d.detail);
    currentSpeed.textContent = d.detail.speed.toFixed(1);
    currentDistance.textContent = d.detail.distance.toFixed(2);
    currentTime.textContent = d.detail.formattedTime;

    // Update calorie display with calculated value if we have weight
    if (currentSettings.weightLbs > 0) {
      const calculatedKcal = calculateCalories(
        currentSettings.weightLbs,
        d.detail.speed,
        d.detail.elapsedTime / 60
      );
      currentKcal.textContent = calculatedKcal.toString();
    } else {
      currentKcal.textContent = d.detail.kcal.toString();
    }

    // Update goal progress
    updateGoalProgress(d.detail.distance, d.detail.elapsedTime);
  };
}

function onTreadmillDisconnected() {
  treadmill = null;
  deviceName.textContent = "nothing";
  dataSection.classList.add("hidden");
  dataControls.classList.add("hidden");
  disconnectButton.disabled = true;
  disconnectButton.classList.add("hidden");
  connectButton.classList.remove("hidden");
  connectButton.disabled = false;
}

function trainingStatusEventListener(worker: Worker) {
  return (e: Event) => {
    const d = e as unknown as TrainingStatusEvent;
    worker.postMessage(d.detail);
    currentStatus.textContent = d.detail.stringFromStatus;
    if (d.detail.stringFromStatus === "Idle") {
      idle();
    }
    if (d.detail.stringFromStatus === "Pre-Workout") {
      alertSessionStarted();
    }
    updateControlButtons();
  };
}

function sessionEndedEventListener(worker: Worker) {
  return (e: Event) => {
    const d = e as unknown as SessionEndedEvent;
    console.log("session ended", d.detail);
    worker.postMessage(d.detail);
    alertSessionEnded();
    // Refresh session list if history is open
    if (!historyContent.classList.contains("hidden")) {
      renderSessionList();
    }
  };
}

function idle() {
  currentStatus.innerText = "Idle";
  currentSpeed.innerText = "0";
  currentDistance.innerText = "0";
  currentTime.innerText = "0:00:00";
  currentKcal.innerText = "0";
  resetGoalProgress();
}

// Initialize
(async function () {
  if (!(await detect())) {
    document.querySelector(`#${noBluetoothDivID}`)?.classList.remove("hidden");
    throw new Error("webbluetooth not supported");
  }

  // Initialize database
  db = new TreadmillDatabase();
  currentSettings = await db.getSettings();

  // @ts-expect-error 1343
  const worker = new Worker(new URL("storage-worker.ts", import.meta.url), {
    type: "module",
  });

  // Set up event listeners
  document.addEventListener("treadmilldisconnected", onTreadmillDisconnected);
  document.addEventListener("treadmilldata", treadmillDataEventListener(worker));
  document.addEventListener("trainingstatuschanged", trainingStatusEventListener(worker));
  document.addEventListener("sessionended", sessionEndedEventListener(worker));
  document.addEventListener("connectionstatechanged", onConnectionStateChanged);
  document.addEventListener("treadmillreconnected", onTreadmillReconnected);
  document.addEventListener("targetspeedchanged", (e) => {
    const speed = (e as CustomEvent<number>).detail;
    targetSpeedDisplay.textContent = speed.toFixed(1);
  });
  connectButton.addEventListener("click", connectButtonClickListener(worker));
  disconnectButton.addEventListener("click", () => {
    treadmill?.disconnect();
  });
  cancelReconnect.addEventListener("click", handleCancelReconnect);
  connectButton.disabled = false;

  // Control button handlers
  controlStart.addEventListener("click", handleStart);
  controlStop.addEventListener("click", handleStop);
  speedDecrease.addEventListener("click", handleSpeedDecrease);
  speedIncrease.addEventListener("click", handleSpeedIncrease);
  speedDecreaseLarge.addEventListener("click", handleSpeedDecreaseLarge);
  speedIncreaseLarge.addEventListener("click", handleSpeedIncreaseLarge);

  // Set up collapsible sections
  setupToggle(historyToggle, historyContent);
  setupToggle(settingsToggle, settingsContent);
  setupToggle(summaryToggle, summaryContent);

  // History handlers
  historyToggle.addEventListener("click", () => {
    // Check if NOT hidden (was just opened by setupToggle)
    if (!historyContent.classList.contains("hidden")) {
      renderSessionList();
    }
  });
  historyRefresh.addEventListener("click", renderSessionList);
  historyDeleteSelected.addEventListener("click", deleteSelectedSessions);
  historyDetailClose.addEventListener("click", hideSessionDetail);
  historyExportCsv.addEventListener("click", async () => {
    const sessions = await loadSessions();
    exportSessionsCsv(sessions);
  });
  historyExportJson.addEventListener("click", async () => {
    const sessions = await loadSessions();
    exportSessionsJson(sessions);
  });

  // Goals handlers
  goalDistanceInput.addEventListener("change", saveGoals);
  goalDurationInput.addEventListener("change", saveGoals);
  updateGoalsFromSettings();

  // Settings handlers
  settingsSave.addEventListener("click", saveUserSettings);
  updateSettingsFromDb();

  // Summary handlers
  summaryToggle.addEventListener("click", () => {
    // Check if NOT hidden (was just opened by setupToggle)
    if (!summaryContent.classList.contains("hidden")) {
      loadSummaryChart();
    }
  });
  summaryWeekly.addEventListener("click", () => setSummaryPeriod("weekly"));
  summaryMonthly.addEventListener("click", () => setSummaryPeriod("monthly"));

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    // @ts-expect-error - Parcel requires URL constructor for service workers
    navigator.serviceWorker.register(new URL("sw.js", import.meta.url), { type: "module" }).then(
      (registration: ServiceWorkerRegistration) => {
        console.log("Service Worker registered:", registration.scope);
      },
      (error: Error) => {
        console.error("Service Worker registration failed:", error);
      }
    );
  }
})();
