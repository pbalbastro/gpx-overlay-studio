# GPX Overlay Studio

A static web app that turns a `.gpx` file into transparent PNG activity overlays: stats, a route trace and a wordmark, styled after Strava's share stickers. Everything uses white type and Strava orange (`#FC4C02`).

## Run

The site lives in `public/` and has no build step. For GPX-only use, open `public/index.html` in a browser or serve that folder:

```sh
cd gpx-overlay/public
python3 -m http.server 8000   # then visit http://localhost:8000
```

Drop a GPX file on the upload box (try `samples/morning-run.gpx`), pick a template and click **Download PNG** (on phones, **Save to Photos**).

The **Connect with Strava** panel appears only when the site runs on the Cloudflare Worker (below). Opened as a plain file or from a static host, the app works with GPX upload only.

## Strava connection (Cloudflare Worker)

> **Currently switched off.** Strava deactivates API apps whose owner has no paid Strava subscription, so the panel is hidden. To turn it back on: subscribe with the account that owns the API app, reactivate the app at strava.com/settings/api, set `STRAVA_ENABLED = true` in `public/js/strava.js`, then run `npx wrangler deploy`.

`src/worker.js` serves `public/` as static assets and adds `/api/strava/*`:

- the OAuth login and callback;
- the activity list;
- activity detail with streams;
- disconnect.

The OAuth tokens are stored in an encrypted, HttpOnly cookie, so no database is needed. It fits Cloudflare's free plan.

One-time setup:

1. **Create a Strava API app** at <https://www.strava.com/settings/api>. Set **Authorization Callback Domain** to your Worker's host, e.g. `gpx-overlay.patrickbalbastro.workers.dev`. Use `localhost` while testing locally.
2. **Add the secrets.** `COOKIE_KEY` is any long random string; changing it signs everyone out.
   ```sh
   cd gpx-overlay
   npx wrangler login
   npx wrangler secret put STRAVA_CLIENT_ID
   npx wrangler secret put STRAVA_CLIENT_SECRET
   npx wrangler secret put COOKIE_KEY        # e.g. the output of: openssl rand -base64 32
   ```
3. **Deploy.** This replaces dashboard uploads; it publishes the Worker and `public/` together.
   ```sh
   npx wrangler deploy
   ```

To test locally, put the same three values in a `.dev.vars` file, one `NAME=value` per line, and never commit it. Then run `npx wrangler dev` and open <http://localhost:8787>.

New Strava API apps allow **one athlete**, the app owner, until Strava approves more. Request a higher limit from Strava's developer settings so club members can connect. Until then, they can still upload GPX files.

## Features

- Parses `trkpt` (or `rtept`) points: distance (haversine), moving time, pace or speed, elevation gain, per-km/mi splits and the elevation profile
- 42 overlay templates: Classic Stack, Route Hero, Bottom Bar, Corner Stack, Big Number, Minimal Route, Four Corners, Side Accent, Activity Card, Elevation Profile, Splits, One Line, Route Map, Middle Finger, Rock On, Stats Grid (sports-watch style, with heart rate and cadence when the GPX has them), Strava Stats (app-style stat screen; power from the GPX, calories from Strava), Stacked Route (the route repeated in fading layers like an extruded ribbon, with a big italic distance), Course Data (a spec-sheet table of four stats that follow the activity type, over a lime elevation profile with start and high-point markers), Liquid Glass (iOS 26 inspired frosted-glass card and pills; blurs the preview photo behind it), plus TTRC running-club layouts (TTRC Classic, TTRC Side, TTRC Pace, TTRC Bar) with a STRAVA | TTRC lockup, KL Bisiklista Classic with a STRAVA | KL BISIKLISTA lockup, APIMYCC cycling-club layouts (Classic, Ride Bar, Side, Hero, Climb) with a STRAVA | APIMYCC lockup, and minimalist WHITE layouts (Hairline, Caption, Quiet Number, Frame, Echo, Sketch) in light white type with a thin white route, and MAP layouts (Activity Page, Activity Page 3D with a tilted satellite map over real terrain, Feed Card, Feed Card Stats with the six Strava stat-screen stats, Map Tile, Full Map) that put the route on a real street map styled like the Strava app (OpenStreetMap data via [OpenFreeMap](https://openfreemap.org), rendered with MapLibre GL, 3D terrain from the open Terrarium elevation tiles on AWS, satellite imagery from Esri World Imagery; no API key)
- Story (1080×1920), Portrait (1080×1350) and Square (1080×1080) exports
- km or miles
- Editable title, STRAVA logo (drawn from the logotype image, like the club logos), adjustable route thickness, optional soft shadow
- Preview on your own photo, and optionally bake the photo into the export
- Connect with Strava: pick a recent activity and use Strava's exact totals, including calories and power

## Project layout

```
wrangler.toml              Cloudflare Worker config (assets + /api/* routes)
src/worker.js              Strava OAuth + API proxy, encrypted session cookie
public/index.html          UI markup
public/css/style.css       app styling
public/js/logos.js         embedded club logos (image + vector; source PNGs in assets/)
public/js/gpx.js           GPX parsing, stats, formatting, demo activity
public/js/demo.js          the demo run ("Morning Run"), compactly encoded
public/js/strava.js        Strava panel; converts Strava activities to the app's stats
public/js/render.js        canvas primitives (text, stat stacks/rows, route, elevation profile)
public/js/map.js           street-map backgrounds for the MAP templates (MapLibre + OpenFreeMap)
public/js/templates.js     the overlay templates and tab groups
public/js/app.js           UI wiring, preview, thumbnails, PNG export
public/samples/            example GPX file
```

## Adding a template

Append an object to the `templates` array in `public/js/templates.js`:

```js
{
  id: 'my-layout',
  name: 'My Layout',
  desc: 'One-line description.',
  draw(ctx, W, H, d) {
    const s = W / 1080; // design at 1080px wide, scale everything by s
    OV.stack(ctx, [d.dist, d.pace, d.time], W / 2, H * 0.1, { labelSize: 34 * s, valueSize: 80 * s, gap: 60 * s });
    OV.drawRoute(ctx, d.route, { x: W * 0.2, y: H * 0.6, w: W * 0.6, h: H * 0.15 }, { width: 11 * s * d.rw });
    OV.wordmark(ctx, d, W / 2, H * 0.85, 48 * s);
  },
}
```

`d` holds `dist`, `pace`, `time`, `elev` (each `{ label, value }`), `splits`, `route`, `profile`, `name`, `date`, `wordmark` and `rw` (route thickness).

## Note

"STRAVA" is Strava, Inc.'s trademark. This project is not affiliated with Strava. The app shows "Powered by Strava" as required by Strava's API agreement.
