# Milestone 3 Validation

Validated: 2026-10-26

## Outcome

The complete supported reminder and event model can now be created and managed without voice. The manual product uses the Milestone 2 domain and repository APIs rather than duplicating scheduling behavior in the UI.

## Implemented surfaces

- Today/upcoming groups with explicit overdue, today, upcoming, paused, ended, and completed presentation
- Reminder and event details with schedule, next occurrence, notification health, and recent occurrence history
- Manual create/edit form for one-time, interval, weekday, multi-time, active-window, fixed, and completion-relative schedules
- Inclusive date and occurrence-count stopping rules
- Fixed and follow-device time-zone policies
- Event duration, location, and alert-offset controls
- Complete, 10/30/60-minute snooze, single-occurrence reschedule, pause, resume, end, edit, and delete actions
- Notification-permission explanation, request, denial recovery, and system-settings route
- Empty, loading, validation, registration-warning, and operation-error states

## Deterministic boundary

The form is adapted into `ScheduledItemDefinition` and passed through `validateScheduledItem`. Its always-visible next-occurrence preview comes from the deterministic occurrence generator. Create and edit operations use the transactional schedule repository and run notification reconciliation after each mutation.

The UI does not maintain a second recurrence interpretation. Illegal combinations remain unsaveable and show the domain validation message beside the action area.

## Accessibility evidence

- Screen-reader labels include the affected item for complete, snooze, pause, resume, end, edit, and delete actions.
- Schedule summaries are meaningful when read linearly and do not rely on color.
- Overdue, status, permission, validation, and notification-failure states include visible text.
- Touch controls use at least 44-point targets.
- Scrollable screens, wrapped action rows, unconstrained critical text, and scalable React Native text preserve workflows at larger text sizes.
- The iOS accessibility tree exposed the complete Today, editor, and detail workflows in visual order during simulator validation.

## Reliability corrections made during UI integration

- Snooze and reschedule retain the old platform identifier until reconciliation cancels the obsolete notification, preventing duplicate alerts.
- Reconciliation does not request notification permission before the explanatory onboarding UI.
- Fixed schedules persist only the most recent unresolved overdue occurrence; older overdue occurrences become missed without replaying a notification burst.

## Automated evidence

Command:

```bash
npm run check
```

Result:

- Milestone 0 corpus validation passed with 70 cases.
- Strict TypeScript compilation passed.
- 81 tests across 11 files passed.
- New tests cover manual form adaptation, illegal-combination rejection, next-occurrence preview, linear recurrence summaries, and completed-state derivation.

Bundle validation:

```bash
npx expo export --platform ios
```

Result: the production iOS JavaScript bundle completed successfully.

## Simulator evidence

Environment:

- iPhone 17 Pro simulator
- iOS 26.3
- Expo SDK 58 development build

Validated:

- The native build compiled, installed, and loaded from Metro.
- Today/upcoming rendered existing persisted data with next occurrence and quick actions.
- The manual editor exposed item type, date/time, time-zone, every supported recurrence unit, interval, active hours, timing anchor, and stopping controls.
- Entering a title immediately produced the deterministic next-occurrence preview and enabled creation.
- Switching to hourly recurrence revealed interval, active-window, fixed/completion, and ending controls with correct accessibility states.
- Item details rendered status, next occurrence, schedule, completion and snooze choices, single-occurrence rescheduling, management actions, and history.

## Deferred qualification

Milestone 3 validates the product workflow in the simulator. Physical iOS/Android notification delivery, notification actions, process restart behavior, screen-reader testing on both platforms, multi-day delivery, battery, memory, and thermal behavior remain Milestone 6/private-beta gates as already documented.
