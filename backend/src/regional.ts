/**
 * Units whose real-world size depends on country/region and has no single
 * global standard (unlike Thai rai/ngan/wa, which are nationally fixed).
 * Data-driven and small on purpose: add entries here, never branch on
 * country in code.
 */
const REGION_DEPENDENT_UNITS = new Set(['bigha']);

export function isRegionDependent(unit: string): boolean {
  return REGION_DEPENDENT_UNITS.has(unit.trim().toLowerCase());
}

/** True when the unit needs a region to be resolvable and none was given. */
export function needsRegionClarification(unit: string, region: string | null | undefined): boolean {
  return isRegionDependent(unit) && (!region || region.trim().length === 0);
}

/**
 * Tags a region-dependent unit with its region as a composite canonical id
 * (e.g. "bigha" + "Bihar" -> "bigha_bihar"). This never invents a
 * conversion factor - it only gives the Flutter unit database a specific
 * enough id to look up (or reject as unknown) later.
 */
export function canonicalRegionalUnit(unit: string, region: string): string {
  const slug = region.trim().toLowerCase().replace(/\s+/g, '_');
  return `${unit.trim().toLowerCase()}_${slug}`;
}
