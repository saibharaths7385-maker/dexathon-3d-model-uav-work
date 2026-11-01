#!/usr/bin/env python3
"""Mock Laptop 1: streams viewer frames over a minimal RFC 6455 WebSocket (stdlib only).

    python tools/mock_server.py --aircraft RQ11B --scenario DESERT
    then in the viewer: gear menu -> URL ws://127.0.0.1:8000/ws/3d-simulator -> Connect live

Fault injection for testing the viewer's live path:
    --drop 0.1                    silently skip 10% of frames
    --stall-at 20 --stall-for 8   stop sending for 8 s after 20 s (stale-data banner / watchdog)
The data is a synthetic demo mission, NOT real telemetry.
"""
import argparse, asyncio, base64, hashlib, json, math, random, struct, time
from datetime import datetime, timezone

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
ENV = {"FOREST": (8, 24, "MODERATE", 8000), "URBAN": (10, 29, "HIGH", 6000), "ASH": (12, 18, "MODERATE", 4000),
       "DESERT": (14, 41, "LIGHT", 7000), "MOUNTAIN": (18, -4, "HIGH", 9000)}
HUM = {"FOREST": 78, "URBAN": 55, "ASH": 40, "DESERT": 12, "MOUNTAIN": 60}
LAT0, LON0 = 12.97, 77.59
WP = [{"latitude": LAT0 - 420 * (1 - math.cos(k * math.pi / 2)) / 110574,
       "longitude": LON0 + 420 * math.sin(k * math.pi / 2) / (111320 * math.cos(math.radians(LAT0))),
       "altitude_m": 200} for k in (1, 2, 3, 4)]


class Mission:
    def __init__(self, aircraft, scenario):
        self.ac, self.sc = aircraft, scenario
        self.reset()

    def reset(self):
        self.t = self.dS = self.alt = 0.0
        self.seq = 0

    def frame(self, dt=0.1):
        self.t = (self.t + dt) % 110
        t = self.t
        if t < dt:
            self.dS = self.alt = 0.0
        ca = 250 if self.sc == "MOUNTAIN" else 150
        if t < 4: ph, alt, v = "INITIALIZATION", 0, 0
        elif t < 12: u = (t - 4) / 8; ph, alt, v = "TAKEOFF", (0 if u < .5 else (u - .5) * 60), 22 * u
        elif t < 26: ph, alt, v = "CLIMB", 30 + (t - 12) / 14 * (ca - 30), 22
        elif t < 80: ph, alt, v = ("ENVIRONMENT" if 30 <= t < 72 else "CRUISE"), ca, 22
        elif t < 98: ph, alt, v = "DESCENT", ca - (ca - 20) * (t - 80) / 18, 22
        else: u = (t - 98) / 12; ph, alt, v = "LANDING", 20 * (1 - u), 22 * (1 - u)
        self.dS += v * dt
        R, u = 420, self.dS / 420
        x, z = R * math.sin(u), R * (1 - math.cos(u))
        climb = (alt - self.alt) / dt; self.alt = alt
        bump = math.sin((t - 48) / 24 * math.pi) if 48 < t < 72 else 0
        dust = bump if self.sc == "DESERT" else 0; ash = bump if self.sc == "ASH" else 0
        wind, temp, turb, vis = ENV[self.sc]; eagle = self.ac == "EAGLE_EYE_MINI"
        faults = []
        if 55 < t < 68:
            faults += [{"code": "ENGINE_OVERHEAT", "message": "Engine temperature high"} if eagle else {"code": "LOW_BATTERY", "message": "Battery voltage dropping"},
                       {"code": "VIBRATION", "message": "Vibration above threshold"}]
        if max(dust, ash) > .35: faults.append({"code": "DUST_EXPOSURE", "message": "Particulate exposure zone"})
        if 40 < t < 46: faults.append({"code": "GNSS_DEGRADED", "message": "GNSS accuracy degraded"})
        self.seq += 1
        return {"protocol": 1, "seq": self.seq, "aircraft_id": self.ac, "mission_id": "MOCK", "scenario": self.sc, "phase": ph,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "flight": {"altitude_m": alt, "airspeed_ms": v, "heading_deg": (90 + math.degrees(u)) % 360,
                "pitch_deg": math.degrees(math.asin(max(-1, min(1, climb / v)))) if v > 1 else 0,
                "roll_deg": math.degrees(math.atan(v * v / (9.81 * R))) if v > 1 else 0,
                "latitude": LAT0 - z / 110574, "longitude": LON0 + x / (111320 * math.cos(math.radians(LAT0)))},
            "propulsion": {("engine_rpm" if eagle else "motor_rpm"): 0 if t < 4 else (6200 if eagle else 5200) * (.4 + .6 * v / 22),
                "battery_voltage_v": 16 - t * .012, "current_a": 12.4 if v else 0, ("engine_temp_c" if eagle else "motor_temp_c"): 35 + t * .12 + (14 if 55 < t < 68 else 0), "fuel_pct": 100 - t * .35},
            "environment": {"humidity_pct": HUM[self.sc], "wind_speed_ms": wind, "wind_dir_deg": 270, "temperature_c": temp, "turbulence": turb,
                "visibility_m": vis * (1 - .85 * max(dust, ash)), "dust": dust, "ash": ash},
            "faults": faults, "mission": {"time_s": t, "state": ph, "progress": min(1, t / 98), "wp_index": min(3, int(t // 26)), "waypoints": WP}}


def send(w, text):
    b = text.encode(); n = len(b)
    hdr = bytes([0x81, n]) if n < 126 else bytes([0x81, 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x81, 127]) + struct.pack(">Q", n)
    w.write(hdr + b)


async def read_frame(r):
    b1, b2 = await r.readexactly(2)
    op, n = b1 & 15, b2 & 127
    if n == 126: n = struct.unpack(">H", await r.readexactly(2))[0]
    elif n == 127: n = struct.unpack(">Q", await r.readexactly(8))[0]
    mask = await r.readexactly(4) if b2 & 128 else b"\0\0\0\0"
    data = bytearray(await r.readexactly(n))
    for i in range(n): data[i] ^= mask[i % 4]
    return op, bytes(data)


async def handle(r, w, a):
    try:
        head = (await r.readuntil(b"\r\n\r\n")).decode("latin1")
        key = next((l.split(":", 1)[1].strip() for l in head.split("\r\n") if l.lower().startswith("sec-websocket-key")), None)
        if not key:
            w.write(b"HTTP/1.1 200 OK\r\nContent-Length: 17\r\n\r\nSKYNEX mock server"); await w.drain(); return
        acc = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        w.write(f"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {acc}\r\n\r\n".encode()); await w.drain()
        m = Mission(a.aircraft, a.scenario); st = {"pause": False, "speed": 1.0}; t0 = time.time()

        async def pump():
            while True:
                await asyncio.sleep(0.1 / st["speed"])
                el = time.time() - t0
                if st["pause"] or (a.stall_at is not None and a.stall_at <= el < a.stall_at + a.stall_for): continue
                f = m.frame()
                if random.random() >= a.drop: send(w, json.dumps(f)); await w.drain()
        task = asyncio.create_task(pump())
        try:
            while True:
                op, data = await read_frame(r)
                if op == 8: break
                if op == 9: w.write(bytes([0x8A, len(data)]) + data); continue
                if op != 1: continue
                try: msg = json.loads(data)
                except ValueError: continue
                k = msg.get("type")
                if k == "hello": send(w, json.dumps({"type": "hello_ack", "protocol": 1}))
                elif k == "ping": send(w, json.dumps({"type": "pong", "t": msg.get("t")}))
                elif k == "control":
                    c = msg.get("cmd")
                    if c == "pause": st["pause"] = True
                    elif c == "resume": st["pause"] = False
                    elif c == "reset": m.reset()
                    elif c == "speed": st["speed"] = float(msg.get("value") or 1) or 1.0
                await w.drain()
        finally:
            task.cancel()
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        w.close()


async def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="127.0.0.1"); p.add_argument("--port", type=int, default=8000)
    p.add_argument("--aircraft", default="EAGLE_EYE_MINI", choices=["EAGLE_EYE_MINI", "RQ11B"])
    p.add_argument("--scenario", default="FOREST", choices=list(ENV))
    p.add_argument("--drop", type=float, default=0.0); p.add_argument("--stall-at", type=float); p.add_argument("--stall-for", type=float, default=8.0)
    a = p.parse_args()
    srv = await asyncio.start_server(lambda r, w: handle(r, w, a), a.host, a.port)
    print(f"mock server on ws://{a.host}:{a.port}/ws/3d-simulator  ({a.aircraft}, {a.scenario})  Ctrl+C to stop", flush=True)
    async with srv: await srv.serve_forever()

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
