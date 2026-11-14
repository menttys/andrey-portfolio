// GET /api/commits
// Returns GitHub contributions for the last 2 calendar years (YEARS below) (Jan 1 of the oldest one up to today) as
// { user, total, contributions: [{ date, count, level }] }, the shape the Contributions section draws (one row per year).
//
// Environment variables (Vercel → Project → Settings → Environment Variables, or .env.local in development):
//   GITHUB_USER   your GitHub username (required unless the page passes ?user=)
//   GITHUB_TOKEN  optional. A fine-grained personal access token with no extra permissions is enough.
//                 With it, data comes from GitHub's own GraphQL API (and includes private contributions
//                 if "Private contributions" is switched on in your GitHub profile settings).
//                 Without it, the route falls back to the public calendar mirror at jogruber.de.
// The token stays on the server; the browser only ever sees the counts.
export const dynamic = 'force-dynamic';

type Day = { date: string; count: number; level: number };
type Result = { total: number; contributions: Day[]; source: 'github' | 'public' };

const LEVEL: Record<string, number> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const YEARS = 2;
const years = () => { const y = new Date().getUTCFullYear(); return Array.from({ length: YEARS }, (_, i) => y - YEARS + 1 + i); };
const today = () => new Date().toISOString().slice(0, 10);
// both sources hand back whole calendar years; drop the days that haven't happened yet
const upToToday = (days: Day[]) => { const t = today(); return days.filter((d) => d.date <= t); };
const USER_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    // same answer for every visitor: let Vercel's CDN hold it for an hour and refresh in the background
    'cache-control': status === 200 ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
  },
});

async function fromGraphQL(user: string, token: string): Promise<Result> {
  // a contributionsCollection spans at most a year, so ask for one per calendar year under its own alias
  const ys = years();
  const parts = ys.map((y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") {
    contributionCalendar { weeks { contributionDays { date contributionCount contributionLevel } } } }`).join('\n');
  const query = `query($login: String!) { user(login: $login) { ${parts} } }`;
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'portfolio-commits' },
    body: JSON.stringify({ query, variables: { login: user } }),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error('graphql ' + r.status);
  const d = await r.json();
  const u = d?.data?.user;
  if (!u) throw new Error('no calendar');
  type GDay = { date: string; contributionCount: number; contributionLevel: string };
  const contributions = upToToday(ys.flatMap((y) => (u['y' + y]?.contributionCalendar?.weeks ?? [])
    .flatMap((w: { contributionDays: GDay[] }) => w.contributionDays)
    .filter((x: GDay) => x.date.startsWith(y + '-'))
    .map((x: GDay) => ({ date: x.date, count: x.contributionCount, level: LEVEL[x.contributionLevel] ?? 0 }))));
  if (!contributions.length) throw new Error('no calendar');
  return { total: contributions.reduce((s, x) => s + x.count, 0), contributions, source: 'github' };
}

async function fromPublic(user: string): Promise<Result> {
  const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${user}?${years().map((y) => 'y=' + y).join('&')}`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error('public ' + r.status);
  const d = await r.json();
  if (!d?.contributions?.length) throw new Error('empty');
  const contributions = upToToday(d.contributions as Day[]);
  return { total: contributions.reduce((s, x) => s + x.count, 0), contributions, source: 'public' };
}

export async function GET(req: Request) {
  // the env var wins, so the token can't be used to look up anyone else
  const user = process.env.GITHUB_USER || new URL(req.url).searchParams.get('user') || '';
  if (!USER_RE.test(user)) return json({ error: 'set GITHUB_USER' }, 400);
  const token = process.env.GITHUB_TOKEN;
  try {
    if (token) {
      try { return json({ user, ...(await fromGraphQL(user, token)) }); } catch { /* fall through to the public mirror */ }
    }
    return json({ user, ...(await fromPublic(user)) });
  } catch {
    return json({ user, error: 'unavailable' }, 502);
  }
}
