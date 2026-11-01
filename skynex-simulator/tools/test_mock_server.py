"""End-to-end check of the mock server using an independent client (pip install websockets)."""
import asyncio, json, subprocess, sys, time
import websockets

async def main():
    p = subprocess.Popen([sys.executable, "tools/mock_server.py", "--port", "8791"])
    try:
        await asyncio.sleep(1.0)
        async with websockets.connect("ws://127.0.0.1:8791/ws/3d-simulator") as ws:
            await ws.send(json.dumps({"type": "hello", "client": "test", "protocol": 1}))
            await ws.send(json.dumps({"type": "ping", "t": 123}))
            ack = pong = False; seqs = []; end = time.time() + 5
            while time.time() < end and len(seqs) < 15:
                m = json.loads(await asyncio.wait_for(ws.recv(), 2))
                if m.get("type") == "hello_ack": ack = m["protocol"] == 1
                elif m.get("type") == "pong": pong = m["t"] == 123
                elif "flight" in m:
                    assert m["protocol"] == 1 and {"altitude_m", "latitude", "longitude", "heading_deg"} <= set(m["flight"])
                    seqs.append(m["seq"])
            assert ack and pong and seqs == sorted(seqs) and len(seqs) >= 10, (ack, pong, seqs)
            await ws.send(json.dumps({"type": "control", "cmd": "pause"}))
            await asyncio.sleep(0.3)
            try:
                while True: await asyncio.wait_for(ws.recv(), 0.6)
            except asyncio.TimeoutError: pass
            else: raise AssertionError("frames kept flowing after pause")
        print("MOCK SERVER TEST OK")
    finally:
        p.terminate()

asyncio.run(main())
