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

Without production credentials the Node service uses an isolated in-memory store for local testing. Production mode requires the durable Supabase configuration below.

## Public-user setup

Paladin now supports Supabase email/password accounts, durable PostgreSQL ride state, cloud profiles/history, authenticated API requests, and password recovery. Local development intentionally falls back to the in-memory store; `NODE_ENV=production` fails to start unless durable credentials exist.

1. Create a Supabase project.
2. Run `supabase/migrations/202609020001_paladin_public_v1.sql` in the Supabase SQL editor.
3. In Supabase Authentication URL Configuration, add `paladin://reset-password` as an allowed redirect URL. Keep email confirmation enabled for public accounts.
4. Copy `.env.example` to `.env` and fill in the app-safe values:

   ```bash
   EXPO_PUBLIC_API_URL=https://your-api.example.com
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   EXPO_PUBLIC_AUTH_REDIRECT_URL=paladin://reset-password
   ```

5. Configure the API host with server-only values:

   ```bash
   NODE_ENV=production
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ALLOWED_ORIGIN=https://your-web-app.example.com
   ```

6. Deploy the included `Dockerfile` to any HTTPS container host. Its health endpoint is `GET /health`.

Never place `SUPABASE_SECRET_KEY` in an `EXPO_PUBLIC_` variable, mobile build, browser configuration, commit, or client log. The database migration enables RLS and revokes direct `anon` and `authenticated` table access; only the authenticated Paladin API uses the server secret.

For local UI work without public credentials, the server remains available through `npm run server`. The app itself displays a configuration screen until its publishable Supabase variables are present, preventing an accidental device-only public release.

## Checks

```bash
npm run typecheck
npm run test:server
npx expo export --platform android --output-dir /tmp/paladin-dist
```
