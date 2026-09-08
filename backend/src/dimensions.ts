/**
 * Physical-dimension classification for a curated set of unit tokens.
 *
 * IMPORTANT: this table carries no conversion factors, only a dimension tag
 * per unit. Its only job is to catch AI mistakes like "BTU -> W" (energy vs
 * power) before they reach the client. All real math stays in the Flutter
 * ConversionEngine; this is a sanity guard, not a duplicate engine.
 */
const DIMENSION_BY_UNIT: Record<string, string> = {
  // length
  nm: 'length', nanometer: 'length', nanometers: 'length',
  um: 'length', 'μm': 'length', micrometer: 'length', micrometers: 'length',
  mm: 'length', millimeter: 'length', millimeters: 'length',
  cm: 'length', centimeter: 'length', centimeters: 'length',
  m: 'length', meter: 'length', meters: 'length', metre: 'length', metres: 'length',
  km: 'length', kilometer: 'length', kilometers: 'length', kilometre: 'length', kilometres: 'length',
  mile: 'length', miles: 'length', mi: 'length',
  yard: 'length', yards: 'length', yd: 'length',
  foot: 'length', feet: 'length', ft: 'length',
  inch: 'length', inches: 'length', in: 'length',
  wa: 'length', 'วา': 'length',
  sen: 'length', 'เส้น': 'length',

  // area
  square_meter: 'area', square_meters: 'area', sqm: 'area', 'sq_m': 'area', 'ตารางเมตร': 'area',
  square_kilometer: 'area', square_kilometers: 'area', sqkm: 'area',
  square_foot: 'area', square_feet: 'area', sqft: 'area',
  hectare: 'area', hectares: 'area', ha: 'area',
  acre: 'area', acres: 'area',
  rai: 'area', 'ไร่': 'area',
  ngan: 'area', 'งาน': 'area',
  square_wah: 'area', 'ตารางวา': 'area', wah: 'area',
  bigha: 'area',

  // weight
  kg: 'weight', kilogram: 'weight', kilograms: 'weight',
  g: 'weight', gram: 'weight', grams: 'weight',
  mg: 'weight', milligram: 'weight', milligrams: 'weight',
  lb: 'weight', lbs: 'weight', pound: 'weight', pounds: 'weight',
  oz: 'weight', ounce: 'weight', ounces: 'weight',
  ton: 'weight', tons: 'weight', tonne: 'weight', tonnes: 'weight', metric_ton: 'weight',

  // volume
  l: 'volume', liter: 'volume', liters: 'volume', litre: 'volume', litres: 'volume',
  ml: 'volume', milliliter: 'volume', milliliters: 'volume',
  cubic_meter: 'volume', cubic_meters: 'volume', m3: 'volume',
  gallon: 'volume', gallons: 'volume', gal: 'volume',
  quart: 'volume', quarts: 'volume', qt: 'volume',
  pint: 'volume', pints: 'volume', pt: 'volume',
  cup: 'volume', cups: 'volume',
  fluid_ounce: 'volume', fluid_ounces: 'volume', fl_oz: 'volume',

  // temperature
  c: 'temperature', celsius: 'temperature', centigrade: 'temperature', '°c': 'temperature',
  f: 'temperature', fahrenheit: 'temperature', '°f': 'temperature',
  k: 'temperature', kelvin: 'temperature', '°k': 'temperature',

  // speed
  'm/s': 'speed', mps: 'speed', meter_per_second: 'speed',
  'km/h': 'speed', kph: 'speed', kmh: 'speed', kilometer_per_hour: 'speed',
  mph: 'speed', mile_per_hour: 'speed',
  knot: 'speed', knots: 'speed', kn: 'speed',

  // time
  s: 'time', sec: 'time', second: 'time', seconds: 'time',
  min: 'time', minute: 'time', minutes: 'time',
  hr: 'time', h: 'time', hour: 'time', hours: 'time',
  day: 'time', days: 'time',
  week: 'time', weeks: 'time',

  // data
  byte: 'data', bytes: 'data',
  bit: 'data', bits: 'data',
  kb: 'data', kilobyte: 'data', kilobytes: 'data',
  mb: 'data', megabyte: 'data', megabytes: 'data',
  gb: 'data', gigabyte: 'data', gigabytes: 'data',
  tb: 'data', terabyte: 'data', terabytes: 'data',

  // energy
  j: 'energy', joule: 'energy', joules: 'energy',
  kj: 'energy', kilojoule: 'energy', kilojoules: 'energy',
  mj: 'energy', megajoule: 'energy', megajoules: 'energy',
  wh: 'energy', watt_hour: 'energy', watt_hours: 'energy',
  kwh: 'energy', kilowatt_hour: 'energy', kilowatt_hours: 'energy',
  btu: 'energy',

  // power
  w: 'power', watt: 'power', watts: 'power',
  kw: 'power', kilowatt: 'power', kilowatts: 'power',
  mw: 'power', megawatt: 'power', megawatts: 'power',
  hp: 'power', horsepower: 'power',
  'btu/h': 'power', btu_per_hour: 'power', btuh: 'power',

  // pressure
  pa: 'pressure', pascal: 'pressure', pascals: 'pressure',
  kpa: 'pressure', kilopascal: 'pressure',
  mpa: 'pressure', megapascal: 'pressure',
  bar: 'pressure',
  psi: 'pressure',
  atm: 'pressure', atmosphere: 'pressure', atmospheres: 'pressure',

  // force
  n: 'force', newton: 'force', newtons: 'force',
  kilonewton: 'force', kilonewtons: 'force',
  lbf: 'force', pound_force: 'force',
  kgf: 'force', kilogram_force: 'force',

  // torque (kept distinct from length "nm"/nanometer - never abbreviate as "nm")
  newton_meter: 'torque', newton_meters: 'torque', 'n·m': 'torque', 'n_m': 'torque',
  lb_ft: 'torque', 'lb-ft': 'torque', pound_foot: 'torque',

  // frequency
  hz: 'frequency', hertz: 'frequency',
  khz: 'frequency', kilohertz: 'frequency',
  mhz: 'frequency', megahertz: 'frequency',
  ghz: 'frequency', gigahertz: 'frequency',

  // electrical
  v: 'voltage', volt: 'voltage', volts: 'voltage',
  a: 'current', ampere: 'current', amperes: 'current', amp: 'current', amps: 'current',
  ohm: 'resistance', ohms: 'resistance', 'Ω': 'resistance',
};

function normalize(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Returns the known dimension for a unit token, or null if not in the table. */
export function dimensionOf(unit: string): string | null {
  return DIMENSION_BY_UNIT[normalize(unit)] ?? null;
}

export interface DimensionMismatch {
  itemUnit: string;
  itemDimension: string;
  targetUnit: string;
  targetDimension: string;
}

/**
 * Checks each item's unit against the target unit's dimension. Units absent
 * from the table are skipped (unknown -> not blocked here; the Flutter
 * UnitRepository has the final say and will reject truly unknown units).
 */
export function findDimensionMismatch(
  itemUnits: string[],
  targetUnit: string,
): DimensionMismatch | null {
  const targetDimension = dimensionOf(targetUnit);
  if (!targetDimension) return null;

  for (const itemUnit of itemUnits) {
    const itemDimension = dimensionOf(itemUnit);
    if (itemDimension && itemDimension !== targetDimension) {
      return { itemUnit, itemDimension, targetUnit, targetDimension };
    }
  }
  return null;
}
