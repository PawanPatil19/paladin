# Use feature-layered client modules

Paladin keeps domain rules in `src/domain`, external integrations in `src/services`, reusable presentation in `src/ui`, and screen implementations in `src/features`. This creates deep seams around authentication, activity coordination, route planning, and live tracking without introducing framework-heavy repositories or one-interface adapter abstractions that have only one implementation.
