# Requirements Document

## Introduction

The To-Do Life Dashboard is a single-page front-end web application built with HTML, CSS, and Vanilla JavaScript. It serves as a personal productivity hub combining a live clock and greeting, a Pomodoro-style focus timer, a to-do task manager, and a quick-links launcher — all without a backend server. All user data is persisted entirely via the browser's Local Storage API. The application must be responsive, accessible, and functional across all modern browsers.

---

## Glossary

- **Dashboard**: The single-page web application described in this document (`index.html`).
- **Storage**: The browser's Local Storage API used for all client-side data persistence.
- **Greeting_Widget**: The UI section that displays the current time, date, and a personalized greeting message.
- **Timer**: The focus countdown timer widget with Start, Stop, and Reset controls.
- **Task_Manager**: The UI section for managing to-do tasks (add, edit, complete, delete, sort).
- **Task**: A single to-do item with a text label and a completion status (active or completed).
- **Quick_Links**: The UI section for managing and launching user-defined favorite website shortcuts.
- **Link**: A single quick-link entry consisting of a display label and a validated URL.
- **Theme**: The visual color scheme of the Dashboard — either Light mode or Dark mode.
- **Validator**: The internal logic responsible for validating user input (task text, URLs).
- **Sanitizer**: The internal logic responsible for normalizing text input (trimming whitespace, normalizing case for comparison).

---

## Requirements

### Requirement 1: Live Clock and Date Display

**User Story:** As a user, I want to see the current time and date at all times, so that I can stay oriented without switching to another application.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current time in HH:MM:SS 24-hour format, updated at an interval of exactly 1000 milliseconds (±50 ms).
2. THE Greeting_Widget SHALL display the current date in a human-readable format with full weekday name, full month name, numeric day, and 4-digit year (e.g., "Saturday, October 5, 2026"), reflecting the user's local system locale.
3. WHEN the Dashboard is loaded, THE Greeting_Widget SHALL immediately render the current time and date within 100 milliseconds of the Dashboard becoming visible, without waiting for the first 1000-millisecond interval to elapse.
4. IF the Greeting_Widget fails to obtain the current time or date from the local system clock, THEN THE Greeting_Widget SHALL display an error message indicating that the time and date are unavailable and cease update attempts until the next Dashboard load.

---

### Requirement 2: Time-Based Greeting

**User Story:** As a user, I want to see a greeting that changes based on the time of day, so that the Dashboard feels personal and contextually aware.

#### Acceptance Criteria

1. WHILE the current local hour is between 05:00 and 11:59 (inclusive), THE Greeting_Widget SHALL display "Good Morning".
2. WHILE the current local hour is between 12:00 and 17:59 (inclusive), THE Greeting_Widget SHALL display "Good Afternoon".
3. WHILE the current local hour is between 18:00 and 21:59 (inclusive), THE Greeting_Widget SHALL display "Good Evening".
4. WHILE the current local hour is between 22:00 and 23:59 (inclusive) or between 00:00 and 04:59 (inclusive), THE Greeting_Widget SHALL display "Good Night".
5. WHEN a greeting boundary time (05:00, 12:00, 18:00, or 22:00) is crossed, THE Greeting_Widget SHALL update the displayed greeting within 60 seconds of the boundary crossing, without requiring a page reload.
6. IF the Greeting_Widget cannot read the device's local time, THEN THE Greeting_Widget SHALL display "Hello" as a fallback greeting.

---

### Requirement 3: Customizable User Name in Greeting

**User Story:** As a user, I want to set my name so that the greeting is personalized to me.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display a personalized greeting in the format "[Greeting], [Name]!" when a name has been saved.
2. WHEN no name has been saved in Storage, THE Greeting_Widget SHALL display the greeting in the format "[Greeting], Friend!".
3. WHEN the user submits a new name via the name-edit control, THE Dashboard SHALL save the name to Storage and update the displayed greeting within 500 milliseconds.
4. WHEN the Dashboard is loaded, THE Greeting_Widget SHALL read the user's name from Storage and render the personalized greeting before the widget becomes visible to the user.
5. IF the user submits an empty or whitespace-only name, THEN THE Dashboard SHALL retain the previously saved name unchanged, close the name-edit control, and display a validation message indicating that the name must contain at least one non-whitespace character.
6. IF Storage is unavailable when the Dashboard is loaded, THEN THE Greeting_Widget SHALL display the greeting using the placeholder name "Friend" and display an error message indicating that the saved name could not be retrieved.
7. THE Greeting_Widget SHALL only accept a name between 1 and 50 characters in length.

---

### Requirement 4: Focus Timer — Display and Default State

**User Story:** As a user, I want a visible countdown timer, so that I can track my focused work sessions.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded, THE Timer SHALL display a default duration of 25 minutes and 0 seconds (25:00).
2. THE Timer SHALL display the remaining time in MM:SS format at all times, where MM is zero-padded to two digits (range 00–99) and SS is zero-padded to two digits (range 00–59).
3. WHEN the timer is in the stopped or reset state, THE Timer SHALL display the Start button as active (enabled) and the Stop button as disabled.
4. WHEN the Dashboard is loaded, THE Timer SHALL be in the stopped state, with the Start button enabled and the Stop button disabled.
5. IF the Timer component fails to render, THEN THE Dashboard SHALL display an error message in the timer widget area indicating the timer is unavailable.

---

### Requirement 5: Focus Timer — Start, Stop, Reset Controls

**User Story:** As a user, I want Start, Stop, and Reset controls for the timer, so that I can fully control my focus sessions.

#### Acceptance Criteria

1. WHEN the user activates the Start button, THE Timer SHALL begin counting down from the currently displayed time, decrementing by one second per second.
2. WHEN the user activates the Stop button while the timer is running, THE Timer SHALL pause the countdown and retain the remaining time.
3. WHEN the user activates the Reset button at any time, THE Timer SHALL stop any active countdown and restore the display to 25:00.
4. WHILE the timer is running, THE Timer SHALL keep the Start button disabled, the Stop button enabled, and the Reset button enabled.
5. WHEN the user activates the Start button on a paused timer, THE Timer SHALL resume the countdown from the remaining time.
6. WHEN the user activates the Reset button, THE Timer SHALL display the Start button as enabled, the Stop button as disabled, and the Reset button as enabled.
7. IF the timer display shows 00:00 and the timer is in a stopped state, THEN THE Timer SHALL keep the Start button disabled to prevent starting a countdown from zero.

---

### Requirement 6: Focus Timer — Simultaneous Interval Prevention

**User Story:** As a user, I want the timer to behave predictably, so that rapid or repeated button presses do not corrupt the countdown.

#### Acceptance Criteria

1. THE Timer SHALL ensure that at most one countdown interval is active at any given time.
2. WHILE a countdown interval is active, THE Timer SHALL keep the Start button disabled so that no additional interval can be created.
3. IF the Start button is activated while a countdown interval is already active, THEN THE Timer SHALL ignore the activation and leave the current countdown interval and remaining time unchanged.

---

### Requirement 7: Focus Timer — Completion Handling

**User Story:** As a user, I want to be notified when my focus session ends, so that I know to take a break.

#### Acceptance Criteria

1. WHEN the timer countdown reaches 00:00, THE Timer SHALL stop the countdown interval automatically.
2. WHEN the timer countdown reaches 00:00, THE Dashboard SHALL display a visible on-screen alert indicating that the focus session is complete.
3. WHERE browser notification permission has been granted by the user, WHEN the timer countdown reaches 00:00, THE Dashboard SHALL send a browser notification indicating that the focus session is complete.
4. IF browser notification permission has not been granted, THEN THE Dashboard SHALL display the on-screen alert as the sole notification of session completion.
5. WHEN the timer countdown reaches 00:00, THE Timer SHALL reset the display to the configured session duration (default 25:00) and enter the stopped state.

---

### Requirement 8: Task Addition

**User Story:** As a user, I want to add new tasks, so that I can track what I need to do.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a text input field and a submission control (button or Enter key) for adding new tasks.
2. WHEN the user submits a non-empty task text, THE Task_Manager SHALL trim leading and trailing whitespace from the input, then add the trimmed text as a new task with an active (incomplete) status.
3. WHEN a task is successfully added, THE Task_Manager SHALL save the updated task list to Storage.
4. WHEN a task is successfully added, THE Task_Manager SHALL clear the task input field.
5. IF the user submits an empty or whitespace-only task text, THEN THE Task_Manager SHALL display a validation message indicating that the task text is required and not add a task.
6. IF the user submits a task text exceeding 500 characters, THEN THE Task_Manager SHALL display a validation message indicating the character limit and not add the task.

---

### Requirement 9: Duplicate Task Prevention

**User Story:** As a user, I want the system to prevent duplicate tasks, so that my list stays clean and organized.

#### Acceptance Criteria

1. WHEN the user submits a new task, THE Sanitizer SHALL normalize the input by trimming leading and trailing whitespace and converting all characters to lowercase for comparison purposes only, without modifying the original input text.
2. IF the normalized input text matches the normalized text of any existing task in the list (regardless of original letter case or surrounding whitespace), THEN THE Task_Manager SHALL reject the submission, display a duplicate-task validation message indicating the conflict, and retain the user's input text in the submission field.
3. THE Task_Manager SHALL preserve the original formatting (capitalization, internal spacing) of the task text as entered by the user when storing and displaying tasks.
4. IF the task list contains no existing tasks, THEN THE Task_Manager SHALL accept any valid new task submission without performing duplicate comparison.

---

### Requirement 10: Task Completion Toggle

**User Story:** As a user, I want to mark tasks as completed or reopen them, so that I can track my progress.

#### Acceptance Criteria

1. THE Task_Manager SHALL display each task with a checkbox or toggle control indicating its completion status.
2. WHEN the user activates the completion toggle on an active task, THE Task_Manager SHALL mark the task as completed, apply a strikethrough style to the task title text, and apply a visually dimmed style to the task item.
3. WHEN the user activates the completion toggle on a completed task, THE Task_Manager SHALL mark the task as active, remove the strikethrough style from the task title text, and restore the default (non-dimmed) style to the task item.
4. WHEN the completion status of a task changes, THE Task_Manager SHALL save the updated task list to Storage within 500 milliseconds.
5. IF saving the updated task list to Storage fails after a completion toggle, THEN THE Task_Manager SHALL display an error indication to the user and retain the toggled completion state in the current session without reverting the visual change.

---

### Requirement 11: Inline Task Editing

**User Story:** As a user, I want to edit task text directly in the list, so that I can correct or update tasks without deleting and re-adding them.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide an edit control for each task item.
2. WHEN the user activates the edit control on a task, THE Task_Manager SHALL replace the task label with an editable input pre-filled with the current task text, with the cursor positioned at the end of the text.
3. WHEN the user confirms the edit (via Enter key or a save button), THE Task_Manager SHALL apply the duplicate-task prevention check (Requirement 9) against all other tasks in the list using a case-insensitive, trimmed comparison.
4. IF the edited text passes validation, THEN THE Task_Manager SHALL update the task text in the list and persist the updated list to Storage within 2 seconds.
5. IF the edited text is empty or whitespace-only, THEN THE Task_Manager SHALL reject the edit, retain the editable input in its active state, and display a validation message indicating the task text cannot be empty.
6. IF the confirmed edit text matches an existing task (duplicate), THEN THE Task_Manager SHALL reject the edit, retain the editable input in its active state, and display a validation message indicating the task already exists.
7. WHEN the user cancels the edit (via Escape key or a cancel button), THE Task_Manager SHALL discard all changes and restore the original task text without saving to Storage.

---

### Requirement 12: Task Deletion

**User Story:** As a user, I want to delete tasks, so that I can remove items that are no longer relevant.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a delete control for each task item displayed in the task list.
2. WHEN the user activates the delete control on a task, THE Task_Manager SHALL remove that task from the task list and the task SHALL no longer appear in the list.
3. WHEN a task is deleted, THE Task_Manager SHALL save the updated task list to Storage within 1 second of the deletion.
4. IF saving the updated task list to Storage fails after a deletion, THEN THE Task_Manager SHALL display an error message indicating the deletion could not be saved and retain the task in the displayed list.
5. WHEN the task list contains zero tasks, THE Task_Manager SHALL display an empty-state message of no more than 100 characters indicating no tasks exist and prompting the user to add one.

---

### Requirement 13: Task Sorting

**User Story:** As a user, I want to sort my task list, so that I can focus on what still needs to be done.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a sorting control with at least the following options: "Active First" (default), "Completed First", and "Date Added".
2. WHEN the user selects "Active First", THE Task_Manager SHALL display all active tasks above all completed tasks, with tasks within each group ordered by insertion order (oldest first).
3. WHEN the user selects "Completed First", THE Task_Manager SHALL display all completed tasks above all active tasks, with tasks within each group ordered by insertion order (oldest first).
4. WHEN the user selects "Date Added", THE Task_Manager SHALL display all tasks in insertion order (oldest first), regardless of status.
5. WHEN a sort option is selected, THE Task_Manager SHALL re-render the task list within 100 milliseconds without a page reload.
6. THE Task_Manager SHALL preserve task insertion order as a stable secondary sort key so that tasks within the same status group maintain their relative order.
7. IF the task list is empty when a sort option is selected, THEN THE Task_Manager SHALL display the empty-state message and take no further action.

---

### Requirement 14: Task Persistence

**User Story:** As a user, I want my tasks to be available after I close and reopen the browser, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded, THE Task_Manager SHALL read the task list from Storage and render all persisted tasks within 500 milliseconds.
2. IF no task data exists in Storage, THEN THE Task_Manager SHALL render an empty list with an empty-state message containing text indicating no tasks are available.
3. IF the data in Storage is malformed or unparseable, THEN THE Task_Manager SHALL treat it as an empty list, log an error message to the browser console, and render the empty-state message without throwing an unhandled exception.
4. WHEN a task is created, updated, or deleted, THE Task_Manager SHALL write the updated task list to Storage before the operation is considered complete.
5. IF the write to Storage fails, THEN THE Task_Manager SHALL display an error message indicating that the task could not be saved and retain the previous Storage state.

---

### Requirement 15: Quick Links Display

**User Story:** As a user, I want to see my favorite website shortcuts displayed as buttons, so that I can navigate to them quickly.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded, THE Quick_Links SHALL read the saved links from Storage and render each link as a clickable button or anchor displaying the link's saved label.
2. IF reading from Storage fails when the Dashboard is loaded, THEN THE Quick_Links SHALL display an error message and render no link buttons.
3. WHEN the user clicks a link button, THE Dashboard SHALL open the target URL in a new browser tab using `target="_blank"` and `rel="noopener noreferrer"` attributes.
4. WHEN no links have been saved, THE Quick_Links SHALL display a non-empty empty-state message indicating no links are saved and prompting the user to add one.
5. IF a stored link entry has a malformed or relative URL, THEN THE Quick_Links SHALL skip rendering a button for that entry and log a warning to the browser console.

---

### Requirement 16: Quick Link Addition

**User Story:** As a user, I want to add new quick links with a label and URL, so that I can customize my shortcuts.

#### Acceptance Criteria

1. THE Quick_Links SHALL provide a label input (maximum 100 characters) and a URL input (maximum 2048 characters), along with a submission control.
2. WHEN the user submits a label and URL, THE Validator SHALL validate that the URL is a well-formed absolute URL starting with `http://` or `https://`, containing a valid domain, and not exceeding 2048 characters.
3. IF the trimmed label is non-empty and the URL is valid, THEN THE Quick_Links SHALL add the link to the list using the trimmed label and save the updated list to Storage, then clear both input fields and hide any previously displayed validation error messages.
4. IF the URL fails validation, THEN THE Quick_Links SHALL display a URL validation error message, retain the current input field values, and not add the link.
5. IF the label is empty or whitespace-only, THEN THE Quick_Links SHALL display a label validation error message, retain the current input field values, and not add the link.
6. WHEN a link is successfully added, THE Quick_Links SHALL clear both input fields.
7. IF Storage is unavailable when attempting to save a new link, THEN THE Quick_Links SHALL display an error message indicating the link could not be saved and not add the link to the displayed list.

---

### Requirement 17: Quick Link Removal

**User Story:** As a user, I want to remove quick links I no longer need, so that my shortcuts stay relevant.

#### Acceptance Criteria

1. THE Quick_Links SHALL provide a remove control for each displayed link.
2. WHEN the user activates the remove control for a link, THE Quick_Links SHALL display a confirmation prompt before removing the link.
3. WHEN the user confirms the removal, THE Quick_Links SHALL remove the link from the list and save the updated list to Storage within 1 second.
4. IF the Storage save operation fails after removal, THEN THE Quick_Links SHALL display an error message indicating the save failed and restore the removed link to its previous position in the list.

---

### Requirement 18: Light/Dark Mode Toggle

**User Story:** As a user, I want to switch between light and dark visual themes, so that I can reduce eye strain in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a visible toggle control to switch between Light mode and Dark mode, where the control indicates the currently active theme through a distinct visual state (e.g., label, icon, or checked state).
2. WHEN the user activates the theme toggle, THE Dashboard SHALL switch the active Theme within 100 milliseconds by applying or removing a CSS class on the root element.
3. WHEN the user activates the theme toggle, THE Dashboard SHALL save the selected Theme identifier to Storage as one of two discrete values representing Light mode or Dark mode.
4. WHEN the Dashboard is loaded, THE Dashboard SHALL read the saved Theme from Storage and apply the corresponding CSS class on the root element before any visible content is rendered, such that no flash of the non-selected theme is observable.
5. IF no Theme preference is saved in Storage, THEN THE Dashboard SHALL apply the Light mode Theme as the default.
6. IF the saved Theme value in Storage is not a recognized Theme identifier, THEN THE Dashboard SHALL discard the invalid value and apply the Light mode Theme as the default.
7. THE Dashboard SHALL provide visually distinct styles for both Light mode and Dark mode, affecting at minimum: background color, text color, card/widget backgrounds, and input field styles, such that each affected element has a different visual appearance between the two modes.

---

### Requirement 19: Responsive Layout

**User Story:** As a user, I want the Dashboard to be usable on both desktop and mobile screens, so that I can access it from any device.

#### Acceptance Criteria

1. THE Dashboard SHALL use a CSS layout (Grid or Flexbox) that adapts to viewport widths from 320px to 1920px without horizontal scrolling or content overflow.
2. WHEN the viewport width is below 768px, THE Dashboard SHALL stack widgets vertically in a single-column layout, with each widget occupying 100% of the available content width.
3. WHEN the viewport width is 768px or above, THE Dashboard SHALL arrange widgets in a multi-column layout of at least 2 columns, with each column occupying no more than 50% of the available content width.
4. THE Dashboard SHALL use relative units (rem, %, vw/vh) or media queries to ensure text renders at a minimum equivalent of 16px and all interactive controls have a minimum touch target of 44×44px across viewport sizes.
5. IF the viewport width is set to any value between 320px and 1920px, THEN THE Dashboard SHALL render all content without horizontal overflow, clipping, or content being hidden outside the viewport bounds.

---

### Requirement 20: Semantic HTML and Accessibility

**User Story:** As a user using assistive technologies, I want the Dashboard to be navigable and understandable, so that I can use all features without relying solely on visual cues.

#### Acceptance Criteria

1. THE Dashboard SHALL use semantic HTML5 elements (`<header>`, `<main>`, `<section>`, `<nav>`, `<button>`, `<form>`, `<label>`) to convey document structure such that each major page region is wrapped in its corresponding landmark element.
2. THE Dashboard SHALL associate every form input with a `<label>` element that is rendered and not hidden via CSS, or with an `aria-label` attribute where a visible label is not present.
3. THE Dashboard SHALL mark timer countdown and task list change regions with `aria-live="polite"` and validation error message regions with `aria-live="assertive"`, so that screen readers announce changes without interrupting ongoing speech for non-critical updates.
4. THE Dashboard SHALL ensure all interactive controls are reachable via the Tab key, activatable via the Enter key for links and buttons, toggleable via the Space key for checkboxes and toggle buttons, and dismissible via the Escape key for modals and dropdowns, and SHALL render a visible focus indicator with a minimum 2px outline on the focused element at all times.
5. THE Dashboard SHALL provide a minimum contrast ratio of 4.5:1 between normal text (below 18pt or 14pt bold) and its background, a minimum contrast ratio of 3:1 between large text (18pt or above, or 14pt bold or above) and its background, and a minimum contrast ratio of 3:1 for non-text interactive UI components against adjacent colors, in both Light and Dark themes.
6. IF a modal or overlay is open, THEN THE Dashboard SHALL confine keyboard focus within that modal or overlay, preventing Tab and Shift+Tab from reaching elements outside it until the modal or overlay is closed.

---

### Requirement 21: Local Storage Safety

**User Story:** As a developer, I want the application to handle corrupt or missing Local Storage data gracefully, so that users never encounter a broken Dashboard.

#### Acceptance Criteria

1. WHEN the Dashboard reads any value from Storage, THE Dashboard SHALL wrap the read operation in error handling that catches JSON parse errors, null returns, or unexpected data types.
2. IF a Storage read produces an error, null, or an unexpected value type, THEN THE Dashboard SHALL fall back to a safe default value for that data type: empty array (`[]`) for lists, empty string (`""`) for string keys, `"light"` for Theme, zero (`0`) for number keys, and `false` for boolean keys.
3. IF the browser throws a SecurityError or otherwise makes Local Storage entirely inaccessible, THEN THE Dashboard SHALL fall back to in-memory defaults for all data, render the Dashboard normally, and display a non-blocking warning message indicating that data will not be persisted in this session.
4. THE Dashboard SHALL not throw unhandled JavaScript exceptions due to any Local Storage read or write operation, regardless of storage availability or stored data content.

---

### Requirement 22: Single-File Constraint and No Build Process

**User Story:** As a developer, I want the project to be deployable by simply opening `index.html` in a browser, so that there is no build step or server dependency.

#### Acceptance Criteria

1. THE Dashboard SHALL consist of exactly three source files: `index.html`, `css/style.css`, and `js/script.js`, with no additional `.html`, `.css`, or `.js` files present in the project directory.
2. THE Dashboard SHALL not require a build tool, package manager, or local server to run, such that opening `index.html` directly via the `file://` protocol in a browser renders the dashboard fully without errors.
3. THE Dashboard SHALL not contain any `<script>` or `<link>` elements whose `src` or `href` attribute references an external domain or a local `node_modules` directory.
4. THE Dashboard SHALL load `css/style.css` via a `<link rel="stylesheet">` element and `js/script.js` via a `<script>` element placed before the closing `</body>` tag within `index.html`.
5. IF `index.html` is opened via the `file://` protocol in a browser and any of the three source files is missing or inaccessible, THEN THE Dashboard SHALL display an error message in the browser console indicating which file could not be loaded.
