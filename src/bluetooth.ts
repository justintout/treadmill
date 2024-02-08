export const GenericAccessService = 0x1800; //6144; // 0x1800
export const DeviceNameCharacteristic = 0x2a00; //10752; // 0x2a00

export const FitnessMachineService = 0x1826; // 6182; // 0x1826
export const TreadmillDataCharacteristic = 0x2acd; //10957; // 0x2acd
export const TrainingStatusCharacteristic = 10963; // 0x2ad3
export const FitnessMachineStatusCharacteristic = 10970; // 0x2ada

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
  if (d?.gatt?.connected) d.gatt.disconnect;
}

export async function discover(
  s: BluetoothRemoteGATTServer
): Promise<DeviceProfile> {
  let genericAccess: BluetoothRemoteGATTService;
  let deviceName: BluetoothRemoteGATTCharacteristic;
  try {
    genericAccess = await s.getPrimaryService(GenericAccessService);
    deviceName = await genericAccess.getCharacteristic(
      DeviceNameCharacteristic
    );
  } catch (e) {
    console.error(e);
    throw new Error(
      "failed to discover generic access service and associated characteristics"
    );
  }

  let fitnessMachine: BluetoothRemoteGATTService;
  let treadmillData: BluetoothRemoteGATTCharacteristic;
  let trainingStatus: BluetoothRemoteGATTCharacteristic;
  let fitnessMachineStatus: BluetoothRemoteGATTCharacteristic;
  try {
    fitnessMachine = await s.getPrimaryService(FitnessMachineService);
    treadmillData = await fitnessMachine.getCharacteristic(
      TreadmillDataCharacteristic
    );
    trainingStatus = await fitnessMachine.getCharacteristic(
      TrainingStatusCharacteristic
    );
    fitnessMachineStatus = await fitnessMachine.getCharacteristic(
      FitnessMachineStatusCharacteristic
    );
  } catch (e) {
    console.error(e);
    throw new Error(
      "failed to discover fitness machine service and associated characteristics"
    );
  }

  return {
    genericAccess: {
      service: genericAccess,
      deviceName,
    },
    fitnessMachine: {
      service: fitnessMachine,
      treadmillData,
      trainingStatus,
      fitnessMachineStatus,
    },
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

type TreadmillNotificationData = {
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
