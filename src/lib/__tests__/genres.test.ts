import { isClassical } from '../genres';

// Tag lists below are the real ones Spotify returns for these artists.
describe('isClassical', () => {
  it('matches composers whose repertoire gets re-recorded', () => {
    expect(isClassical(['impressionism', 'classical', 'classical piano'])).toBe(true); // Debussy
    expect(isClassical(['impressionism', 'classical', 'classical piano', 'neoclassical'])).toBe(
      true,
    ); // Ravel — also tagged neoclassical
    expect(isClassical(['classical', 'chamber music', 'orchestral'])).toBe(true); // Shostakovich
  });

  it('keeps modern composers carrying "contemporary classical"', () => {
    expect(
      isClassical(['neoclassical', 'contemporary classical', 'minimalism', 'ambient', 'classical']),
    ).toBe(false); // Max Richter
    expect(isClassical(['minimalism', 'contemporary classical', 'classical', 'choral'])).toBe(false); // Arvo Pärt
    expect(isClassical(['minimalism', 'contemporary classical', 'classical'])).toBe(false); // Górecki
  });

  it('keeps the neoclassical/ambient artists that lack the bare tag', () => {
    expect(
      isClassical(['ambient', 'neoclassical', 'drone', 'contemporary classical', 'minimalism']),
    ).toBe(false); // A Winged Victory for the Sullen
    expect(isClassical(['drone', 'ambient', 'dark ambient', 'neoclassical', 'electronic classical'])).toBe(
      false,
    ); // Deaf Center
    expect(isClassical(['japanese classical', 'ambient'])).toBe(false); // Ryuichi Sakamoto
  });

  it('does not match tags that merely contain a classical-looking word', () => {
    expect(isClassical(['classic rock', 'album rock'])).toBe(false); // Pink Floyd
    expect(isClassical(['baroque pop', 'indie rock'])).toBe(false); // Arcade Fire
    expect(isClassical(['classic soul', 'funk'])).toBe(false); // Ohio Players
  });

  it('treats missing or empty genres as not classical', () => {
    expect(isClassical(undefined)).toBe(false);
    expect(isClassical([])).toBe(false);
  });
});
