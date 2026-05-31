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
plus the kiosk dependencies, clones the repo, builds the client, creates the
server's Python virtualenv, installs a `systemd` service (`haven.service`), and
sets up Chromium kiosk autostart. Reboot and the Pi comes up as the console.

If you already have a checkout on the Pi, run `bash scripts/setup-pi.sh` instead.
