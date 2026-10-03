# GLITCH BREAKER

A browser-based roguelite arcade shooter. The local AI Director analyzes each run and adapts the next arena to your play style. Runs, upgrades, and scores are saved in your browser; the game has no account, backend, analytics, or external runtime service.

## Play locally

```sh
npm ci
npm run dev
```

Use **WASD** or the arrow keys to move, the mouse to aim, and **Space**, **Shift**, or right-click to dash. On touch screens, drag the left half to move and the right half to aim and fire.

## Build

```sh
npm run build
npm run preview
```

The production build is a self-contained static page in `dist/`.

## GitHub Pages

Pushes to `main` build and deploy the static game with the workflow in `.github/workflows/pages.yml`. No server-side services or secrets are required.
