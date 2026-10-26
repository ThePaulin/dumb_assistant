# MVP UX Flows

These low-fidelity flows establish screen responsibilities and decision points. They are behavioral wireframes, not final visual design.

## Navigation map

```text
Onboarding / permission recovery
              |
              v
Today & Upcoming <----------> Item details <----------> Item editor
      |
      +---- microphone ----> Voice capture
      |                           |
      +---- text ------------+    v
                             +-> Interpretation preview
                                      |
                         +------------+-------------+
                         |                          |
                  Clarification                 Confirm
                         |                          |
                         +------> Preview <----------+
                                                    |
                                                    v
                                            Today & Upcoming
```

## 1. First-run onboarding

```text
+----------------------------------+
| Turn speech into reminders       |
|                                  |
| "Every 3 hours between 9 and 6" |
|                                  |
| [Continue]                       |
+----------------------------------+
                 |
                 v
+----------------------------------+
| Notifications are required       |
| We use them for reminders.       |
|                                  |
| [Enable notifications]           |
| [Not now]                        |
+----------------------------------+
```

Microphone permission is requested only when the user first starts recording, after an explanation. Declining voice permission never blocks text or manual creation.

## 2. Today and upcoming

```text
+----------------------------------+
| Today                       [+]   |
|                                  |
| OVERDUE                          |
| [ ] Take medication       9:00   |
|     [Complete] [Snooze]          |
|                                  |
| NEXT                             |
| [ ] Drink water          12:00   |
|     Every 3h until 18:00         |
|                                  |
| Tomorrow                         |
|     Dentist             14:30    |
|                                  |
| [Type a request...]        [mic] |
+----------------------------------+
```

Requirements:

- Each row exposes title, next occurrence, item type, and recurrence summary.
- Overdue is textual and not communicated by color alone.
- Complete and snooze are available without opening details.
- Permission or registration failures appear as actionable banners.

## 3. Voice capture

```text
+----------------------------------+
| Cancel                           |
|                                  |
|             ( waveform )         |
|              00:08               |
|                                  |
| "Starting tomorrow, remind me…" |
|                                  |
| [Stop and review]                |
+----------------------------------+
```

States:

- Ready
- Requesting permission
- Recording
- Stopping/uploading
- Transcribing
- Failed with retry and switch-to-text actions
- Cancelled with immediate audio deletion

Recording stops when the user acts, the configured duration limit is reached, or the app loses microphone access. Background recording is not part of the MVP.

## 4. Interpretation preview

```text
+----------------------------------+
| Review reminder                  |
|                                  |
| Drink water                 Edit |
| Starts  Tue, Oct 27 at 9:00      |
| Every   3 hours                  |
| Window  9:00–18:00               |
| Ends    Fri, Oct 30              |
| Zone    Follow device time       |
|                                  |
| "Starting tomorrow…"            |
|                                  |
| [Confirm reminder]               |
| [Cancel]                         |
+----------------------------------+
```

Requirements:

- Critical fields are readable without expanding anything.
- Inferred or adjusted fields carry a visible label and accessible explanation.
- Edit opens the full editor with the proposal prefilled.
- Confirm is disabled if deterministic validation fails.
- The transcript is visible only during the draft flow and is discarded after confirm or cancel.

## 5. Clarification

```text
+----------------------------------+
| One detail needed                |
|                                  |
| What time should I remind you    |
| to call Sam?                     |
|                                  |
| [Time input]                     |
|                                  |
| [Continue]                       |
| [Edit everything]                |
+----------------------------------+
```

- Ask one question at a time.
- Preserve already-understood fields.
- Prefer constrained controls for dates, times, and choices while still allowing a spoken answer.
- After the answer, return to preview rather than saving automatically.

## 6. Manual item editor

```text
+----------------------------------+
| Edit reminder                    |
| Title       [Drink water       ] |
| Notes       [                  ] |
| Starts      [Oct 27] [09:00]     |
| Repeats     [Every 3 hours     ] |
| Active      [09:00] to [18:00]  |
| Ends        [On Oct 30         ] |
| Timing      [Fixed schedule    ] |
| Time zone   [Follow device     ] |
|                                  |
| Next: Tue, Oct 27 at 09:00       |
| [Save]                           |
+----------------------------------+
```

- Hide irrelevant fields progressively, but never hide the calculated next occurrence.
- Explain fixed versus completion-relative timing inline.
- Invalid combinations are prevented or explained adjacent to the field.
- All supported schedules can be created without voice.

## 7. Item details

```text
+----------------------------------+
| Drink water                Edit  |
| Active                           |
|                                  |
| Next: Today at 12:00             |
| Every 3 hours, 09:00–18:00       |
| Ends Oct 30                      |
|                                  |
| [Complete] [Snooze]              |
| [Pause]    [Delete]              |
|                                  |
| Recent                           |
| 09:00 Completed at 09:12         |
+----------------------------------+
```

For completion-relative reminders, the details screen explicitly says that no next occurrence is created until the current one is completed.

## 8. Notification-permission recovery

```text
+----------------------------------+
| Reminders cannot notify you      |
| Notifications are disabled in    |
| system settings. Your schedules  |
| are still saved.                 |
|                                  |
| [Open settings]                  |
| [Dismiss]                        |
+----------------------------------+
```

The app never claims a reminder is fully operational when registration or permissions failed.

## Accessibility acceptance criteria

- VoiceOver and TalkBack announce recording state and elapsed time without excessive repetition.
- Every schedule summary is meaningful when read linearly.
- Controls have labels that include the affected item where needed.
- Dynamic type does not truncate dates, times, validation errors, or primary actions.
- Error, warning, overdue, and uncertain states use text or icons in addition to color.
- Touch targets meet platform guidance.
- Motion-heavy recording feedback respects reduced-motion settings.
- Keyboard and switch-control focus follows the visual order.

## AI and model settings

```text
+----------------------------------+
| Voice & interpretation           |
|                                  |
| On-device models                 |
| Whisper Tiny          58 MB [x]  |
| Schedule model       398 MB [x]  |
| [Check for model updates]        |
|                                  |
| Remote model                     |
| OpenRouter          Not connected|
| [Connect OpenRouter]              |
|                                  |
| Audio retained: Never            |
| Transcript retained: Until save  |
+----------------------------------+
```

- Model download shows exact size, network type, progress, pause/cancel, and storage errors.
- Deleting a model never deletes reminders or events.
- Connecting OpenRouter opens OAuth PKCE and returns through an application deep link.
- Before first remote use, the app explains that transcript text and schedule context will leave the device.
- The connected model, credit-limit reminder, activity link, and disconnect/revoke actions remain visible.
- Devices that fail local capability checks default to manual creation and explain the optional remote route without blocking the app.
