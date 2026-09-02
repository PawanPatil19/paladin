<p align="center">
  <img src="assets/cycling-hero.png" alt="A group of cyclists riding together at sunset" width="100%" />
</p>

<h1 align="center">Paladin</h1>

<p align="center"><strong>The run or ride is better when no one gets left behind.</strong></p>

<p align="center">
  Paladin is a shared activity companion for running and cycling groups—keeping every participant connected on a real mapped route without taking their attention off the road or trail.
</p>

## Maps and routing

The web app renders an interactive Leaflet street map; native builds use the platform map through `react-native-maps`. Route geometry is requested from the Paladin API, which validates Singapore coordinates, selects a pedestrian or bicycle routing profile, limits geometry size, and caches results.

Local development defaults to OpenStreetMap tiles and the OpenStreetMap.de community routing endpoints. Before serving public production traffic, configure `EXPO_PUBLIC_MAP_TILE_URL`, `EXPO_PUBLIC_MAP_ATTRIBUTION`, `ROUTING_RUN_URL`, and `ROUTING_RIDE_URL` for tile and OSRM-compatible routing services covered by your own usage plan or infrastructure.
