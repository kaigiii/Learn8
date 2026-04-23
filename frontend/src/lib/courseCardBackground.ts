const DEFAULT_LIBRARY_BACKGROUNDS = [
  "/library-bg/blue.png",
  "/library-bg/green.png",
  "/library-bg/red.png",
  "/library-bg/yellow.png",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function resolveCourseCardBackground(
  seed: string | number | null | undefined,
  backgrounds: string[] = DEFAULT_LIBRARY_BACKGROUNDS
): string {
  if (!backgrounds.length) {
    return "/library-bg/blue.png";
  }

  const normalized = String(seed ?? "").trim();
  if (!normalized) {
    return backgrounds[0];
  }

  const index = hashSeed(normalized) % backgrounds.length;
  return backgrounds[index] ?? backgrounds[0];
}

export { DEFAULT_LIBRARY_BACKGROUNDS };