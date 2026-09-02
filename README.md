# Paladin

Paladin is a Singapore-focused Expo mobile app for group runs and rides. A leader creates an outing, shares a six-character code, and everyone in the group sees the same destination, live member locations, and voice cheers.

## Run it on two phones

Requirements: Node.js 22+, the Expo Go app, and both phones on the same Wi-Fi network as the development computer.

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
5. Start the outing. Allow location access, turn on voice cheers, and keep earphones connected.

If the service is hosted elsewhere or automatic discovery is unavailable, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to its HTTP or HTTPS address. A physical phone cannot use `localhost` to reach a server on the computer.

## What is implemented

- Real shared six-character group codes
- Create and join flows for runs and rides
- Singapore destination presets
- Live foreground GPS location syncing
- Shared map markers and route framing
- GPS-based distance, pace, and speed
- Voice cheers spoken automatically with `expo-speech`
- Group lobby updates and automatic transition when an outing starts
- Haptics, code sharing, and graceful reconnect behaviour

The included Node service keeps active outings in memory, which is ideal for local MVP testing. Deploy it behind HTTPS with durable storage before releasing the app publicly.

## Checks

```bash
npm run typecheck
npm run test:server
npx expo export --platform android --output-dir /tmp/paladin-dist
```
