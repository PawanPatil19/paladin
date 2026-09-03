# Paladin Group Activities

Paladin coordinates a group of people completing the same outdoor activity while sharing a route and live presence.

## Language

**Activity**:
A time-bounded group session whose kind is either **Run** or **Ride**.
_Avoid_: Workout, trip

**Run**:
An **Activity** completed on foot and measured primarily by pace.
_Avoid_: Jog

**Ride**:
An **Activity** completed by bicycle and measured primarily by speed.
_Avoid_: Cycle, cycling session

**Route**:
The ordered pair of a **Start Point** and **End Point** selected for an **Activity**.
_Avoid_: Destination

**Start Point**:
The named coordinate where an **Activity** begins.
_Avoid_: Origin, pickup

**End Point**:
The named coordinate where an **Activity** finishes.
_Avoid_: Destination, endpoint

**Group**:
The participants connected to one **Activity** through a six-character code.
_Avoid_: Team, room

**Participant**:
An authenticated Paladin user who belongs to a **Group**.
_Avoid_: Member, rider, runner

**Presence**:
The temporary activity-scoped state a **Participant** shares with a **Group**, including **Visibility**, location freshness, and **Circle Check**.
_Avoid_: Tracking record

**Visibility**:
A **Participant**'s per-**Activity** choice to be hidden, approximately located, or precisely located. It is never inherited as permanent public presence.
_Avoid_: Privacy setting

**Circle Check**:
A one-tap, structured status during an **Activity**: all good, ease up, taking a break, or need help.
_Avoid_: Message, post

**Kaki Connection**:
A private relationship created only when two **Participants** from a completed **Activity** both choose to move together again.
_Avoid_: Follow, friend request

## Relationships

- An **Activity** has exactly one **Route**.
- A **Route** has exactly one **Start Point** and one **End Point**.
- A **Group** coordinates exactly one **Activity**.
- A **Group** contains one or more **Participants**.
- A **Participant** controls one temporary **Presence** for each **Activity**.
- A **Kaki Connection** requires two matching private intentions from the same completed **Activity**.

## Example dialogue

> **Dev:** “Does a **Ride** and a **Run** use the same **Route** model?”
> **Domain expert:** “Yes. Both are **Activities** with one **Start Point** and one **End Point**; only their primary metric and language differ.”

## Flagged ambiguities

- “ride” previously meant every **Activity**; resolved: **Activity** is generic, while **Ride** means cycling only.
- “destination” previously represented the whole route; resolved: it is the **End Point** of a **Route**.
