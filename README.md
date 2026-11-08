# miroslaw-shpak.dev

Personal site of Miroslaw Shpak. A scroll-driven three.js story built on top of the old
[Shuttle Software](https://shuttlesoftware.com) site, plus a plain printable CV at `/cv/`.

- All copy lives in `src/content.ts` and is rendered to static HTML at build time (`src/render.ts`), so crawlers and
  no-JS visitors get the full page. The 3D scene is loaded after first paint.
- `src/main.ts`: smooth wheel scrolling, snapping to keyframes, HUD ruler, keyboard and deep links.
- `src/gl/timeline.ts`: camera and shuttle poses per keyframe, including the warp jump and the slingshot into orbit.
- `src/gl/world.ts`: planets, atmospheres, stars, warp streaks, orbit and trail.

```sh
npm i
npm run dev      # http://localhost:5173 (add ?fx in headless browsers, ?nofx for the static version)
npm run build
npm run deploy   # Cloudflare Pages, project "miroslaw-shpak"
```
