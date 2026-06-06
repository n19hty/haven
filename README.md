# Haven

A home gaming console platform for the Raspberry Pi. The Pi boots into a TV
console dashboard; players join from their phones as controllers.

## Stack

- `packages/server` — Python: FastAPI + python-socketio (port 3001). Serves the
  realtime channel, the `/api/games` endpoint, and the built client.
- `packages/client` — React + Vite (port 3000 dev, served from 3001 in production)
- `packages/shared` — shared TypeScript types (`@haven/shared`), consumed by the client
- `games/` — game plugins (`games/<name>/server.py`), loaded dynamically at runtime. Ships with Tic-Tac-Toe; other games can stay local (gitignored)

## Development

```bash
npm install                 # client + shared dependencies
npm run server:install      # create packages/server/.venv and install Python deps

npm run dev     # client on :3000 (proxying to the server), server on :3001
npm run build   # build the client into packages/client/dist
```

The client (the TV dashboard and phone controllers) runs in the browser, so it
stays JS/TS and is compiled by Vite. The server is Python — see
`packages/server/README.md` for running it standalone and for the game-plugin format.

## Deploy to a Raspberry Pi

On a fresh Raspberry Pi OS install, bootstrap straight from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/n19hty/haven/main/scripts/bootstrap-pi.sh \
  | bash -s -- https://github.com/n19hty/haven.git
```

This installs Node 20 (to build the client) and Python 3 (the server runtime)
plus the kiosk dependencies (`cage`, Chromium, `bluez`), clones the repo, builds
the client, creates the server's Python virtualenv, installs a `systemd` service
(`haven.service`), and configures a **console kiosk**: the Pi boots to a plain
console (no desktop), autologs in on tty1, and launches the UI full-screen in
`cage` (a minimal Wayland compositor) via `scripts/kiosk.sh`. Reboot and the Pi
comes up as the console. SSH stays on for administration.

If you already have a checkout on the Pi, run `bash scripts/setup-pi.sh` instead.

### Updating a deployed device

Nothing auto-updates. Push your changes to `main`, then run the updater over SSH:

```bash
ssh pi@<haven-ip> 'cd ~/haven && bash scripts/haven-update.sh'
```

It records the running commit, fast-forwards `main`, rebuilds, restarts the
server, reloads the kiosk, and health-checks the server. If the new build
doesn't come up healthy it **rolls back to the previous commit** automatically,
so the console keeps running the last good version. To revert manually:

```bash
ssh pi@<haven-ip> 'cd ~/haven && bash scripts/haven-rollback.sh'
```

To get a normal desktop back on the device: `sudo systemctl set-default
graphical.target` (the kiosk only launches on tty1, so SSH is never affected).
