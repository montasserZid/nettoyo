import zonesData from '../data/zones.json';

type ZoneCity = { name: string; lat: number; lng: number };
type ZoneItem = { name: string; cities: ZoneCity[] };

export type ZoneAreaSelection = { id: string; zone: string; name: string; lat: number; lng: number };

export const zones = zonesData.zones as ZoneItem[];

function areaId(zone: string, city: string) {
  return `${zone}::${city}`;
}

export const areaPoints: ZoneAreaSelection[] = zones.flatMap((zone) =>
  zone.cities.map((city) => ({
    id: areaId(zone.name, city.name),
    zone: zone.name,
    name: city.name,
    lat: city.lat,
    lng: city.lng
  }))
);

export const zoneAreas: ZoneAreaSelection[] = zones.map((zone) => {
  const lat = zone.cities.reduce((sum, city) => sum + city.lat, 0) / Math.max(zone.cities.length, 1);
  const lng = zone.cities.reduce((sum, city) => sum + city.lng, 0) / Math.max(zone.cities.length, 1);
  return {
    id: `zone::${zone.name}`,
    zone: zone.name,
    name: zone.name,
    lat,
    lng
  };
});

export const firstZoneName = zones[0]?.name ?? '';

export function getZoneArea(zoneName: string) {
  return zoneAreas.find((zone) => zone.zone === zoneName) ?? null;
}

function repairMojibake(value: string) {
  return value
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã«/g, 'ë')
    .replace(/Ã /g, 'à')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã»/g, 'û')
    .replace(/Ã§/g, 'ç')
    .replace(/â€“/g, '-')
    .replace(/â€”/g, '-')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'");
}

function normalizeTextForMatch(value: string) {
  return repairMojibake(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const zoneByNormalizedCity = areaPoints.reduce<Map<string, string[]>>((map, area) => {
  const key = normalizeTextForMatch(area.name);
  const existing = map.get(key) ?? [];
  if (!existing.includes(area.zone)) {
    existing.push(area.zone);
  }
  map.set(key, existing);
  return map;
}, new Map<string, string[]>());

const montrealZoneName = zones.find((zone) => normalizeTextForMatch(zone.name) === 'montreal')?.name ?? firstZoneName;

export function deriveZoneFromCityName(city?: string | null) {
  const normalizedCity = normalizeTextForMatch(city ?? '');
  if (!normalizedCity) return null;

  const matchedZones = zoneByNormalizedCity.get(normalizedCity);
  if (matchedZones?.length) {
    if (matchedZones.includes(montrealZoneName)) {
      return montrealZoneName;
    }
    return matchedZones[0];
  }

  if (normalizedCity === 'montreal') {
    return montrealZoneName;
  }

  return null;
}

type ZoneResolutionInput = {
  formatted?: string | null;
  city?: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function pickPreferredZone(zonesForMatch: string[]) {
  if (zonesForMatch.includes(montrealZoneName)) {
    return montrealZoneName;
  }
  return zonesForMatch[0] ?? null;
}

function extractZonesFromText(value: string) {
  const normalized = normalizeTextForMatch(value);
  if (!normalized) return null;

  const padded = ` ${normalized} `;
  const matched = new Set<string>();

  for (const [cityKey, zonesForCity] of zoneByNormalizedCity.entries()) {
    if (!cityKey) continue;
    if (padded.includes(` ${cityKey} `)) {
      zonesForCity.forEach((zoneName) => matched.add(zoneName));
    }
  }

  if (matched.size === 0) return null;
  return pickPreferredZone(Array.from(matched));
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deriveZoneFromCoordinates(lat?: number | null, lng?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const nearest = zoneAreas.reduce<{ zone: string; distanceKm: number } | null>((closest, zoneArea) => {
    const distanceKm = haversineDistanceKm(lat as number, lng as number, zoneArea.lat, zoneArea.lng);
    if (!closest || distanceKm < closest.distanceKm) {
      return { zone: zoneArea.zone, distanceKm };
    }
    return closest;
  }, null);

  if (!nearest) return null;
  return nearest.distanceKm <= 90 ? nearest.zone : null;
}

export function deriveZoneFromAddress(address?: ZoneResolutionInput | null) {
  if (!address) return null;

  const fromCity = deriveZoneFromCityName(address.city);
  if (fromCity) return fromCity;

  const fromFormattedText = extractZonesFromText(address.formatted ?? '');
  if (fromFormattedText) return fromFormattedText;

  const normalizedPostal = normalizeTextForMatch(address.postal_code ?? '');
  if (normalizedPostal.startsWith('h')) {
    return montrealZoneName;
  }

  const fromCoords = deriveZoneFromCoordinates(address.lat, address.lng);
  if (fromCoords) return fromCoords;

  return null;
}
