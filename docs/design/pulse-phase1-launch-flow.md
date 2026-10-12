# PULSE Phase 1 launch UX

![Four-state PULSE Phase 1 launch flow](./pulse-phase1-launch-flow.svg)

## States

1. **Ready to vote:** question, equal YES/NO options, and explicit result timing.
2. **Confirm choice:** selection is visible and requires an explicit submit action.
3. **Vote receipt:** confirms the accepted vote without exposing a trend.
4. **Next-day reveal:** yesterday's result leads directly into today's question.

## Visual system

- One muted blue accent (`#315FC7`) plus warm, low-saturation neutral surfaces and text.
- System typography for international coverage and platform familiarity.
- Matte tonal separation replaces gloss: no content gradients, no translucent chrome, and no card shadows.
- YES and NO never rely on green/red semantics.
- Controls are designed to exceed 44 logical pixels in height.

## Spatial rhythm

- The question stays in the upper reading zone.
- The answer and submit controls sit lower in the comfortable thumb zone.
- Supporting information anchors the bottom instead of leaving accidental dead space.
- Production implementation should use flexible vertical regions (`flexGrow` and `space-between`), not fixed coordinates, so large text and short screens can collapse spacing safely.

## Figma handoff

Drag `pulse-phase1-launch-flow.svg` into Figma. Figma imports the SVG as editable vector and text layers. Treat it as a UX direction, not production measurements; spacing and type must still be validated on representative iOS and Android devices and with translated strings.
