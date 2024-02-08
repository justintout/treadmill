# Treadmill Controller

> Proof-of-concept BLE treadmill controller/data monitor using WebBluetooth

Tested with the [DBT Walking Pad Under-Desk Treadmill](https://www.amazon.com/dp/B0CHHKC94J?psc=1&ref=ppx_yo2ov_dt_b_product_details).
According to Bluetooth info this is the [**FITSHOW FS-BT-T4**](https://fitshow.co/pc/#/) "Embedded double mode" on hardware revision 1.0, software revision 1.2.6.
I don't have any plans on upgrading the software.
It's rocking Bluetooth 4.2 and works with the FITSHOW app, Kinomap, and Zwift.

This seems to conform to the [Bluetooth Fitness Machine Profile](https://www.bluetooth.com/specifications/specs/fitness-machine-profile-1-0/).
All information in this repo is based around this device, so unreserved service UUIDs might not align with any other treadmill (though this is probably a pretty generic controller).
Your results may vary and I make no guarantees about what could happen if you do no use this specific device.

## Bluetooth Profile

### Services and Characteristics

Harvested using nRF Connect.

#### Generic Access (0x1800)

##### Device Name (0x2A00)

**Properties**: `READ`

#### Device Information (0x180A)

##### Glucose Feature (0x2A51)

**Properties**: `READ`

Returns an invalid value.
Returns same value as the Sensor Location characteristic.

##### Sensor Location (0x2A5D)

**Properties**: `READ`

Returns an invalid value.
Returns same value as the Glucose Feature characteristic.

##### Serial Number String (0x2A25)

**Properties**: `READ`

##### System ID (0x2A23)

**Properties**: `READ`

Returns OUI as 0x34413646 ("4A6F").
Don't know if it's actually registered.

##### Manufacturer Name String (0x2A29)

**Properties**: `READ`

Returns `FITSHOW`.

##### Model Number String (0x2A24)

**Properties**: `READ`

Returns `FS-BT-T4`.

##### Hardware Revision String (0x2A27)

**Properties**: `READ`

Returns `1.0`.

##### Software Revision String (0x2A28)

**Properties**: `READ`

Returns `1.2.6`.
This was the software version out of the box.
I've never connected the official app and don't plan on upgrading software.

#### [Fitness Machine (0x1826)](https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/)

##### Fitness Machine Feature (0x2ACC)

**Properties**: `READ`

- Total Distance Supported
- Step Count Supported
- Resistance Level Supported
- Expended Energy Supported
- Heart Rate Measurement Supported
- Elapsed Time Supported
- Power Measurement Supported
- Target Setting Features:
  - Speed Target Setting Supported
  - Resistance Target Setting Supported
  - Power Target Setting Supported

I'm pretty sure they report supporting most of everything, even though this basic treadmill definitely does not have most of these features.
It's a generic controller so there's probably more advanced treadmills with this controller that DO actually use these features.

##### Treadmill Data (0x2ACD)

**Properties**: `NOTIFY`  
**Descriptors**: `Client Characteristic Configuration (0x2902)`

- Instantaneous Speed: X km/h
- Total Distance: X m
- Inclination: X.X%
- Ramp Angle Setting: X.X°
- Total Energy: X kcal
- Energy Per Hour: 65535 kcal
- Energy Per Minute: 255 kcal
- Heart Rate: 0 bpm
- Elapsed Time: X s

Here's the meat and potatoes.
Follow the spec and get the values.
We're using Treadmill Data (see Fitness Machine Profile 4.4.2).

Interesting the energy per hour and energy per minute are just max values.
App will need to calculate those separately.

##### Training Status (0x2AD3)

**Properties**: `NOTIFY`, `READ`
**Descriptors**: `Client Characteristic Configuration (0x2902)`

- Status: one of `Idle`, `Pre-Workout`, `Manual Mode (Quick Start)`, `PostWorkout`
- Details: always blank?

I assume other modes are used in other devices, for pre-defined speed/elevation changes and stuff.
Not used on this device.

##### Fitness Machine Status (0x2ADA)

**Properties**: `NOTIFY`
**Descriptors**: `Client Characteristic Configuration (0x2902)`

One of two for this machine, either `Fitness Machine Started or Resumed by the User` or `Fitness Machine Stopped or Paused by the User (Control Information: Stop)`.
There MAY be another notification sent when one of the programs are up (you can set time/distance/cals), but need to check spec and see if those other messages are defined.

##### Fitness Machine Control Point (0x2AD9)

**Properties**: `INDICATE`, `WRITE`
**Descriptors**: `Client Characteristic Configuration (0x2902)`

I assume this is speed control.
Haven't played with it yet.

See Fitness Machine Profile 4.4.14.
This gets complicated.
We'll likely implement a few things here:

- Request Control (4.4.14.2.1)
- Reset Procedure (4.4.14.2.2)
- Set Target Speed Procedure (4.4.14.2.3)
- Start/Resume Procedure (4.4.14.2.8)
- Stop/Pause Procedure (4.4.14.2.9)
- Set Targeted Expended Energy Procedure (4.4.14.2.10)
- Set Targeted Distance Procedure (4.4.14.2.13)
- Set Targeted Training Time Procedure (4.4.14.2.14)

Also, possibly:

- Spin Down Control (4.4.14.2.20)
- Procedure Timeout (4.4.14.3)

##### Supported Speed Range (0x2AD4)

**Properties**: `READ`

- Minimum Speed: 0.59999996 km/h - they actually mean 0.6 mph as defined by the user manual
- Maximum Speed: 3.8 km/h - they actually mean 3.8 mph as defined by the user manual
- Minimum Increment: 0.099999994 km/h - they actually mean 0.1 mph, found by the +/- button on the remote

##### Supported Resistance Level Range (0x2AD6)

**Properties**: `READ`

- Minimum Resistance Level: 0.0
- Maximum Resistance Level: 25.5
- Minimum Increment: 0.1

No idea.

##### Supported Power Range (0x2AD8)

**Properties**: `READ`

- Minimum Power: 0 W
- Maximum Power: 9999 W
- Minimum Increment: 1 W

Lol.

#### Unknown Service (0xFFF0)

##### Unknown Characteristic (0xFFF1)

**Properties**: `NOTIFY`  
**Descriptors**: `Client Characteristic Configuration (0x2902)`

Unsure what this is for.
More exploration needed.

##### Unknown Characteristic (0xFFF2)

**Properties**: `WRITE NO RESPONSE`

Unsure what this is for.
My gut tells me this sets the device name, but haven't tried.
More exploration needed.

## Research

This is an unorganized list of links, for now.

- [Big money Gist](https://gist.github.com/marcelrv/6e8f75b2aa6b3967b8159bc6a8617a47)
- [Multiple short articles trying to worth with a NordicTrack](https://taylorbowland.com/posts/treadmill-getting-data/)
- [Bluetooth Treadmill GATT (in XML :( )](https://github.com/oesmith/gatt-xml/blob/master/org.bluetooth.characteristic.treadmill_data.xml)
- [Some kind of Treadmill client](https://github.com/yvesdebeer/Treadmill-Bluetooth-IoT)
- [Short post about implmenting FTMS](https://jjmtaylor.com/post/fitness-machine-service-ftms/)
