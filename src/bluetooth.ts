export const GenericAccessService = 0x1800; //6144; // 0x1800
export const DeviceNameCharacteristic = 0x2a00; //10752; // 0x2a00

export const FitnessMachineService = 0x1826; // 6182; // 0x1826
export const TreadmillDataCharacteristic = 0x2acd; //10957; // 0x2acd
export const TrainingStatusCharacteristic = 10963; // 0x2ad3
export const FitnessMachineStatusCharacteristic = 10970; // 0x2ada
export const FitnessMachineControlPointCharacteristic = 0x2ad9; // Control Point
export const FitnessMachineFeatureCharacteristic = 0x2acc; // Fitness Machine Feature

export type BluetoothRemoteGATTNotificationEvent = {
  target: {
    value: DataView;
  };
};

export type DeviceProfile = {
  genericAccess: {
    service: BluetoothRemoteGATTService;
    deviceName: BluetoothRemoteGATTCharacteristic;
  };
  fitnessMachine: {
    service: BluetoothRemoteGATTService;
    treadmillData: BluetoothRemoteGATTCharacteristic;
    trainingStatus: BluetoothRemoteGATTCharacteristic;
    fitnessMachineStatus: BluetoothRemoteGATTCharacteristic;
    controlPoint?: BluetoothRemoteGATTCharacteristic;
    feature?: BluetoothRemoteGATTCharacteristic;
  };
};

export async function detect() {
  return await navigator?.bluetooth?.getAvailability();
}

export async function getDevice() {
  return await navigator?.bluetooth?.requestDevice({
    filters: [{ services: [FitnessMachineService] }],
    optionalServices: [GenericAccessService],
  });
}

export async function connect(d: BluetoothDevice) {
  if (!d.gatt) {
    return Promise.reject("no gatt available");
  }
  d.addEventListener("gattserverdisconnected", () =>
    console.error("! device disconnected")
  );
  return await d.gatt.connect();
}

export async function disconnect(d?: BluetoothDevice) {
  d?.gatt?.disconnect;
}

export async function discover(
  s: BluetoothRemoteGATTServer
): Promise<DeviceProfile> {
  console.log("[BT] Starting service discovery...");
  console.log("[BT] Device:", s.device.name, "Connected:", s.connected);

  // First, let's see what services are available
  try {
    console.log("[BT] Getting primary services...");
    const services = await s.getPrimaryServices();
    console.log("[BT] Available services:", services.length);
    for (const svc of services) {
      console.log("[BT]   Service UUID:", svc.uuid);
      try {
        const chars = await svc.getCharacteristics();
        for (const char of chars) {
          console.log("[BT]     Characteristic:", char.uuid, "Properties:", {
            read: char.properties.read,
            write: char.properties.write,
            notify: char.properties.notify,
            indicate: char.properties.indicate,
          });
        }
      } catch (e) {
        console.log("[BT]     Could not enumerate characteristics:", e);
      }
    }
  } catch (e) {
    console.warn("[BT] Could not enumerate services:", e);
  }

  // Generic Access is optional - device name comes from device.name
  let genericAccess: BluetoothRemoteGATTService | undefined;
  let deviceName: BluetoothRemoteGATTCharacteristic | undefined;
  try {
    console.log("[BT] Looking for Generic Access Service (0x1800)...");
    genericAccess = await s.getPrimaryService(GenericAccessService);
    console.log("[BT] Found Generic Access Service");
    deviceName = await genericAccess.getCharacteristic(DeviceNameCharacteristic);
    console.log("[BT] Found Device Name Characteristic");
  } catch (e) {
    console.warn("[BT] Generic Access Service not available (this is OK):", e);
  }

  let fitnessMachine: BluetoothRemoteGATTService;
  let treadmillData: BluetoothRemoteGATTCharacteristic;
  let trainingStatus: BluetoothRemoteGATTCharacteristic;
  let fitnessMachineStatus: BluetoothRemoteGATTCharacteristic | undefined;
  let controlPoint: BluetoothRemoteGATTCharacteristic | undefined;
  let feature: BluetoothRemoteGATTCharacteristic | undefined;

  try {
    console.log("[BT] Looking for Fitness Machine Service (0x1826)...");
    fitnessMachine = await s.getPrimaryService(FitnessMachineService);
    console.log("[BT] Found Fitness Machine Service");

    // List all characteristics in the service
    try {
      const chars = await fitnessMachine.getCharacteristics();
      console.log("[BT] Fitness Machine characteristics:");
      for (const char of chars) {
        console.log("[BT]   ", char.uuid, {
          read: char.properties.read,
          write: char.properties.write,
          notify: char.properties.notify,
          indicate: char.properties.indicate,
        });
      }
    } catch (e) {
      console.warn("[BT] Could not list characteristics:", e);
    }

    console.log("[BT] Looking for Treadmill Data (0x2acd)...");
    treadmillData = await fitnessMachine.getCharacteristic(TreadmillDataCharacteristic);
    console.log("[BT] Found Treadmill Data Characteristic");

    console.log("[BT] Looking for Training Status (0x2ad3)...");
    trainingStatus = await fitnessMachine.getCharacteristic(TrainingStatusCharacteristic);
    console.log("[BT] Found Training Status Characteristic");

    // Fitness Machine Status is optional
    try {
      console.log("[BT] Looking for Fitness Machine Status (0x2ada)...");
      fitnessMachineStatus = await fitnessMachine.getCharacteristic(FitnessMachineStatusCharacteristic);
      console.log("[BT] Found Fitness Machine Status Characteristic");
    } catch {
      console.warn("[BT] Fitness Machine Status characteristic not available");
    }

    // Control Point is optional
    try {
      console.log("[BT] Looking for Control Point (0x2ad9)...");
      controlPoint = await fitnessMachine.getCharacteristic(FitnessMachineControlPointCharacteristic);
      console.log("[BT] Found Control Point Characteristic - treadmill control available!");
    } catch {
      console.warn("[BT] Control Point characteristic not available - no treadmill control");
    }

    // Feature characteristic is optional
    try {
      console.log("[BT] Looking for Feature (0x2acc)...");
      feature = await fitnessMachine.getCharacteristic(FitnessMachineFeatureCharacteristic);
      console.log("[BT] Found Feature Characteristic");
    } catch {
      console.warn("[BT] Feature characteristic not available");
    }
  } catch (e) {
    console.error("[BT] Failed to discover Fitness Machine Service:", e);
    throw new Error("failed to discover fitness machine service and associated characteristics");
  }

  console.log("[BT] Service discovery complete!");
  console.log("[BT] Summary:");
  console.log("[BT]   Generic Access:", !!genericAccess);
  console.log("[BT]   Treadmill Data:", !!treadmillData);
  console.log("[BT]   Training Status:", !!trainingStatus);
  console.log("[BT]   Fitness Machine Status:", !!fitnessMachineStatus);
  console.log("[BT]   Control Point:", !!controlPoint);
  console.log("[BT]   Feature:", !!feature);

  return {
    genericAccess: {
      service: genericAccess!,
      deviceName: deviceName!,
    },
    fitnessMachine: {
      service: fitnessMachine,
      treadmillData,
      trainingStatus,
      fitnessMachineStatus: fitnessMachineStatus!,
      controlPoint,
      feature,
    },
  };
}

// FTMS Control Point Op Codes (FTMS 4.16.2)
export const ControlPointOpCode = {
  REQUEST_CONTROL: 0x00,
  RESET: 0x01,
  SET_TARGET_SPEED: 0x02,
  SET_TARGET_INCLINATION: 0x03,
  START_OR_RESUME: 0x07,
  STOP_OR_PAUSE: 0x08,
  RESPONSE_CODE: 0x80,
} as const;

// FTMS Control Point Result Codes
export const ControlPointResult = {
  SUCCESS: 0x01,
  OP_CODE_NOT_SUPPORTED: 0x02,
  INVALID_PARAMETER: 0x03,
  OPERATION_FAILED: 0x04,
  CONTROL_NOT_PERMITTED: 0x05,
} as const;

// Build control point commands
export function buildRequestControlCommand(): Uint8Array {
  return new Uint8Array([ControlPointOpCode.REQUEST_CONTROL]);
}

export function buildStartCommand(): Uint8Array {
  return new Uint8Array([ControlPointOpCode.START_OR_RESUME]);
}

export function buildStopCommand(): Uint8Array {
  // 0x01 = Stop, 0x02 = Pause
  return new Uint8Array([ControlPointOpCode.STOP_OR_PAUSE, 0x01]);
}

export function buildPauseCommand(): Uint8Array {
  return new Uint8Array([ControlPointOpCode.STOP_OR_PAUSE, 0x02]);
}

export function buildSetSpeedCommand(speedKmph: number): Uint8Array {
  // Speed in 1/100 km/h as uint16 little-endian
  const speedValue = Math.round(speedKmph * 100);
  return new Uint8Array([
    ControlPointOpCode.SET_TARGET_SPEED,
    speedValue & 0xff,
    (speedValue >> 8) & 0xff,
  ]);
}

export function parseControlPointResponse(
  data: DataView
): { opCode: number; requestOpCode: number; result: number } {
  return {
    opCode: data.getUint8(0),
    requestOpCode: data.getUint8(1),
    result: data.getUint8(2),
  };
}

//https://btprodspecificationrefs.blob.core.windows.net/gatt-specification-supplement/GATT_Specification_Supplement.pdf 3.234

// Field length, if present, in octets
const TreadmillNotificationFieldLength = {
  FLAGS: 2,
  INSTANTANEOUS_SPEED: 2, // uint16, 1/100 of km/h
  AVERAGE_SPEED: 2, // uint16, 1/100 of km/h
  TOTAL_DISTANCE: 3, // uint24, m
  INCLINATION: 2, // sint16, 1/10 of 1%, if 0x7FFF "Data Not Available"
  RAMP_ANGLE_SETTING: 2, // sint16, 1/10 of 1deg, if 0x7FFF "Data Not Available"
  POSITIVE_ELEVATION_GAIN: 2, // sint16, 1/10 of 1m
  NEGATIVE_ELEVATION_GAIN: 2, // sint16, 1/10 of 1m
  INSTANTANEOUS_PACE: 2, // uint16, s, time per 500m
  AVERAGE_PACE: 2, // uint16, s, time per 500m
  TOTAL_ENERGY: 2, // uint16, kcal (resolution 1), if 0xFFFF "Data Not Available"
  ENERGY_PER_HOUR: 2, // uint16, kcal (resolution 1), if 0xFFFF "Data Not Available"
  ENERGY_PER_MINUTE: 1, // uint8, kcal (resolution 1), if 0xFF "Data Not Available"
  HEART_RATE: 1, // uint8, bpm
  METABOLIC_EQUIVALENT: 1, // uint8
  ELAPSED_TIME: 2, // uint16, s
  REMAINING_TIME: 2, // uint16, s
  FORCE_ON_BELT: 2, // sint16, newton, if 0x7FFF "Data Not Available"
  POWER_OUTPUT: 2, // sint16, watt, if 0x7FFF "Data Not Available"
};

type TreadmillNotificationFlags = {
  instantaneousSpeed: boolean; // if false, "more data" - NOT SUPPORTED :)
  averageSpeed: boolean;
  totalDistance: boolean;
  inclinationAndRampAngle: boolean;
  elevationGain: boolean;
  instantaneousPace: boolean;
  averagePace: boolean;
  expendedEnergy: boolean;
  heartRate: boolean;
  metabolicEquivalent: boolean;
  elapsedTime: boolean;
  remainingTime: boolean;
  forceOnBeltAndPowerOutput: boolean;
};

// TODO: zeros or nulls/undefined for fields not present?
export type TreadmillNotificationData = {
  instantaneousSpeed: number;
  averageSpeed: number;
  totalDistance: number;
  inclination: number;
  rampAngleSetting: number;
  positiveElevationGain: number;
  negativeElevationGain: number;
  instantaneousPace: number;
  averagePace: number;
  totalEnergy: number;
  energyPerHour: number;
  energyPerMinute: number;
  heartRate: number;
  metabolicEquivalent: number;
  elapsedTime: number;
  remainingTime: number;
  forceOnBelt: number;
  powerOutput: number;
};

function parseTreadmillNotificationFlags(
  v: number
): TreadmillNotificationFlags {
  return {
    instantaneousSpeed: (v & (1 << 0)) != 1,
    averageSpeed: (v & (1 << 1)) != 0,
    totalDistance: (v & (1 << 2)) != 0,
    inclinationAndRampAngle: (v & (1 << 3)) != 0,
    elevationGain: (v & (1 << 4)) != 0,
    instantaneousPace: (v & (1 << 5)) != 0,
    averagePace: (v & (1 << 6)) != 0,
    expendedEnergy: (v & (1 << 7)) != 0,
    heartRate: (v & (1 << 8)) != 0,
    metabolicEquivalent: (v & (1 << 9)) != 0,
    elapsedTime: (v & (1 << 10)) != 0,
    remainingTime: (v & (1 << 11)) != 0,
    forceOnBeltAndPowerOutput: (v & (1 << 12)) != 0,
  };
}

// https://medium.com/decathlondigital/take-control-of-your-fitness-machines-6588439aeeda
export function parseTreadmillNotification(
  v: DataView
): TreadmillNotificationData {
  let pos = 0;

  const flags = parseTreadmillNotificationFlags(v.getUint16(pos, true));
  pos += TreadmillNotificationFieldLength.FLAGS;
  if (!flags.instantaneousSpeed) {
    throw new Error("multi-packet notifications not supported");
  }
  let instantaneousSpeed = v.getUint16(pos, true) / 100;
  pos += TreadmillNotificationFieldLength.INSTANTANEOUS_SPEED;

  let averageSpeed = 0;
  if (flags.averageSpeed) {
    averageSpeed = v.getUint16(pos, true) / 100;
    pos += TreadmillNotificationFieldLength.AVERAGE_SPEED;
  }

  let totalDistance = 0;
  if (flags.totalDistance) {
    totalDistance = v.getUint16(pos, true) + (v.getUint8(pos + 2) << 16);
    pos += TreadmillNotificationFieldLength.TOTAL_DISTANCE;
  }

  let inclination = 0;
  let rampAngleSetting = 0;
  if (flags.inclinationAndRampAngle) {
    inclination = v.getInt16(pos, true);
    pos += TreadmillNotificationFieldLength.INCLINATION;
    rampAngleSetting = v.getInt16(pos, true);
    pos += TreadmillNotificationFieldLength.RAMP_ANGLE_SETTING;
  }

  let positiveElevationGain = 0;
  let negativeElevationGain = 0;
  if (flags.elevationGain) {
    positiveElevationGain = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.POSITIVE_ELEVATION_GAIN;
    negativeElevationGain = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.NEGATIVE_ELEVATION_GAIN;
  }

  let instantaneousPace = 0;
  if (flags.instantaneousPace) {
    instantaneousPace = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.INSTANTANEOUS_PACE;
  }

  let averagePace = 0;
  if (flags.averagePace) {
    averagePace = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.AVERAGE_PACE;
  }

  let totalEnergy = 0;
  let energyPerHour = 0;
  let energyPerMinute = 0;
  if (flags.expendedEnergy) {
    totalEnergy = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.TOTAL_ENERGY;
    energyPerHour = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.ENERGY_PER_HOUR;
    energyPerMinute = v.getUint8(pos);
    pos += TreadmillNotificationFieldLength.ENERGY_PER_MINUTE;
  }

  let heartRate = 0;
  if (flags.heartRate) {
    heartRate = v.getUint8(pos);
    pos += TreadmillNotificationFieldLength.HEART_RATE;
  }

  let metabolicEquivalent = 0;
  if (flags.metabolicEquivalent) {
    metabolicEquivalent = v.getUint8(pos);
    pos += TreadmillNotificationFieldLength.METABOLIC_EQUIVALENT;
  }

  let elapsedTime = 0;
  if (flags.elapsedTime) {
    elapsedTime = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.ELAPSED_TIME;
  }

  let remainingTime = 0;
  if (flags.remainingTime) {
    remainingTime = v.getUint16(pos, true);
    pos += TreadmillNotificationFieldLength.REMAINING_TIME;
  }

  let forceOnBelt = 0;
  let powerOutput = 0;
  if (flags.forceOnBeltAndPowerOutput) {
    forceOnBelt = v.getInt16(pos, true);
    pos += TreadmillNotificationFieldLength.FORCE_ON_BELT;
    powerOutput = v.getInt16(pos, true);
    pos += TreadmillNotificationFieldLength.POWER_OUTPUT;
  }

  return {
    instantaneousSpeed,
    averageSpeed,
    totalDistance,
    inclination,
    rampAngleSetting,
    positiveElevationGain,
    negativeElevationGain,
    instantaneousPace,
    averagePace,
    totalEnergy,
    energyPerHour,
    energyPerMinute,
    heartRate,
    metabolicEquivalent,
    elapsedTime,
    remainingTime,
    forceOnBelt,
    powerOutput,
  };
}

// Training Status - FTMS 4.10
type TrainingStatusNotificationFlags = {
  statusString: boolean;
  extendedString: boolean; // note: long-read not supported
};

export type TrainingStatusNotificationData = {
  status: number;
  statusString: string;
  stringFromStatus: string;
};

const TrainingStatusNotificationFieldLength = {
  FLAGS: 1,
  TRAINING_STATUS: 1,
};

// FTMS 4.10.1.2
function trainingStatusFieldState(v: number) {
  switch (v) {
    case 0x00:
      return "Other";
    case 0x01:
      return "Idle";
    case 0x02:
      return "Warming Up";
    case 0x03:
      return "Low Intensity Interval";
    case 0x04:
      return "High Intensity Interval";
    case 0x05:
      return "Recovery Interval";
    case 0x06:
      return "Isometric";
    case 0x07:
      return "Heart Rate Control";
    case 0x08:
      return "Fitness Test";
    case 0x09:
      return "Speed Outside of Control Region - Low (increase speed to return to controllable region)";
    case 0x0a:
      return "Speed outside of Control Region - High (decrease speed to return to controllable region)";
    case 0x0b:
      return "Cool Down";
    case 0x0c:
      return "Watt Control";
    case 0x0d:
      return "Manual Mode (Quick Start)";
    case 0x0e:
      return "Pre-Workout";
    case 0x0f:
      return "Post-Workout";
    default:
      return "Reserved for Future Use";
  }
}

function parseTrainingStatusNotificationFlags(
  v: number
): TrainingStatusNotificationFlags {
  return {
    statusString: (v & (1 << 0)) != 1,
    extendedString: (v & (1 << 1)) != 0,
  };
}

export function parseTrainingStatusNotification(
  v: DataView
): TrainingStatusNotificationData {
  let pos = 0;
  const flags = parseTrainingStatusNotificationFlags(v.getUint8(pos));
  pos += TrainingStatusNotificationFieldLength.FLAGS;
  const status = v.getUint8(pos);
  const stringFromStatus = trainingStatusFieldState(status);
  pos += TrainingStatusNotificationFieldLength.TRAINING_STATUS;
  let statusString = "";
  if (flags.statusString) {
    if (flags.extendedString) {
      console.warn(
        "training status notification received with extended string. long-read not supported. reading only current notification."
      );
    }
    const d = new TextDecoder();
    statusString = d.decode(new DataView(v.buffer, v.byteOffset + pos));
  }

  return {
    status,
    statusString,
    stringFromStatus,
  };
}
