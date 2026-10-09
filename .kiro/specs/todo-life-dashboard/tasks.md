# Implementation Plan: To-Do Life Dashboard

## Overview

Implement a self-contained, single-page productivity dashboard as three static files (`index.html`, `css/style.css`, `js/script.js`). The implementation follows the module-per-widget architecture defined in the design: shared utilities first, then each widget, then cross-cutting concerns (theme, responsiveness, accessibility), finishing with integration wiring and property-based tests.

---

## Tasks

- [ ] 1. Scaffold project structure and base HTML
  - [ ] 1.1 Create `index.html` with semantic HTML5 shell
    - Add `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` with `lang` attribute
    - Add `<header>` containing the theme toggle `<button id="theme-toggle">`
    - Add `<main>` containing four `<section>` placeholders: `#greeting-widget`, `#timer-widget`, `#task-manager`, `#quick-links`, each with the exact `aria-label` values from the design
    - Wire `<link rel="stylesheet" href="css/style.css">` in `<head>` and `<script src="js/script.js">` before `</body>`
    - _Requirements: 22.1, 22.4, 20.1_

  - [ ] 1.2 Create `css/style.css` with CSS custom properties and base reset
    - Define `--color-bg`, `--color-surface`, `--color-text`, `--color-accent` tokens for both `:root` (light) and `html.dark-mode` (dark)
    - Add a base reset (`box-sizing: border-box`, margin/padding zero, `font-family`)
    - Stub responsive layout: single-column default, two-column grid at `min-width: 768px`
    - Ensure minimum 16 px equivalent base font size and 44×44 px touch targets for `<button>` elements
    - _Requirements: 18.7, 19.1, 19.2, 19.3, 19.4, 20.5_

  - [ ] 1.3 Create `js/script.js` with module namespace stubs and `DOMContentLoaded` init sequence
    - Declare empty namespace objects: `Storage`, `Validator`, `Sanitizer`, `GreetingWidget`, `TimerWidget`, `TaskManager`, `QuickLinks`, `ThemeManager`
    - Add `DOMContentLoaded` listener that calls `init()` on each namespace in the order: `ThemeManager`, `GreetingWidget`, `TimerWidget`, `TaskManager`, `QuickLinks`
    - _Requirements: 22.1, 22.2_

- [ ] 2. Implement shared utilities
  - [ ] 2.1 Implement `Storage` utility
    - Implement `Storage.read(key, fallback)` — parses JSON, catches `JSON.parse` errors / `null` / wrong type / `SecurityError`, returns `fallback` in all error cases
    - Implement `Storage.write(key, value)` — serialises to JSON, catches `QuotaExceededError` / `SecurityError`, returns boolean
    - On `SecurityError`, set `Storage.degraded = true` and fall back to an in-memory `Map`
    - Storage keys: `tld_userName`, `tld_tasks`, `tld_links`, `tld_theme`
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [ ]* 2.2 Write property test for `Storage` utility
    - **Property 12: Task persistence round-trip** — generate valid task arrays, write then read, assert structural equality
    - **Property 13: Storage read with malformed data returns safe default** — generate arbitrary non-JSON strings and values, assert `Storage.read` never throws and always returns `fallback`
    - **Validates: Requirements 14.1, 14.4, 14.3, 21.1, 21.2**

  - [ ] 2.3 Implement `Validator` utility
    - Implement `Validator.isValidUrl(str)` — absolute `http:`/`https:` only, non-empty hostname, length ≤ 2048; use `URL` constructor for parsing; return `false` for all invalid inputs
    - Implement `Validator.isNonEmpty(str)` — returns `true` if at least one non-whitespace character exists
    - Implement `Validator.isWithinLength(str, max)` — returns `true` if `str.length <= max`
    - _Requirements: 16.2, 8.5, 8.6_

  - [ ]* 2.4 Write property test for `Validator` utility
    - **Property 14: URL validation accepts only absolute http/https URLs** — generate valid absolute URLs (http/https) → assert `true`; generate relative paths, `ftp://`, `javascript:`, empty strings, >2048 char strings → assert `false`
    - **Validates: Requirements 16.2, 16.4**

  - [ ] 2.5 Implement `Sanitizer` utility
    - Implement `Sanitizer.trim(str)` — `str.trim()`
    - Implement `Sanitizer.normalise(str)` — `str.trim().toLowerCase()`
    - _Requirements: 9.1_

- [ ] 3. Implement `ThemeManager`
  - [ ] 3.1 Implement `ThemeManager.init()` and `ThemeManager.toggle()`
    - `init()` reads `tld_theme` from `Storage`; applies `dark-mode` class to `<html>` if value is `"dark"`, otherwise applies light (default); handles unrecognised values by falling back to light
    - `toggle()` flips the `dark-mode` class on `<html>` and writes the resulting theme string back to `Storage`
    - Wire the `#theme-toggle` button's `click` event to `ThemeManager.toggle()`
    - Ensure `ThemeManager.init()` is called as the very first statement in the `DOMContentLoaded` handler to prevent theme flash
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ]* 3.2 Write property test for `ThemeManager`
    - **Property 15: Theme toggle is an involution** — for any starting theme, call `toggle()` twice, assert `<html>` class and storage value equal the initial state
    - **Property 16: Theme persists across init cycles** — store `"light"`, `"dark"`, and arbitrary strings; call `init()`, assert correct or fallback class applied
    - **Validates: Requirements 18.2, 18.3, 18.4, 18.5, 18.6**

- [ ] 4. Implement `GreetingWidget`
  - [ ] 4.1 Add Greeting Widget DOM markup to `index.html`
    - Inside `#greeting-widget`: add `<div id="clock" aria-live="polite">`, `<div id="date-display">`, `<div id="greeting-text">`, `<button id="edit-name-btn">Edit name</button>`
    - Add `<form id="name-form" hidden>` with `<label for="name-input">`, `<input id="name-input" type="text" maxlength="50">`, Save `<button type="submit">`, Cancel `<button type="button" id="cancel-name-btn">`, and `<div id="name-error" role="alert" aria-live="assertive">`
    - _Requirements: 20.2, 20.3_

  - [ ] 4.2 Implement `GreetingWidget.init()`, `setName()`, and clock tick
    - `init()` reads `tld_userName` from `Storage`, renders the greeting immediately (within 100 ms of call), then starts `setInterval(tick, 1000)`
    - `tick()` calls `new Date()`; if it throws, clears the interval and shows an error in `#clock`; otherwise updates `#clock` (HH:MM:SS), `#date-display` (full locale date), and `#greeting-text`
    - `getGreeting(hour)` pure function: 5–11 → "Good Morning", 12–17 → "Good Afternoon", 18–21 → "Good Evening", 22–23 and 0–4 → "Good Night"; fallback "Hello" if hour is invalid
    - `setName(name)` validates (non-empty, ≤ 50 chars), saves to `Storage`, updates `#greeting-text`; shows error in `#name-error` on failure; retains previous name on validation failure
    - Wire `#edit-name-btn`, `#name-form` submit, and `#cancel-name-btn` events
    - If `Storage.degraded`, show non-blocking banner
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 4.3 Write property test for `getGreeting`
    - **Property 1: Time-based greeting completeness** — generate `hour` in 0–23, assert result is one of the four valid strings, never empty/undefined
    - **Property 2: Greeting boundary coverage is exhaustive and non-overlapping** — generate pairs `(h1, h2)` in the same boundary range → assert same greeting; in different ranges → assert different greeting
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ] 5. Checkpoint — utilities and greeting working
  - Ensure `ThemeManager`, `Storage`, `Validator`, `Sanitizer`, and `GreetingWidget` unit and property tests pass. Ask the user if questions arise.

- [ ] 6. Implement `TimerWidget`
  - [ ] 6.1 Add Timer Widget DOM markup to `index.html`
    - Inside `#timer-widget`: add `<div id="timer-display" aria-live="polite">25:00</div>`, `<div id="timer-controls">` with `<button id="timer-start">Start</button>`, `<button id="timer-stop" disabled>Stop</button>`, `<button id="timer-reset">Reset</button>`, and `<div id="timer-alert" role="alert" aria-live="assertive" hidden>`
    - _Requirements: 4.1, 4.2, 4.3, 20.3_

  - [ ] 6.2 Implement `TimerWidget.init()`, `start()`, `stop()`, and `reset()`
    - `init()` sets state to STOPPED, renders 25:00, wires button click events; shows error message in timer area if any DOM element is missing
    - `start()` guards against double-interval: check `_intervalId !== null`; if state is STOPPED or PAUSED and `remaining > 0`, call `setInterval` (1000 ms), set state to RUNNING, disable Start, enable Stop
    - `stop()` clears interval, sets state to PAUSED, enables Start, disables Stop
    - `reset()` clears interval, sets `remaining` to 1500 (25 × 60), renders "25:00", sets state to STOPPED, enables Start, disables Stop
    - On each tick, decrement `remaining`, update `#timer-display` in MM:SS; when `remaining` reaches 0, call `_onComplete()`
    - `_onComplete()`: clear interval, show `#timer-alert`, request browser notification if `Notification.permission === "granted"`, reset display to 25:00, set state to STOPPED
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. Implement `TaskManager`
  - [ ] 7.1 Add Task Manager DOM markup to `index.html`
    - Inside `#task-manager`: add `<form id="task-form">` with labelled `<input id="task-input" type="text" maxlength="500">`, `<button type="submit">Add</button>`, and `<div id="task-add-error" role="alert" aria-live="assertive">`
    - Add `<div id="task-sort-controls">` with labelled `<select id="task-sort">` containing options: `active-first` (default), `completed-first`, `date-added`
    - Add `<ul id="task-list" aria-live="polite" aria-label="Tasks">`
    - _Requirements: 8.1, 13.1, 20.2, 20.3_

  - [ ] 7.2 Implement `TaskManager.init()` and `render()`
    - `init()` reads `tld_tasks` from `Storage`; on malformed data logs error and treats as `[]`; calls `render()`; wires form submit and sort-change events
    - `render()` builds the task list DOM from `_tasks` applying current sort mode; for each task generates the `<li>` template from the design (checkbox, label, Edit btn, Delete btn, edit-error div); shows empty-state message when `_tasks.length === 0`
    - _Requirements: 14.1, 14.2, 14.3, 12.5, 13.5_

  - [ ] 7.3 Implement `TaskManager.addTask(text)`
    - Validate non-empty (Req 8.5), ≤ 500 chars (Req 8.6), non-duplicate via `Sanitizer.normalise` comparison (Req 9.1, 9.2)
    - On success: push new `Task` object (`crypto.randomUUID()` or `Date.now()` fallback for id, trimmed text, `completed: false`, `createdAt: Date.now()`), call `Storage.write`, call `render()`, clear input
    - On storage write failure: show inline error, do not add task to `_tasks`
    - On validation failure: show specific error in `#task-add-error`, retain input value
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 14.4, 14.5_

  - [ ]* 7.4 Write property test for task addition
    - **Property 3: Task addition grows the list by exactly one** — generate task list + valid text, call `addTask`, assert length is N+1 and new task at end
    - **Property 4: Whitespace-only and empty task text is always rejected** — generate whitespace/empty strings, assert list unchanged and error returned
    - **Property 5: Task text over 500 characters is always rejected** — generate strings with length > 500, assert list unchanged and error returned
    - **Property 6: Duplicate task prevention (case-insensitive, whitespace-normalised)** — generate list + text whose normalised form matches an existing task, assert rejection
    - **Property 7: Task text original formatting is preserved** — generate mixed-case text, assert stored text equals `Sanitizer.trim(input)`
    - **Validates: Requirements 8.2, 8.3, 8.5, 8.6, 9.1, 9.2, 9.3**

  - [ ] 7.5 Implement `TaskManager.toggleTask(id)`
    - Flip `completed` on the matching task, call `Storage.write`, call `render()`
    - On storage write failure: show error indication; retain toggled state in session (do not revert)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 7.6 Write property test for task toggle
    - **Property 8: Task completion toggle is an involution** — generate a task, call `toggleTask` twice, assert original `completed` state restored
    - **Validates: Requirements 10.2, 10.3**

  - [ ] 7.7 Implement `TaskManager.editTask(id, text)` and inline edit UX
    - `editTask(id, text)`: validate non-empty, run duplicate check excluding self (`Sanitizer.normalise` comparison against all other tasks), update task text, call `Storage.write`, call `render()`
    - On validation/duplicate failure: show error in the task's `<div class="task-edit-error">`, retain editable input active
    - Wire Edit button click: replace label with `<input class="task-edit-input">` pre-filled with current text, cursor at end; wire Enter (confirm) and Escape (cancel) key events and save/cancel buttons
    - Cancel: restore label, discard changes, no storage write
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 7.8 Write property test for inline edit duplicate prevention
    - **Property 9: Inline edit duplicate prevention excludes self** — generate a task list, call `editTask` with the same task's own normalised text, assert success (no rejection)
    - **Validates: Requirements 11.3**

  - [ ] 7.9 Implement `TaskManager.deleteTask(id)` and `TaskManager.sortTasks(mode)`
    - `deleteTask(id)`: remove from `_tasks`, call `Storage.write`, call `render()`; if write fails, show error and restore the task at its original index
    - `sortTasks(mode)`: build a display-copy sorted array without mutating `_tasks` canonical order; re-render within 100 ms
    - Wire delete button click events and sort `<select>` change event
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 7.10 Write property test for sorting
    - **Property 10: Sorting preserves task count and content** — generate task list + sort mode, call `sortTasks`, assert same IDs/texts in rendered output
    - **Property 11: Active-First sort places all active tasks before all completed tasks** — generate mixed task list, render in "Active First" mode, assert all active DOM positions precede all completed DOM positions
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.6**

- [ ] 8. Checkpoint — timer and task manager working
  - Ensure `TimerWidget` and `TaskManager` unit and property tests pass. Ask the user if questions arise.

- [ ] 9. Implement `QuickLinks`
  - [ ] 9.1 Add Quick Links DOM markup to `index.html`
    - Inside `#quick-links`: add `<form id="link-form">` with labelled `<input id="link-label-input" type="text" maxlength="100">`, labelled `<input id="link-url-input" type="url" maxlength="2048">`, `<button type="submit">Add Link</button>`, and `<div id="link-add-error" role="alert" aria-live="assertive">`
    - Add `<ul id="link-list" aria-label="Quick Links">`
    - _Requirements: 16.1, 20.2_

  - [ ] 9.2 Implement `QuickLinks.init()` and `render()`
    - `init()` reads `tld_links` from `Storage`; skips malformed entries (missing/relative URL) with a `console.warn`; calls `render()`; wires form submit event
    - `render()` builds the link list: for each link generates `<li data-id>` with `<a href target="_blank" rel="noopener noreferrer">` and `<button class="link-remove-btn" aria-label="Remove {label}">`; shows empty-state message when list is empty
    - If `Storage` read fails entirely, show error message and render no buttons
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 9.3 Implement `QuickLinks.addLink(label, url)` and `removeLink(id)`
    - `addLink`: validate label non-empty and url via `Validator.isValidUrl`; on success push `Link` object, call `Storage.write`, call `render()`, clear inputs; on validation failure show specific error in `#link-add-error` and retain inputs; on storage failure show error and do not add to list
    - `removeLink(id)`: show `window.confirm()` prompt; if confirmed, remove from `_links`, call `Storage.write`; if write fails, show error and restore link at original position
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 17.1, 17.2, 17.3, 17.4_

- [ ] 10. Apply CSS styles for all widgets and both themes
  - [ ] 10.1 Style `GreetingWidget`, `TimerWidget`, and global layout
    - Style `#greeting-widget`: clock, date, greeting typography, name-form show/hide (`[hidden]` attribute)
    - Style `#timer-widget`: large `#timer-display` font, button states (disabled opacity), `#timer-alert` visible/hidden states
    - Complete responsive grid: `display: grid; grid-template-columns: 1fr` below 768 px; `grid-template-columns: 1fr 1fr` at and above 768 px
    - Style `<header>` with `#theme-toggle` button
    - _Requirements: 18.7, 19.1, 19.2, 19.3, 19.5_

  - [ ] 10.2 Style `TaskManager` and `QuickLinks`
    - Style task list items: checkbox, label, strikethrough + dimmed for completed, edit/delete buttons, inline edit input, error messages
    - Style sort `<select>` control
    - Style quick-link list items: anchor buttons, remove button
    - Apply all dark-mode overrides under `html.dark-mode` using the CSS custom property tokens defined in task 1.2
    - Verify visible focus indicators (minimum 2 px outline) on all interactive controls in both themes
    - _Requirements: 10.2, 10.3, 18.7, 20.4, 20.5_

- [ ] 11. Wire `Storage.degraded` warning banner
  - Add a visually distinct, non-blocking `<div id="storage-warning" hidden>` banner in `index.html` with a message indicating data will not be persisted
  - In `ThemeManager.init()` (or a post-init check), inspect `Storage.degraded`; if `true`, un-hide the banner
  - _Requirements: 21.3_

- [ ] 12. Accessibility pass
  - [ ] 12.1 Audit and complete ARIA attributes across all widgets
    - Confirm all `aria-live` regions are in place as specified in the design: `polite` on `#clock`, `#task-list`, `#timer-display`; `assertive` on all `role="alert"` error divs
    - Confirm all `<input>` elements have associated `<label>` or `aria-label`
    - Confirm all icon-only buttons have `aria-label` text
    - _Requirements: 20.2, 20.3_

  - [ ] 12.2 Implement focus trap for name-edit form
    - When `#name-form` is shown, move focus to `#name-input`
    - Trap Tab / Shift+Tab within `#name-form` while it is visible; release trap when form is hidden
    - _Requirements: 20.6_

- [ ] 13. Final checkpoint — all tests pass and full integration verified
  - Run all unit and property tests; ensure zero failures
  - Open `index.html` via `file://` protocol and verify: no console errors on load, theme applied before first paint, all four widgets visible and interactive with empty storage, timer counts down from 25:00, task and link persistence survive page reload
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at natural boundaries
- Property tests validate universal correctness properties (Properties 1–16 from the design)
- Unit tests validate specific examples, edge cases, and error conditions
- The `Storage` utility must be implemented before any widget, as all widgets depend on it
- `ThemeManager.init()` must remain the first call in `DOMContentLoaded` to prevent theme flash (Requirement 18.4)
- `crypto.randomUUID()` is used for IDs with `Date.now().toString()` as a fallback for older browsers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1", "7.1", "9.1"] },
    { "id": 5, "tasks": ["4.3", "6.2", "7.2"] },
    { "id": 6, "tasks": ["7.3", "9.2"] },
    { "id": 7, "tasks": ["7.4", "7.5", "9.3"] },
    { "id": 8, "tasks": ["7.6", "7.7"] },
    { "id": 9, "tasks": ["7.8", "7.9"] },
    { "id": 10, "tasks": ["7.10", "10.1"] },
    { "id": 11, "tasks": ["10.2", "11"] },
    { "id": 12, "tasks": ["12.1", "12.2"] }
  ]
}
```
