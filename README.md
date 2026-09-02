<p align="center">
  <img src="assets/cycling-hero.png" alt="A group of cyclists riding together at sunset" width="100%" />
</p>

<h1 align="center">Paladin</h1>

<p align="center"><strong>The run or ride is better when no one gets left behind.</strong></p>

<p align="center">
  Paladin is a shared activity companion for running and cycling groups—keeping every participant visible and connected without taking their attention off the road or trail.
</p>

## Live maps

The web app renders an interactive Leaflet street map; native builds use the platform map through `react-native-maps`. The light monochrome treatment keeps participant locations, meeting points, cheers, and safety controls visually prominent.

Local development defaults to OpenStreetMap tiles. Before serving public production traffic, configure `EXPO_PUBLIC_MAP_TILE_URL` and `EXPO_PUBLIC_MAP_ATTRIBUTION` for a tile service covered by your own usage plan or infrastructure.
