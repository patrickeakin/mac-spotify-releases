// Spotify tags artists, not albums, so a release is "classical" when the
// followed artist it came from is.
//
// Tags are matched exactly, never as substrings: "classic rock", "classic soul"
// and "baroque pop" all contain classical-looking words but belong to Pink Floyd,
// Ohio Players and Arcade Fire.
//
// The bare "classical" tag marks composers whose repertoire other performers keep
// re-recording. "contemporary classical" rescues living/modern composers who also
// carry it (Max Richter, Arvo Pärt, Górecki, Messiaen), while the neoclassical and
// contemporary-classical artists that make up most of the library never carry the
// bare tag at all and are unaffected.
const CLASSICAL = 'classical';
const CONTEMPORARY = 'contemporary classical';

export function isClassical(genres: string[] | undefined): boolean {
  if (!genres) return false;
  return genres.includes(CLASSICAL) && !genres.includes(CONTEMPORARY);
}
