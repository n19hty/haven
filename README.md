# Haven

A home gaming console platform for the Raspberry Pi. The Pi boots into a TV
console dashboard; players join from their phones as controllers.

## Stack

Monorepo via npm workspaces:

- `packages/server` — Node.js + Express + Socket.IO (port 3001)
- `packages/client` — React + Vite (port 3000 dev, served from 3001 in production)
- `packages/shared` — shared TypeScript types (`@haven/shared`)
- `games/` — game plugins, loaded dynamically at runtime (kept local for now)

## Development

```bash
npm install
npm run dev     # client on :3000, server on :3001
npm run build   # build all workspaces
```

## Deploy to a Raspberry Pi

On a fresh Raspberry Pi OS install, bootstrap straight from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/n19hty/haven/main/scripts/bootstrap-pi.sh \
  | bash -s -- https://github.com/n19hty/haven.git
```

This installs Node 20 and the kiosk dependencies, clones the repo, builds,
installs a `systemd` service (`haven.service`), and sets up Chromium kiosk
autostart. Reboot and the Pi comes up as the console.

If you already have a checkout on the Pi, run `bash scripts/setup-pi.sh` instead.
