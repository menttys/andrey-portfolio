// GET /api/weather
// Reads the visitor's location from Vercel's own geo headers (the IP never leaves Vercel) and asks Open-Meteo
// (free, no key) for the current weather there. The header line turns the answer into a sentence and an icon.
export const dynamic = 'force-dynamic';

// per visitor, so never shared by a CDN; ten minutes in their browser is plenty for weather
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=600' },
});

// local development has no Vercel geo headers, so `next dev` pretends to be in Valencia and still asks Open-Meteo
// for the real weather (and real day/night) there; if that fails, the mock below uses the clock for day/night
const DEV_PLACE = { city: 'Valencia', country: 'ES', lat: 39.47, lon: -0.38 };
const devMock = () => { const hr = new Date().getHours(); return { city: DEV_PLACE.city, country: DEV_PLACE.country, temp: 20, code: 0, day: hr >= 7 && hr < 20 }; };

export async function GET(req: Request) {
  const h = req.headers;
  const dev = process.env.NODE_ENV === 'development' && !h.get('x-vercel-ip-latitude');
  const lat = dev ? DEV_PLACE.lat : parseFloat(h.get('x-vercel-ip-latitude') ?? '');
  const lon = dev ? DEV_PLACE.lon : parseFloat(h.get('x-vercel-ip-longitude') ?? '');
  const city = dev ? DEV_PLACE.city : decodeURIComponent(h.get('x-vercel-ip-city') || '');
  const country = dev ? DEV_PLACE.country : h.get('x-vercel-ip-country') || '';
  // no location (local dev, or a visitor Vercel can't place): the page falls back to the visitor's own clock
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return new Response(null, { status: 204, headers: { 'cache-control': 'private, max-age=600' } });
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}`
      + '&current=temperature_2m,weather_code,is_day&timezone=auto';
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return dev ? json(devMock()) : json({ city, country });
    const d = await r.json();
    return json({ city, country, temp: d.current?.temperature_2m, code: d.current?.weather_code, day: d.current?.is_day === 1 });
  } catch {
    return dev ? json(devMock()) : json({ city, country });
  }
}
