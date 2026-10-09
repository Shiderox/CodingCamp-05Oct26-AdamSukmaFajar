# Design Document — To-Do Life Dashboard

## Overview

The To-Do Life Dashboard is a self-contained, single-page productivity application delivered as three static files: `index.html`, `css/style.css`, and `js/script.js`. It runs entirely in the browser with no server, no build step, and no external dependencies.

The application is composed of four feature widgets:

| Widget | Responsibility |
|---|---|
| **Greeting Widget** | Live clock/date display + time-based personalized greeting |
| **Focus Timer** | Pomodoro-style 25-minute countdown with Start/Stop/Reset |
| **Task Manager** | CRUD task list with duplicate prevention, sorting, and inline editing |
| **Quick Links** | User-defined URL shortcuts that open in a new tab |

Cross-cutting concerns:
- **Theme**: Light/Dark toggle, preference saved to localStorage.
- **Persistence**: All user data lives in `localStorage`; every mutation is written synchronously before it is considered complete.
- **Accessibility**: Semantic HTML5 landmarks, ARIA live regions, visible focus indicators, minimum 4.5:1 contrast.
- **Responsiveness**: Single-column ≤ 767 px; multi-column ≥ 768 px.

---

## Architecture

The application follows a **module-per-widget** architecture within a single JS file. Each widget is an immediately-invoked object literal (or namespace object) that owns its own DOM references, state, and storage key. Widgets communicate only through shared utilities (`Storage`, `Validator`, `Sanitizer`).

```
js/script.js
├── Utilities
│   ├── Storage       — safe localStorage wrapper (read/write/fallback)
│   ├── Validator     — URL and input validation helpers
│   └── Sanitizer     — whitespace trim + lowercase normalisation
├── GreetingWidget    — clock, date, greeting, name customisation
├── TimerWidget       — countdown logic, controls, completion alert
├── TaskManager       — task CRUD, duplicate prevention, sort, persistence
├── QuickLinks        — link CRUD, URL validation, persistence
└── ThemeManager      — light/dark toggle, persistence, flash prevention
```

### Initialization sequence

```
DOMContentLoaded
  └─ ThemeManager.init()   ← runs first to prevent flash
  └─ GreetingWidget.init()
  └─ TimerWidget.init()
  └─ TaskManager.init()
  └─ QuickLinks.init()
```

`ThemeManager.init()` is called first so that the correct CSS class is applied to `<html>` before any visible paint, satisfying Requirement 18.4.

### Data flow

```
User interaction
  → Widget event handler
    → Sanitizer / Validator (if needed)
      → Widget state update
        → DOM re-render
          → Storage.write()
```

Every write to storage happens after the DOM update so the UI is always in sync with what was persisted.

---

## Components and Interfaces

### 1. Storage Utility

Wraps all `localStorage` access. Never throws to callers.

```js
Storage.read(key, fallback)   // returns parsed value or fallback
Storage.write(key, value)     // serialises to JSON; returns boolean success
```

- `read` catches `JSON.parse` errors, `null` returns, wrong types, and `SecurityError`.
- `write` catches `QuotaExceededError` and `SecurityError`.
- If `localStorage` is entirely inaccessible, Storage falls back to an in-memory `Map` and sets a global `Storage.degraded = true` flag that widgets inspect to show the session-only warning (Requirement 21.3).

Storage keys:

| Key | Type | Default |
|---|---|---|
| `tld_userName` | string | `""` |
| `tld_tasks` | Task[] | `[]` |
| `tld_links` | Link[] | `[]` |
| `tld_theme` | `"light"` \| `"dark"` | `"light"` |

### 2. Validator Utility

```js
Validator.isValidUrl(str)      // boolean — absolute http/https, valid domain, ≤ 2048 chars
Validator.isNonEmpty(str)      // boolean — at least one non-whitespace character
Validator.isWithinLength(str, max)  // boolean
```

### 3. Sanitizer Utility

```js
Sanitizer.trim(str)            // removes leading/trailing whitespace
Sanitizer.normalise(str)       // trim + toLowerCase (for comparison only)
```

### 4. GreetingWidget

**DOM structure:**
```
<section id="greeting-widget" aria-label="Greeting">
  <div id="clock" aria-live="polite"></div>
  <div id="date-display"></div>
  <div id="greeting-text"></div>
  <button id="edit-name-btn">Edit name</button>
  <!-- inline edit panel, hidden by default -->
  <form id="name-form" hidden>
    <label for="name-input">Your name</label>
    <input id="name-input" type="text" maxlength="50">
    <button type="submit">Save</button>
    <button type="button" id="cancel-name-btn">Cancel</button>
    <div id="name-error" role="alert" aria-live="assertive"></div>
  </form>
</section>
```

**Public interface:**
```js
GreetingWidget.init()          // reads name from storage, starts clock interval
GreetingWidget.setName(name)   // validates, saves, re-renders greeting
```

**Clock interval:** `setInterval(tick, 1000)`. `tick()` calls `Date` — if an exception is thrown (Requirement 1.4), the interval is cleared and an error message is shown.

**Greeting boundaries:** `getGreeting(hour)` — pure function mapping hour → greeting string (Requirements 2.1–2.4). Called on every clock tick so the greeting updates within one interval (≤ 1 s, well within the 60 s requirement 2.5).

### 5. TimerWidget

**DOM structure:**
```
<section id="timer-widget" aria-label="Focus Timer">
  <div id="timer-display" aria-live="polite">25:00</div>
  <div id="timer-controls">
    <button id="timer-start">Start</button>
    <button id="timer-stop" disabled>Stop</button>
    <button id="timer-reset">Reset</button>
  </div>
  <div id="timer-alert" role="alert" aria-live="assertive" hidden></div>
</section>
```

**State machine:**

```
        ┌───────────────────────────────┐
        │          STOPPED              │
        │  start=enabled  stop=disabled │
        └──────────┬────────────────────┘
                   │ Start pressed (remaining > 0)
                   ▼
        ┌───────────────────────────────┐
        │          RUNNING              │◄─── Start pressed (paused)
        │  start=disabled stop=enabled  │
        └──────────┬──────────┬─────────┘
                   │          │ Stop pressed
                   │          ▼
                   │   ┌──────────────┐
                   │   │    PAUSED    │
                   │   └──────────────┘
                   │ reaches 00:00
                   ▼
        ┌───────────────────────────────┐
        │          COMPLETE             │
        │  (alert shown, reset to 25:00)│
        └───────────────────────────────┘
```

**Public interface:**
```js
TimerWidget.init()
TimerWidget.start()
TimerWidget.stop()
TimerWidget.reset()
```

`start()` guards against double-interval creation by checking `TimerWidget._intervalId !== null` before calling `setInterval`. This satisfies Requirements 6.1–6.3.

On completion (Requirement 7): clears interval, shows on-screen alert, requests browser notification if permission is `"granted"`, resets display to 25:00, sets state to STOPPED.

### 6. TaskManager

**DOM structure:**
```
<section id="task-manager" aria-label="Task Manager">
  <form id="task-form">
    <label for="task-input">New task</label>
    <input id="task-input" type="text" maxlength="500">
    <button type="submit">Add</button>
    <div id="task-add-error" role="alert" aria-live="assertive"></div>
  </form>
  <div id="task-sort-controls">
    <label for="task-sort">Sort by</label>
    <select id="task-sort">
      <option value="active-first">Active First</option>
      <option value="completed-first">Completed First</option>
      <option value="date-added">Date Added</option>
    </select>
  </div>
  <ul id="task-list" aria-live="polite" aria-label="Tasks">
    <!-- task items rendered here -->
  </ul>
</section>
```

**Task item template (rendered per task):**
```html
<li data-id="{id}">
  <input type="checkbox" id="task-check-{id}" aria-label="Complete {text}">
  <label for="task-check-{id}" class="task-label">{text}</label>
  <!-- OR when editing: -->
  <input type="text" class="task-edit-input" value="{text}">
  <button class="task-edit-btn" aria-label="Edit {text}">Edit</button>
  <button class="task-delete-btn" aria-label="Delete {text}">Delete</button>
  <div class="task-edit-error" role="alert" aria-live="assertive"></div>
</li>
```

**Public interface:**
```js
TaskManager.init()
TaskManager.addTask(text)        // validates, deduplicates, appends, persists
TaskManager.toggleTask(id)       // flips completion state, persists
TaskManager.editTask(id, text)   // validates, deduplicates (excluding self), persists
TaskManager.deleteTask(id)       // removes, persists
TaskManager.sortTasks(mode)      // re-renders without mutating storage order
TaskManager.render()             // re-renders list from current state
```

**Sort implementation:** `sortTasks` builds a *display copy* of the array sorted by the chosen mode. The canonical `_tasks` array always preserves insertion order (used as stable secondary sort key).

### 7. QuickLinks

**DOM structure:**
```
<section id="quick-links" aria-label="Quick Links">
  <form id="link-form">
    <label for="link-label-input">Label</label>
    <input id="link-label-input" type="text" maxlength="100">
    <label for="link-url-input">URL</label>
    <input id="link-url-input" type="url" maxlength="2048">
    <button type="submit">Add Link</button>
    <div id="link-add-error" role="alert" aria-live="assertive"></div>
  </form>
  <ul id="link-list" aria-label="Quick Links">
    <!-- link items rendered here -->
  </ul>
</section>
```

**Link item template:**
```html
<li data-id="{id}">
  <a href="{url}" target="_blank" rel="noopener noreferrer">{label}</a>
  <button class="link-remove-btn" aria-label="Remove {label}">Remove</button>
</li>
```

Confirmation before removal uses a native `window.confirm()` dialog (Requirement 17.2).

**Public interface:**
```js
QuickLinks.init()
QuickLinks.addLink(label, url)   // validates, appends, persists
QuickLinks.removeLink(id)        // confirms, removes, persists (restores on save fail)
QuickLinks.render()
```

### 8. ThemeManager

**DOM structure:** A `<button id="theme-toggle">` in the `<header>`. The CSS class `dark-mode` is applied to `<html>` (not `<body>`) so it is available before any content renders.

```js
ThemeManager.init()              // reads storage, applies class before paint
ThemeManager.toggle()            // flips class, saves to storage
```

The `<link rel="stylesheet">` element is placed in `<head>`, and `ThemeManager.init()` is the very first call in the `DOMContentLoaded` handler, so the class is set before the first paint (no flash, Requirement 18.4).

---

## Data Models

### Task

```js
{
  id: string,           // crypto.randomUUID() or Date.now().toString() fallback
  text: string,         // original user input (trimmed, original case preserved)
  completed: boolean,   // false = active, true = completed
  createdAt: number     // Date.now() timestamp — used as insertion-order key
}
```

Storage key: `tld_tasks` — serialised as a JSON array.

### Link

```js
{
  id: string,           // crypto.randomUUID() or Date.now().toString() fallback
  label: string,        // trimmed display label (max 100 chars)
  url: string,          // validated absolute URL (max 2048 chars)
  createdAt: number     // Date.now() timestamp
}
```

Storage key: `tld_links` — serialised as a JSON array.

### Theme

Storage key: `tld_theme` — value is the string `"light"` or `"dark"`. Any other value falls back to `"light"` (Requirement 18.6).

### User Name

Storage key: `tld_userName` — plain string, max 50 characters. Empty string treated as "no name saved" → display "Friend".

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Time-based greeting completeness

*For any* hour value in the range 0–23, `getGreeting(hour)` SHALL return exactly one of "Good Morning", "Good Afternoon", "Good Evening", or "Good Night" — never an empty string, undefined, or a value outside this set.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 2: Greeting boundary coverage is exhaustive and non-overlapping

*For any* pair of distinct hour values `h1` and `h2`, if `h1` and `h2` fall within different named boundary ranges, then `getGreeting(h1) !== getGreeting(h2)`. Conversely, if `h1` and `h2` fall within the same named range, `getGreeting(h1) === getGreeting(h2)`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 3: Task addition grows the list by exactly one

*For any* task list of length N and any valid (non-empty, non-whitespace-only, ≤ 500 chars, non-duplicate) task text, calling `addTask(text)` SHALL result in a task list of length N + 1, with the new task appearing at the end.

**Validates: Requirements 8.2, 8.3**

---

### Property 4: Whitespace-only and empty task text is always rejected

*For any* string composed entirely of whitespace characters (including the empty string), calling `addTask(text)` SHALL leave the task list unchanged and return a validation error.

**Validates: Requirements 8.5, 9.1**

---

### Property 5: Task text over 500 characters is always rejected

*For any* string whose length exceeds 500 characters, calling `addTask(text)` SHALL leave the task list unchanged and return a validation error.

**Validates: Requirements 8.6**

---

### Property 6: Duplicate task prevention (case-insensitive, whitespace-normalised)

*For any* task list and any new task text whose normalised form (trimmed + lowercased) matches the normalised form of an existing task in the list, calling `addTask(text)` SHALL reject the submission and leave the task list unchanged.

**Validates: Requirements 9.1, 9.2**

---

### Property 7: Task text original formatting is preserved

*For any* valid task text with mixed capitalisation or internal spacing, the text stored and displayed after `addTask(text)` SHALL be identical to `Sanitizer.trim(text)` — without lowercase conversion or internal-space normalisation.

**Validates: Requirements 9.3, 8.2**

---

### Property 8: Task completion toggle is an involution (round-trip)

*For any* task, calling `toggleTask(id)` twice SHALL return the task to its original `completed` state.

**Validates: Requirements 10.2, 10.3**

---

### Property 9: Inline edit duplicate prevention excludes self

*For any* task list and any task being edited, calling `editTask(id, text)` where the normalised `text` matches the normalised text of the *same* task (i.e., a no-op rename) SHALL succeed — the duplicate check SHALL only compare against all *other* tasks.

**Validates: Requirements 11.3**

---

### Property 10: Sorting preserves task count and content

*For any* task list and any sort mode, calling `sortTasks(mode)` SHALL result in a rendered list containing the same tasks (same IDs and texts) as the original list — no tasks are added, removed, or modified during sorting.

**Validates: Requirements 13.2, 13.3, 13.4, 13.6**

---

### Property 11: Active-First sort places all active tasks before all completed tasks

*For any* task list rendered under "Active First" sort mode, every active task's DOM position SHALL precede every completed task's DOM position.

**Validates: Requirements 13.2**

---

### Property 12: Task persistence round-trip

*For any* set of valid tasks written to storage via `Storage.write("tld_tasks", tasks)`, calling `Storage.read("tld_tasks", [])` SHALL return an array of tasks equal in structure to the original (same IDs, texts, completion states, and timestamps).

**Validates: Requirements 14.1, 14.4**

---

### Property 13: Storage read with malformed data returns safe default

*For any* call to `Storage.read(key, fallback)` where the stored value is not valid JSON, is `null`, or has an unexpected type, the function SHALL return `fallback` without throwing.

**Validates: Requirements 14.3, 21.1, 21.2**

---

### Property 14: URL validation accepts only absolute http/https URLs

*For any* string, `Validator.isValidUrl(str)` SHALL return `true` if and only if the string is a well-formed absolute URL whose protocol is exactly `http:` or `https:`, contains a non-empty hostname, and has a total length ≤ 2048 characters. It SHALL return `false` for all other inputs (including relative paths, `ftp://`, `javascript:`, empty strings, and strings exceeding 2048 characters).

**Validates: Requirements 16.2, 16.4**

---

### Property 15: Theme toggle is an involution (round-trip)

*For any* starting theme value, calling `ThemeManager.toggle()` twice SHALL result in the `<html>` element returning to the same CSS class state it had before the first call, and the same value being written to storage.

**Validates: Requirements 18.2, 18.3**

---

### Property 16: Theme persists across init cycles

*For any* theme value `"light"` or `"dark"` saved to storage, calling `ThemeManager.init()` SHALL apply the corresponding CSS class to `<html>`. For any other stored value, `ThemeManager.init()` SHALL apply the `"light"` class.

**Validates: Requirements 18.4, 18.5, 18.6**

---

## Error Handling

### Storage errors

| Scenario | Behaviour |
|---|---|
| `localStorage` throws `SecurityError` (private browsing block) | `Storage` falls back to in-memory `Map`; `Storage.degraded = true`; widgets show a non-blocking banner (Req 21.3) |
| `JSON.parse` fails on read | Returns `fallback` silently |
| `QuotaExceededError` on write | `Storage.write` returns `false`; calling widget displays an inline error message |
| Stored value is wrong type | Returns `fallback` |

### GreetingWidget errors

| Scenario | Behaviour |
|---|---|
| `new Date()` throws | Clock interval cleared; static error message shown in place of time/date |
| Empty/whitespace name submitted | Validation error shown; previously saved name retained (Req 3.5) |
| Name longer than 50 chars | Validation error shown; not saved |

### TimerWidget errors

| Scenario | Behaviour |
|---|---|
| Widget fails to render | Error message in timer area (Req 4.5) |
| Start pressed with 00:00 remaining | Start button disabled; press ignored (Req 5.7) |
| Start pressed while already running | Ignored; no new interval created (Req 6.3) |
| Browser notification permission denied | On-screen alert only (Req 7.4) |

### TaskManager errors

| Scenario | Behaviour |
|---|---|
| Empty / whitespace task text | Inline validation error; task not added |
| Task text > 500 chars | Inline validation error; task not added |
| Duplicate task (normalised match) | Inline duplicate error; original input retained |
| Storage write fails on add/edit/delete | Inline error message; UI not reverted for add/edit (Req 14.5); task restored for delete (Req 12.4) |
| Malformed storage data on load | Treat as empty list; log console error; show empty-state message (Req 14.3) |
| Edit confirmed with empty text | Validation error; input stays active (Req 11.5) |

### QuickLinks errors

| Scenario | Behaviour |
|---|---|
| Invalid URL | URL validation error; link not added; inputs retained (Req 16.4) |
| Empty label | Label validation error; link not added; inputs retained (Req 16.5) |
| Storage write fails on add | Error message; link not added to displayed list (Req 16.7) |
| Storage write fails on remove | Error message; link restored to previous position (Req 17.4) |
| Malformed link in storage on load | Entry skipped; console warning (Req 15.5) |

---

## Testing Strategy

### Approach

This feature is a Vanilla JS single-page application with:
- Pure utility functions (`Sanitizer`, `Validator`, `Storage.read`)
- Stateful widget logic (task CRUD, timer state machine, theme toggle)
- DOM rendering
- localStorage integration

Property-based testing applies to the pure utility and logic layer. Example-based unit tests cover specific edge cases and integration behaviour. DOM rendering is verified with example-based tests using a real or jsdom DOM.

### Unit Tests (example-based)

Focus on specific examples and edge cases per widget:

- **GreetingWidget**: each greeting boundary hour (5, 12, 18, 22, 0), fallback "Hello" on error, "Friend" when no name saved.
- **TimerWidget**: initial state (25:00, start enabled, stop disabled); reaching 00:00 triggers alert and resets; Start while running is a no-op.
- **TaskManager**: add normal task; reject empty; reject > 500 chars; reject duplicate; toggle twice; delete; inline edit happy path; cancel edit; empty-state message when list is empty.
- **QuickLinks**: add valid link; reject invalid URL; reject empty label; remove with confirmation; restore on storage failure.
- **ThemeManager**: light default when no storage; dark applied when stored; unrecognised value falls back to light.
- **Storage**: `read` returns fallback on null; `read` returns fallback on parse error; `write` returns false on quota error; `degraded` flag set on `SecurityError`.

### Property-Based Tests

Uses a PBT library appropriate for the target environment (e.g., [fast-check](https://github.com/dubzzz/fast-check) loaded via CDN for browser execution, or used with a test runner like Vitest/Jest for Node-based testing).

Each test runs a minimum of **100 iterations**.

Tag format: `// Feature: todo-life-dashboard, Property {N}: {property_text}`

| Property | Test description |
|---|---|
| P1 | Generate `hour` in 0–23 → `getGreeting(hour)` is always one of the four valid strings |
| P2 | Generate two hours in the same boundary range → same greeting; two hours in different ranges → different greeting |
| P3 | Generate task list + valid text → `addTask` grows list by 1 |
| P4 | Generate whitespace/empty strings → `addTask` always returns error, list unchanged |
| P5 | Generate strings with length > 500 → `addTask` always returns error |
| P6 | Generate task list + text that normalises to an existing task → `addTask` rejects |
| P7 | Generate mixed-case task text → stored and displayed text equals `trim(input)` exactly |
| P8 | Generate task → `toggleTask` twice → original `completed` value restored |
| P9 | Generate task list + edit to own normalised text → `editTask` succeeds |
| P10 | Generate task list + sort mode → `sortTasks` renders same count and IDs |
| P11 | Generate mixed task list → "Active First" sort → all active items precede all completed items |
| P12 | Generate task array → `Storage.write` then `Storage.read` → structurally equal result |
| P13 | Generate arbitrary strings / values → `Storage.read` never throws; always returns fallback |
| P14 | Generate valid URLs → `Validator.isValidUrl` returns `true`; generate invalid strings → returns `false` |
| P15 | Call `ThemeManager.toggle()` twice → `<html>` class and storage value identical to initial state |
| P16 | Store `"light"` / `"dark"` / arbitrary string → `ThemeManager.init()` applies correct/fallback class |

### Integration / Smoke Tests

- Opening `index.html` via `file://` renders without console errors.
- `localStorage` is read and applied before first paint (no theme flash).
- All four widgets are visible and functional with empty storage.
- Timer completes from 00:01 → 00:00 and shows the completion alert.
- Adding a task, reloading the page, and verifying the task persists.
- Adding a quick link and clicking it opens a new tab with the correct URL.
