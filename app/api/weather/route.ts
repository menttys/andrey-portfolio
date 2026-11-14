// GET /api/weather
// Reads the visitor's location from Vercel's own geo headers (the IP never leaves Vercel) and asks Open-Meteo
// (free, no key) for the current weather there. The header line turns the answer into a sentence and an icon.
export const dynamic = 'force-dynamic';

// per visitor, so never shared by a CDN; ten minutes in their browser is plenty for weather
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=600' },
});

export async function GET(req: Request) {
  const h = req.headers;
  const lat = parseFloat(h.get('x-vercel-ip-latitude') ?? '');
  const lon = parseFloat(h.get('x-vercel-ip-longitude') ?? '');
  const city = decodeURIComponent(h.get('x-vercel-ip-city') || '');
  const country = h.get('x-vercel-ip-country') || '';
  // no location (local dev, or a visitor Vercel can't place): the page falls back to the visitor's own clock
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return new Response(null, { status: 204, headers: { 'cache-control': 'private, max-age=600' } });
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}`
      + '&current=temperature_2m,weather_code,is_day&timezone=auto';
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return json({ city, country });
    const d = await r.json();
    return json({ city, country, temp: d.current?.temperature_2m, code: d.current?.weather_code, day: d.current?.is_day === 1 });
  } catch {
    return json({ city, country });
  }
}
