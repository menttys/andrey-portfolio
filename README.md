# Andrey — portfolio (Next.js)

The approved prototype (`prototype/saved/2026-11-14-github-commits/`) as a Next.js 16 / React 19 app, ready for Vercel.
Look and behaviour are the same as the prototype: the 3D devices with tilt, float and hover/press wobble, the
section-selector knob, the paper-tint and type-weight knobs, the brightness knob, the open-to-work unit, the weather
line in the header, and the GitHub contributions chart.

## Run it

```bash
npm install
cp .env.example .env.local   # GITHUB_USER=menttys, GITHUB_TOKEN optional
npm run dev                  # http://localhost:3000
```

Locally there are no Vercel geo headers, so the header shows the time-of-day greeting instead of the weather.
Add `?wx=rain&city=Lisbon` (or sun, night, clouds, fog, drizzle, snow, storm, hot, cold) to preview a weather state.

## Deploy on Vercel

1. Push this folder to a GitHub repo and import it at vercel.com/new (or run `npx vercel` in this folder).
   The framework is detected as Next.js; no build settings are needed.
2. In Project → Settings → Environment Variables add `GITHUB_USER` (`menttys`) and, optionally, `GITHUB_TOKEN`
   (a fine-grained token with no extra permissions; it lets the chart include private contributions).

## Where things are

| Path                       | What it is                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `lib/content.ts`           | All the copy: headline, intro, selected work, experience, skills, email                 |
| `app/page.tsx`             | Page layout                                                                             |
| `components/`              | One component per section; `DeviceScene` starts the 3D scene                            |
| `lib/scene.js`             | The three.js scene, ported from the prototype unchanged apart from imports and teardown |
| `app/globals.css`          | The prototype's stylesheet                                                              |
| `app/api/weather/route.ts` | Visitor's weather from Vercel geo headers + Open-Meteo                                  |
| `app/api/commits/route.ts` | GitHub contributions (GraphQL with a token, public mirror without)                      |

three.js is pinned to 0.128.0, the version the prototype loaded from the CDN, so the render matches exactly.
