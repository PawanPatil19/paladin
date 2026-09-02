# Paladin

Paladin is an Expo mobile app that keeps cycling groups connected with a short join code, live rider locations, ride statistics, and one-tap voice cheers.

## Run it on two phones

Requirements: Node.js 22+ and both phones on the same Wi-Fi network as the development computer. Expo Go supports foreground testing; use a development build to verify background location and screen-lock behavior.

1. Start the shared group service:

   ```bash
   npm run server
   ```

2. In a second terminal, start Expo:

   ```bash
   npm start
   ```

3. Open the Expo QR code on both phones. Paladin automatically derives the group service address from the Expo development host.
4. Create a group on one phone and join with the displayed code on the other.
5. Start the ride, allow location access, and test location updates and cheers in both directions.

If the service is hosted elsewhere or automatic discovery is unavailable, set `EXPO_PUBLIC_API_URL` in `.env`. A physical phone cannot use `localhost` to reach a server on the computer.

## What is implemented

- Real shared six-character group codes
- First-launch onboarding and explicit location permission UX
- Create, join, resume, leave, transfer-host, and end-ride flows
- Singapore destination presets
- Foreground and background GPS syncing in native development/production builds
- Noise-filtered distance, current speed, average speed, and timestamp-based timer
- Map follow/recenter and whole-group controls with freshness states
- Queued text-to-speech quick cheers with persistent mute settings
- Automatic lobby/start/end propagation, cached offline ride state, and restart restoration
- Ride summary, local ride history, profile/settings, metric and imperial units
- Copy/share invite actions, friendly errors, loading guards, and development-only simulated movement

The included Node service keeps active rides in memory. Before public release it still needs an HTTPS host and durable server-side storage; those deployment concerns are intentionally outside this functional v1 pass.

## Checks

```bash
npm run typecheck
npm run test:server
npx expo export --platform android --output-dir /tmp/paladin-dist
```
