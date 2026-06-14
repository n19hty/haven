#!/bin/bash
# Haven — Bluetooth controller pairing.
# Launched in the background via systemd-run by POST /api/bt/scan.
# Hands off to Python immediately so we can keep a single interactive
# bluetoothctl session alive (the agent MUST stay running during pairing).
exec python3 - << 'PYEOF'
import subprocess, re, sys, time, threading

TIMEOUT = 45
# Common gamepad names reported by bluetoothctl.
GAMEPAD_RE = re.compile(
    r'Xbox|Wireless Controller|DualShock|DualSense|Pro Controller|Gamepad|Joy-Con',
    re.IGNORECASE,
)
# Matches both "[NEW] Device AA:BB:CC:DD:EE:FF Name" and "Device AA:BB:CC:DD:EE:FF Name"
DEVICE_RE = re.compile(r'Device\s+([0-9A-Fa-f:]{17})\s+(.*)')

proc = subprocess.Popen(
    ['bluetoothctl'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
)

found_mac   = [None]
found_event = threading.Event()

def _reader():
    """Read bluetoothctl output line-by-line; signal when a gamepad appears."""
    for raw in proc.stdout:
        line = raw.rstrip()
        print(line, flush=True)
        m = DEVICE_RE.search(line)
        if m and not found_mac[0]:
            mac, name = m.group(1), m.group(2).strip()
            if GAMEPAD_RE.search(name):
                found_mac[0] = mac
                found_event.set()

threading.Thread(target=_reader, daemon=True).start()

def send(cmd, delay=0.6):
    proc.stdin.write(cmd + '\n')
    proc.stdin.flush()
    time.sleep(delay)

# Bring up the adapter and register a no-PIN agent (required for gamepads).
send('power on', 1.0)
send('agent NoInputNoOutput', 0.5)
send('default-agent', 0.5)
send('scan on', 1.0)

# Periodically request the device list so we also catch controllers that were
# already discovered before we started scanning.
scan_start = time.time()
while time.time() - scan_start < TIMEOUT and not found_event.is_set():
    send('devices', 1.5)

send('scan off', 0.5)

mac = found_mac[0]
if not mac:
    print(f'[bt-pair] no controller found after {TIMEOUT}s — make sure it is in pairing mode', file=sys.stderr)
    send('quit', 0.3)
    proc.stdin.close()
    sys.exit(1)

print(f'[bt-pair] found {mac}, pairing...', flush=True)
send(f'pair {mac}',    4.0)   # allow time for the handshake
send(f'trust {mac}',   1.0)
send(f'connect {mac}', 2.0)
send('quit', 0.3)
proc.stdin.close()
proc.wait(timeout=5)
print(f'[bt-pair] done: {mac}', flush=True)
PYEOF
