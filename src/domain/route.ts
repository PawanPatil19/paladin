export type RoutePoint = {
  id: string;
  name: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: 'water-outline' | 'leaf-outline' | 'trail-sign-outline' | 'git-branch-outline' | 'business-outline';
};

export type ActivityRoute = {
  start: RoutePoint;
  end: RoutePoint;
};

export const ROUTE_POINTS: RoutePoint[] = [
  { id: 'marina-barrage', name: 'Marina Barrage', area: 'Marina Bay', address: '8 Marina Gardens Drive', latitude: 1.2807, longitude: 103.8712, icon: 'water-outline' },
  { id: 'east-coast', name: 'East Coast Park', area: 'Marine Cove', address: '1000 East Coast Parkway', latitude: 1.3018, longitude: 103.9127, icon: 'leaf-outline' },
  { id: 'macritchie', name: 'MacRitchie Reservoir', area: 'Central Water Catchment', address: 'Lornie Road', latitude: 1.3448, longitude: 103.8224, icon: 'trail-sign-outline' },
  { id: 'rail-corridor', name: 'Rail Corridor', area: 'Bukit Timah', address: 'King Albert Park', latitude: 1.3324, longitude: 103.7817, icon: 'git-branch-outline' },
  { id: 'sports-hub', name: 'Singapore Sports Hub', area: 'Kallang', address: '1 Stadium Drive', latitude: 1.304, longitude: 103.8746, icon: 'business-outline' },
];

export const DEFAULT_ROUTE: ActivityRoute = { start: ROUTE_POINTS[4], end: ROUTE_POINTS[1] };

export function routeIsValid(route: ActivityRoute) {
  return route.start.id !== route.end.id;
}

export function routeDistanceKm(route: ActivityRoute) {
  const earthKm = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(route.end.latitude - route.start.latitude);
  const dLon = toRad(route.end.longitude - route.start.longitude);
  const lat1 = toRad(route.start.latitude);
  const lat2 = toRad(route.end.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toApiPoint(point: RoutePoint) {
  return { name: point.name, area: point.area, address: point.address, latitude: point.latitude, longitude: point.longitude };
}
