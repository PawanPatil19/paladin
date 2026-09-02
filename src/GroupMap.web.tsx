import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { colors } from './ui/theme';

type MapPoint = { latitude: number; longitude: number };
type MapMember = MapPoint & { id: string; name: string; initials: string; color: string; isYou?: boolean };
type MapDestination = MapPoint & { name: string };

const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = process.env.EXPO_PUBLIC_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

function icon(html: string, className: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({ html, className, iconSize: size, iconAnchor: anchor });
}

export function GroupMap({ members, start, destination, follow = true, fitKey = 0, onGesture }: { members: MapMember[]; start: MapDestination; destination: MapDestination; follow?: boolean; fitKey?: number; onGesture?: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const contentRef = useRef<L.LayerGroup | null>(null);
  const gestureRef = useRef(onGesture);
  gestureRef.current = onGesture;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([1.2903, 103.8519], 13);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.on('dragstart zoomstart', () => gestureRef.current?.());
    mapRef.current = map;
    contentRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; contentRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const content = contentRef.current;
    if (!map || !content) return;
    content.clearLayers();
    L.marker([start.latitude, start.longitude], { icon: icon('<span>A</span>', 'paladin-route-marker paladin-start-marker', [34, 34], [17, 17]), title: `Start: ${start.name}` }).addTo(content);
    L.marker([destination.latitude, destination.longitude], { icon: icon('<span>⚑</span>', 'paladin-route-marker paladin-end-marker', [38, 38], [19, 19]), title: `Finish: ${destination.name}` }).addTo(content);
    for (const member of members) {
      const label = escapeHtml(member.isYou ? 'YOU' : member.name);
      const initials = escapeHtml(member.initials);
      const memberIcon = icon(`<div class="paladin-member-avatar" style="background:${member.color}">${initials}</div><div class="paladin-member-label">${label}</div>`, member.isYou ? 'paladin-member-marker paladin-member-you' : 'paladin-member-marker', [48, 62], [24, 24]);
      L.marker([member.latitude, member.longitude], { icon: memberIcon, title: member.name }).addTo(content);
    }
  }, [members, start.latitude, start.longitude, start.name, destination.latitude, destination.longitude, destination.name]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visiblePoints = [start, destination, ...members];
    map.fitBounds(L.latLngBounds(visiblePoints.map((point) => [point.latitude, point.longitude])), { paddingTopLeft: [70, 100], paddingBottomRight: [90, 310], maxZoom: 16 });
  }, [fitKey, start.latitude, start.longitude, destination.latitude, destination.longitude]);

  const me = members.find((member) => member.isYou);
  useEffect(() => {
    if (follow && me && mapRef.current) mapRef.current.panTo([me.latitude, me.longitude], { animate: true });
  }, [follow, me?.latitude, me?.longitude]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, backgroundColor: colors.map }} />;
}
