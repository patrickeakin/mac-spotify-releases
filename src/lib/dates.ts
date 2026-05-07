// Spotify release_date strings (`YYYY-MM-DD`, `YYYY-MM`, or `YYYY`) parse as
// UTC midnight via `new Date(s)`, which then displays/compares as the previous
// calendar day for any user west of UTC. Treat the string as local-tz midnight
// instead so the display and the today/7d filters agree with the user's clock.
export function parseReleaseDate(s: string): Date {
  const [y, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
