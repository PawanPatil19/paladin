# Paladin product direction

## Product model

Paladin is for authenticated running and cycling groups that want to stay aware of one another during an activity and reconnect afterward without becoming a public social network. The core loop is:

`invite → choose visibility → move and check in → finish → mutually reconnect → plan again`

## Ranked findings

### P0

1. Web leave, removal, route-change, and sign-out actions relied on platform alerts that did not appear.
2. Exact coordinates could remain visible after a failed leave and stale locations looked live because heartbeats were used as location freshness.
3. The location endpoint accepted impossible coordinates and accepted uploads before an activity began.

### P1

1. Activity setup made optional meeting points feel like mandatory route planning.
2. Users had no activity-scoped visibility choice, pause, block, report, or removal ban.
3. The map did not explain uncertainty, intent, or what action to take with a participant.
4. Arbitrary API text could be broadcast and automatically spoken.
5. Completion was a social dead end; participants had no low-pressure way to reconnect.
6. Demo distance and average speed contradicted the displayed current speed.

### P2 and later

1. Move group state transitions from whole-payload replacement to transactional database operations to eliminate concurrent lost updates.
2. Add host-approved, privacy-safe activity discovery only after moderation operations, age policy, and durable cross-group blocks exist.
3. Add structured invitations for mutual kaki and optional recurring group rituals.

## Map concepts considered

| Direction | Clarity | Emotional feel | Privacy | Complexity | Connection fit | Decision |
|---|---|---|---|---|---|---|
| Human Presence: exact avatar pins | High | Personal but watchful | Low | Low | Medium | Rejected as the default |
| Trusted Group: initials, uncertainty halo, freshness, Circle Check | High | Calm and cooperative | High | Medium | High | Implemented |
| Ambient Social Clusters: public activity energy by area | Medium | Serendipitous | Medium with strict aggregation | High | Potentially high | Deferred |

The implemented visual language distinguishes people from place pins, labels the current participant, uses a soft halo for approximate presence, fades delayed markers, removes expired markers, and shows structured group status in participant cards. It remains useful for a private group without exposing strangers.

## Friendship journey

1. People first meet through an invite-only shared activity, not a public profile browser.
2. Before sharing, each participant sees the audience and chooses hidden, approximate, or precise visibility.
3. During the activity, Circle Check and allow-listed cheers provide low-pressure, contextual interaction.
4. After finishing, each participant can privately choose “Again” for someone they enjoyed moving with.
5. No request or rejection is revealed. A Kaki Connection appears only when both choose one another.
6. Mutual kaki appear on Home with shared-activity context and a shortcut to create another private group.
7. Either participant can block or report from the live participant card; blocked pairs cannot create a connection.

## Signature experiences

- **Circle Check:** tell the whole group “all good,” “ease up,” “break,” or “help” without typing.
- **Visibility with an honest shape:** approximate presence looks approximate instead of pretending to be a precise pin.
- **Kaki Again:** turn a real shared activity into a mutual connection without exposing a one-sided request.
- **Automatic disappearance:** a stale or paused location vanishes rather than becoming a misleading permanent dot.
