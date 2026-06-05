# PR1 Spike — cage + Chromium + Bluetooth gamepad

This is a **gate**, not a feature. It proves the load-bearing assumptions of
"Haven Mode" on the actual Raspberry Pi *before* any identity rework, pairing
subsystem, or boot-target change is built on top of them. If it fails, the
primary-input premise (Bluetooth controllers read by the TV browser) collapses,
and most of Haven Mode is moot — so we find out now, for the price of one
afternoon, instead of after a week of work on a dead premise.

It is **non-destructive**: it does not change the boot target, install a service,
or touch the existing kiosk path. It runs `cage` on demand.

## What it proves

| # | Check | Pass looks like | Why it matters |
|---|-------|-----------------|----------------|
| 1 | **GPU** | WebGL renderer is a V3D / Mesa string, not `llvmpipe` / `SwiftShader` | Chromium must get hardware acceleration under cage, or the TV will jank |
| 2 | **Gamepad** | A paired controller appears in `navigator.getGamepads()` and its buttons light up on the TV | The entire input premise: pads read by the browser under Wayland/cage |
| 3 | **Audio** | A button press plays a tone over HDMI | Easy to lose once the desktop session is gone |
| 4 | **Session** | A seat / user D-Bus / audio sink exist in the launched mode (captured to `results-*.txt`) | `multi-user.target` can remove the session bus that bluez pairing + audio depend on |

## How to run (on the Pi)

The faithful test is from a **bare TTY**, because that mirrors the real "no
desktop" target condition:

1. On the Pi keyboard, switch to a text console: **Ctrl+Alt+F3**, log in.
2. Pair a controller once (you only need this for the spike):
   ```bash
   bluetoothctl
   # scan on  → wait for the controller (put it in pairing mode) → pair <MAC> → trust <MAC> → connect <MAC> → quit
   ```
3. Run the spike (first time, install deps):
   ```bash
   cd ~/haven
   bash spike/run-spike.sh --install
   ```
   Subsequent runs: `bash spike/run-spike.sh`.
4. cage launches full-screen Chromium on the test page. **Press buttons on the
   controller.** Read the four checks off the TV.
5. Quit cage (switch VTs with Ctrl+Alt+F1, or kill from another TTY). The OS-side
   facts were written to `spike/results-<timestamp>.txt`.

Quick smoke test from the desktop instead: open a terminal and run the same
command. It's less faithful (a user session already exists) but confirms the
gamepad + GPU plumbing fast.

Just want the environment facts without launching anything:
```bash
bash spike/run-spike.sh --facts
```

## The gate decision

Record the verdict in the `results-*.txt` file (the runner captures the OS facts;
you add the on-TV observations). Then:

- **All four PASS** → the premise holds. Proceed to PR2 (server identity 1→N,
  lobby rework, pairing, boot service, tests) per the eng-review plan.
- **GPU is software (llvmpipe/SwiftShader)** → investigate Chromium GPU flags /
  the V3D driver / cage GL setup before trusting the appliance perf story.
- **No gamepad in the browser** → the primary-input premise is in trouble.
  Check seat/`logind` HID permissions under cage, the `input`/`bluetooth`
  groups, and whether the pad shows up in `evdev` (`/dev/input/event*`,
  `jstest`). This is the failure the whole spike exists to catch early.
- **No audio / no session bus from a bare TTY** → the boot design needs
  `loginctl enable-linger` + a user systemd manager (or greetd/seat). That is a
  known input to PR2, confirmed here rather than discovered later.

See the eng-review design doc (`~/.gstack/projects/n19hty-haven/`,
"Eng Review Outcomes") for how this gates the rest of the work.
