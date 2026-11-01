# Frame schema (protocol 1)

Server to viewer, JSON text frames, about 10 per second. The viewer clamps values and rejects frames without `flight`.
Frames with a numeric `protocol` other than 1 are rejected and the header shows **SCHEMA MISMATCH**. Duplicate or out-of-order `seq` values are dropped and counted.

| Field | Type | Notes |
|---|---|---|
| `protocol` | number | optional; must be 1 if present |
| `seq` | number | increasing; used to drop duplicates |
| `aircraft_id` | string | `EAGLE_EYE_MINI` or `RQ11B` |
| `scenario` | string | `FOREST` `URBAN` `ASH` `DESERT` `MOUNTAIN` |
| `phase` | string | `INITIALIZATION` `TAKEOFF` `CLIMB` `ENVIRONMENT` `CRUISE` `DESCENT` `LANDING` |
| `flight` | object | `altitude_m`, `airspeed_ms`, `heading_deg`, `pitch_deg`, `roll_deg`, `latitude`, `longitude`, optional `altitude_ref` (`MSL` default or `AGL`) |
| `propulsion` | object | Raven: `motor_rpm`, `battery_voltage_v`, `current_a`, `motor_temp_c`. Eagle: `engine_rpm`, `fuel_pct`, `engine_temp_c` |
| `environment` | object | `wind_speed_ms`, `wind_dir_deg` (from), `temperature_c`, `humidity_pct`, `turbulence`, `visibility_m`, `dust` 0-1, `ash` 0-1 |
| `faults` | array | `{code, message}`; codes with icons: `ENGINE_OVERHEAT` `VIBRATION` `LOW_BATTERY` `HIGH_TEMP` `DUST_EXPOSURE` `LINK_LOSS` `GNSS_DEGRADED` |
| `mission` | object | `time_s`, `state`, `progress` 0-1, `wp_index`, `waypoints[{latitude,longitude,altitude_m}]` |

Viewer to server: `{"type":"hello"}`, `{"type":"ping","t":<ms>}` (server must echo `t` in `{"type":"pong","t":...}`; the header shows the RTT), `{"type":"control","cmd":"pause|resume|reset|speed","value":1|2}`.
Server replies to hello with `{"type":"hello_ack","protocol":1}`.
