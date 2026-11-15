/* The header line: where and how the visitor is.
   Portfolio / 11.26 — a line for the weather where the visitor is, a small ink icon, and the temperature.
   On Vercel, /api/weather reads the visitor's city from the platform's geo headers and asks Open-Meteo for the
   weather there. Without it (a local preview, or a failed lookup) the line falls back to the visitor's own time zone
   and local time, which the browser knows with no request at all. ?wx=rain (or sun, night, clouds, fog, drizzle,
   snow, storm, hot, cold) previews a state, and &city=Lisbon sets the place. */
import { MONTH } from './headerCaption.js';

const LINES = {
  sun: (c) => (c ? `Sunny in ${c}, enjoy it` : 'Sun is out, enjoy it'),
  hot: (c) => (c ? `${c} is hot today, stay cool` : 'Hot out there, stay cool'),
  night: (c) => (c ? `Clear night in ${c}, stars are out` : 'Clear night, stars are out'),
  clouds: (c) => (c ? `Grey skies in ${c}, bright ideas in here` : 'Grey skies, bright ideas in here'),
  fog: () => 'Foggy out there, clear thinking in here',
  drizzle: () => 'A little drizzle, nothing a hood can’t fix',
  rain: () => 'Stay dry, rain might catch you',
  storm: () => 'Storm outside, a good day to stay in',
  snow: (c) => (c ? `Snow in ${c}, keep warm` : 'Snow outside, keep warm'),
  cold: (c) => (c ? `Cold in ${c}, wrap up warm` : 'Cold out there, wrap up warm'),
};

const ICONS = { sun: 'sun', hot: 'sun', night: 'moon', clouds: 'cloud', fog: 'fog', drizzle: 'drizzle', rain: 'rain', storm: 'storm', snow: 'snow', cold: 'cloud' };

// WMO weather codes (what Open-Meteo returns) to one of the states above
function stateOf(code, isDay, temp) {
  let state = code >= 95 ? 'storm'
    : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow'
    : (code >= 61 && code <= 67) || (code >= 80 && code <= 82) ? 'rain'
    : code >= 51 && code <= 57 ? 'drizzle'
    : code === 45 || code === 48 ? 'fog'
    : code >= 2 ? 'clouds'
    : isDay ? 'sun' : 'night';
  if (state === 'sun' && temp >= 28) state = 'hot';
  if ((state === 'clouds' || state === 'sun' || state === 'night') && temp <= 2) state = 'cold';
  return state;
}

function greetingFor(hour, city) {
  const at = city ? `, ${city}` : '';
  if (hour >= 5 && hour < 12) return [`Good morning${at}`, 'sun'];
  if (hour >= 12 && hour < 18) return [`Good afternoon${at}`, 'sun'];
  if (hour >= 18 && hour < 22) return [`Good evening${at}`, 'moon'];
  return [city ? `Up late in ${city}? Same here` : 'Up late? Same here', 'moon'];
}

export function startHeaderLine(caption, lifecycle) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const zoneCity = /\//.test(timeZone) ? timeZone.split('/').pop().replace(/_/g, ' ') : '';
  let clockTimer = 0;

  function showWeather(state, city, temp) {
    const tail = Number.isFinite(temp) ? `${Math.round(temp)}°` : '';
    caption.set({ text: `${MONTH} • ${LINES[state](city)}`, icon: ICONS[state], tail }, { text: MONTH, icon: ICONS[state], tail });
  }

  // fallback: the visitor's own clock and time-zone city, kept to the minute
  function showClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const [line, icon] = greetingFor(now.getHours(), zoneCity);
    caption.set({ text: `${MONTH} • ${line}`, icon, tail: time }, { text: MONTH, icon, tail: time });
    clearTimeout(clockTimer);
    clockTimer = lifecycle.timeout(showClock, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
  }

  const query = new URLSearchParams(location.search);
  const forced = query.get('wx');
  if (forced && LINES[forced]) {
    showWeather(forced, query.get('city') || zoneCity, parseFloat(query.get('t') ?? '14'));
    return;
  }

  showClock();
  const request = new AbortController();
  lifecycle.timeout(() => request.abort(), 3500);
  lifecycle.signal.addEventListener('abort', () => request.abort());
  fetch('/api/weather', { signal: request.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !Number.isFinite(d.code)) return;
      clearTimeout(clockTimer);
      showWeather(stateOf(d.code, d.day, d.temp), d.city || zoneCity, d.temp);
    })
    .catch(() => {});
}
