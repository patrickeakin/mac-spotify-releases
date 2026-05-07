import { parseReleaseDate } from '../dates';

describe('parseReleaseDate', () => {
  it('parses YYYY-MM-DD as local-tz midnight (not UTC)', () => {
    const date = parseReleaseDate('2026-05-07');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(7);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('handles year-only precision strings', () => {
    const date = parseReleaseDate('2026');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it('handles year-month precision strings', () => {
    const date = parseReleaseDate('2026-04');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(1);
  });

  it('parses today\'s date string to today regardless of TZ', () => {
    // Pick a fixed local-tz "today" and assert the parsed result agrees on toDateString.
    const today = new Date(2026, 4, 7); // May 7 2026, local midnight
    const parsed = parseReleaseDate('2026-05-07');
    expect(parsed.toDateString()).toBe(today.toDateString());
  });
});
