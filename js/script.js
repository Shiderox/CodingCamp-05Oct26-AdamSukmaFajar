'use strict';

/* ==========================================================
   Storage — safe localStorage wrapper with in-memory fallback
   ========================================================== */
const Storage = (function () {
  let _mem = null;
  let _degraded = false;

  try {
    localStorage.setItem('tld_test', '1');
    localStorage.removeItem('tld_test');
  } catch (e) {
    _degraded = true;
    _mem = new Map();
  }

  function read(key, fallback) {
    try {
      if (_degraded) {
        return (_mem && _mem.has(key)) ? _mem.get(key) : fallback;
      }
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const val = JSON.parse(raw);
      if (val === null || val === undefined) return fallback;
      if (Array.isArray(fallback) && !Array.isArray(val)) return fallback;
      if (typeof fallback === 'string' && typeof val !== 'string') return fallback;
      return val;
    } catch (e) {
      if (e instanceof DOMException) {
        _degraded = true;
        if (!_mem) _mem = new Map();
      }
      return fallback;
    }
  }

  function write(key, value) {
    try {
      if (_degraded) {
        if (!_mem) _mem = new Map();
        _mem.set(key, value);
        return true;
      }
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e instanceof DOMException) {
        if (e.name === 'SecurityError') {
          _degraded = true;
          if (!_mem) _mem = new Map();
          _mem.set(key, value);
          return true;
        }
        console.error('Storage.write failed:', e);
        return false;
      }
      console.error('Storage.write failed:', e);
      return false;
    }
  }

  return {
    read,
    write,
    get degraded() { return _degraded; }
  };
})();

/* ==========================================================
   Validator — input validation helpers
   ========================================================== */
const Validator = {
  isValidUrl(str) {
    if (!str || typeof str !== 'string' || str.length > 2048) return false;
    try {
      const u = new URL(str);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0;
    } catch {
      return false;
    }
  },
  isNonEmpty(str) {
    return typeof str === 'string' && str.trim().length > 0;
  },
  isWithinLength(str, max) {
    return typeof str === 'string' && str.length <= max;
  }
};

/* ==========================================================
   Sanitizer — whitespace / case normalisation
   ========================================================== */
const Sanitizer = {
  trim(str) { return typeof str === 'string' ? str.trim() : ''; },
  normalise(str) { return typeof str === 'string' ? str.trim().toLowerCase() : ''; }
};

/* ==========================================================
   escapeHtml — XSS prevention for dynamic innerHTML
   ========================================================== */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================
   generateId — crypto.randomUUID with Date.now() fallback
   ========================================================== */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ==========================================================
   trapFocus — focus trap helper (used by GreetingWidget name-form)
   Returns a cleanup function that removes the keydown listener.
   ========================================================== */
function trapFocus(formEl) {
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

  function getNodes() {
    return Array.from(formEl.querySelectorAll(FOCUSABLE)).filter(
      el => !el.closest('[hidden]')
    );
  }

  function handler(e) {
    if (e.key !== 'Tab') return;
    // If the form has been hidden since the trap was installed, clean up silently
    if (formEl.hidden) {
      document.removeEventListener('keydown', handler);
      return;
    }
    const nodes = getNodes();
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last  = nodes[nodes.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      // Shift+Tab: wrap from first → last
      if (active === first || !formEl.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: wrap from last → first
      if (active === last || !formEl.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', handler);
  // Return cleanup function so caller can remove the listener when form closes
  return function releaseTrap() {
    document.removeEventListener('keydown', handler);
  };
}

/* ==========================================================
   ThemeManager — light / dark toggle with flash prevention
   ========================================================== */
const ThemeManager = {
  init() {
    const saved = Storage.read('tld_theme', 'light');
    this._apply(saved === 'dark' ? 'dark' : 'light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
  },

  toggle() {
    const isDark = document.documentElement.classList.contains('dark-mode');
    const next = isDark ? 'light' : 'dark';
    this._apply(next);
    Storage.write('tld_theme', next);
  },

  _apply(theme) {
    const btn = document.getElementById('theme-toggle');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
      if (btn) {
        btn.innerHTML = '&#9728;&#65039;';
        btn.setAttribute('aria-label', 'Switch to light mode');
      }
    } else {
      document.documentElement.classList.remove('dark-mode');
      if (btn) {
        btn.innerHTML = '&#127769;';
        btn.setAttribute('aria-label', 'Switch to dark mode');
      }
    }
  }
};

/* ==========================================================
   GreetingWidget — live clock, date, time-based greeting, name
   ========================================================== */
const GreetingWidget = {
  _intervalId: null,
  _name: '',
  _releaseTrap: null,   // holds the cleanup fn returned by trapFocus

  init() {
    this._name = Storage.read('tld_userName', '');
    // Render immediately (Req 1.3)
    this._tick();
    this._intervalId = setInterval(() => this._tick(), 1000);

    const editBtn   = document.getElementById('edit-name-btn');
    const nameForm  = document.getElementById('name-form');
    const cancelBtn = document.getElementById('cancel-name-btn');
    const nameInput = document.getElementById('name-input');
    const nameError = document.getElementById('name-error');

    // Shared helper — close form, release trap, restore focus (Req 20.6)
    const closeForm = (clearError) => {
      if (nameForm) nameForm.hidden = true;
      if (clearError && nameError) nameError.textContent = '';
      // Release the focus trap
      if (this._releaseTrap) {
        this._releaseTrap();
        this._releaseTrap = null;
      }
      // Return focus to the button that opened the form
      if (editBtn) editBtn.focus();
    };

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (nameForm) {
          nameForm.hidden = false;
          if (nameInput) {
            nameInput.value = this._name;
            nameInput.focus();
          }
          // Install focus trap — only once per open (Req 20.6)
          if (this._releaseTrap) this._releaseTrap(); // defensive: release any stale trap
          this._releaseTrap = trapFocus(nameForm);
        }
      });
    }

    if (nameForm) {
      nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.setName(nameInput ? nameInput.value : '', closeForm);
      });
      // Escape closes the form (consistent with existing behaviour)
      nameForm.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeForm(true);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => closeForm(true));
    }

    // Show storage-degraded warning (Req 21.3)
    if (Storage.degraded) {
      const w = document.getElementById('storage-warning');
      if (w) w.hidden = false;
    }
  },

  _tick() {
    try {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const pad = n => String(n).padStart(2, '0');

      const clockEl = document.getElementById('clock');
      if (clockEl) clockEl.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);

      const dateEl = document.getElementById('date-display');
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      this._renderGreeting(h);
    } catch (e) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      const clockEl = document.getElementById('clock');
      if (clockEl) clockEl.textContent = 'Time unavailable';
      const dateEl = document.getElementById('date-display');
      if (dateEl) dateEl.textContent = 'Date unavailable';
      const greetEl = document.getElementById('greeting-text');
      if (greetEl) greetEl.textContent = 'Hello, ' + (this._name || 'Friend') + '!';
    }
  },

  // Pure function — hour 0-23 -> greeting string (Properties 1 & 2)
  _getGreeting(h) {
    if (h >= 5  && h <= 11) return 'Good Morning';
    if (h >= 12 && h <= 17) return 'Good Afternoon';
    if (h >= 18 && h <= 21) return 'Good Evening';
    if (h >= 22 || h <= 4)  return 'Good Night';
    return 'Hello'; // fallback for invalid input
  },

  _renderGreeting(h) {
    const greeting = this._getGreeting(h);
    const name = this._name || 'Friend';
    const el = document.getElementById('greeting-text');
    if (el) el.textContent = greeting + ', ' + name + '!';
  },

  // closeFormFn is passed in from init() so setName never needs to know
  // how the form is closed — keeps trap release and focus-return in one place.
  setName(name, closeFormFn) {
    const errEl   = document.getElementById('name-error');
    const trimmed = Sanitizer.trim(name);

    if (!Validator.isNonEmpty(trimmed)) {
      if (errEl) errEl.textContent = 'Name must contain at least one character.';
      return;
    }
    if (!Validator.isWithinLength(trimmed, 50)) {
      if (errEl) errEl.textContent = 'Name must be 50 characters or fewer.';
      return;
    }

    this._name = trimmed;
    Storage.write('tld_userName', trimmed);
    this._renderGreeting(new Date().getHours());
    // Close form via the shared helper (releases trap, restores focus)
    if (typeof closeFormFn === 'function') {
      closeFormFn(true);
    } else {
      // Fallback: no closeFormFn supplied (should not happen in normal flow)
      const nameForm = document.getElementById('name-form');
      if (nameForm) nameForm.hidden = true;
      if (this._releaseTrap) { this._releaseTrap(); this._releaseTrap = null; }
      if (errEl) errEl.textContent = '';
    }
  }
};

/* ==========================================================
   TimerWidget — 25-minute Pomodoro countdown
   State machine: STOPPED <-> RUNNING <-> PAUSED -> STOPPED
   ========================================================== */
const TimerWidget = {
  _remaining: 1500,   // seconds (25 * 60)
  _intervalId: null,
  _state: 'STOPPED',  // 'STOPPED' | 'RUNNING' | 'PAUSED'

  init() {
    try {
      this._render();
      this._updateButtons();

      const startBtn = document.getElementById('timer-start');
      const stopBtn  = document.getElementById('timer-stop');
      const resetBtn = document.getElementById('timer-reset');

      if (startBtn) startBtn.addEventListener('click', () => this.start());
      if (stopBtn)  stopBtn.addEventListener('click',  () => this.stop());
      if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
    } catch (e) {
      console.error('TimerWidget.init failed:', e);
      const displayEl = document.getElementById('timer-display');
      if (displayEl) displayEl.textContent = 'Timer unavailable';
    }
  },

  start() {
    // Guard: at most one interval at a time (Req 6.1-6.3)
    if (this._intervalId !== null) return;
    if (this._state === 'RUNNING') return;
    if (this._remaining <= 0) return;

    this._state = 'RUNNING';
    this._intervalId = setInterval(() => this._tick(), 1000);
    this._updateButtons();
  },

  stop() {
    if (this._state !== 'RUNNING') return;
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._state = 'PAUSED';
    this._updateButtons();
  },

  reset() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._remaining = 1500;
    this._state = 'STOPPED';
    const alertEl = document.getElementById('timer-alert');
    if (alertEl) alertEl.hidden = true;
    this._render();
    this._updateButtons();
  },

  _tick() {
    this._remaining--;
    if (this._remaining <= 0) {
      this._remaining = 0;
      this._onComplete();
    } else {
      this._render();
    }
  },

  _onComplete() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._state = 'STOPPED';

    // Show completion alert (Req 7.2)
    const alertEl = document.getElementById('timer-alert');
    if (alertEl) alertEl.hidden = false;

    // Browser notification if permission granted (Req 7.3)
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Focus session complete!', { body: 'Time for a break.' });
      }
    } catch (e) { /* notifications not supported */ }

    // Reset display to 25:00 and enter STOPPED state (Req 7.5)
    this._remaining = 1500;
    this._render();
    this._updateButtons();
  },

  _render() {
    const m = Math.floor(this._remaining / 60);
    const s = this._remaining % 60;
    const txt = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    const el = document.getElementById('timer-display');
    if (el) el.textContent = txt;
  },

  _updateButtons() {
    const startBtn = document.getElementById('timer-start');
    const stopBtn  = document.getElementById('timer-stop');
    const resetBtn = document.getElementById('timer-reset');
    const running  = this._state === 'RUNNING';

    if (startBtn) startBtn.disabled = running || this._remaining <= 0;
    if (stopBtn)  stopBtn.disabled  = !running;
    if (resetBtn) resetBtn.disabled = false;
  }
};

/* ==========================================================
   TaskManager — full CRUD, duplicate prevention, sort, persist
   ========================================================== */
const TaskManager = {
  _tasks: [],            // canonical insertion-order array
  _sortMode: 'active-first',

  init() {
    const raw = Storage.read('tld_tasks', []);
    if (Array.isArray(raw)) {
      this._tasks = raw;
    } else {
      console.error('TaskManager: malformed storage data — resetting to empty list.');
      this._tasks = [];
    }

    this.render();

    const form       = document.getElementById('task-form');
    const sortSelect = document.getElementById('task-sort');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('task-input');
        if (input) this.addTask(input.value);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this._sortMode = sortSelect.value;
        this.render();
      });
    }
  },

  addTask(text) {
    const errEl  = document.getElementById('task-add-error');
    const input  = document.getElementById('task-input');
    const trimmed = Sanitizer.trim(text);

    if (!Validator.isNonEmpty(trimmed)) {
      if (errEl) errEl.textContent = 'Task text is required.';
      return;
    }
    if (!Validator.isWithinLength(trimmed, 500)) {
      if (errEl) errEl.textContent = 'Task must be 500 characters or fewer.';
      return;
    }
    const norm = Sanitizer.normalise(trimmed);
    if (this._tasks.some(t => Sanitizer.normalise(t.text) === norm)) {
      if (errEl) errEl.textContent = 'A task with this text already exists.';
      return;
    }

    const task = {
      id: generateId(),
      text: trimmed,
      completed: false,
      createdAt: Date.now()
    };
    this._tasks.push(task);

    const ok = Storage.write('tld_tasks', this._tasks);
    if (!ok) {
      this._tasks.pop();
      if (errEl) errEl.textContent = 'Could not save task — storage unavailable.';
      return;
    }

    if (errEl) errEl.textContent = '';
    if (input) input.value = '';
    this.render();
  },

  toggleTask(id) {
    const task = this._tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    const ok = Storage.write('tld_tasks', this._tasks);
    if (!ok) {
      // Retain toggled state in session (Req 10.5 — do not revert visual change)
      // but surface a visible error to the user (Req 10.5 — "display an error indication")
      this._showToggleError('Could not save task status — changes will be lost on reload.');
    } else {
      this._clearToggleError();
    }
    this.render();
  },

  _showToggleError(msg) {
    let errEl = document.getElementById('task-toggle-global-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'task-toggle-global-error';
      errEl.className = 'error-msg';
      errEl.setAttribute('role', 'alert');
      errEl.setAttribute('aria-live', 'assertive');
      const listEl = document.getElementById('task-list');
      if (listEl && listEl.parentNode) listEl.parentNode.insertBefore(errEl, listEl);
    }
    errEl.textContent = msg;
  },

  _clearToggleError() {
    const errEl = document.getElementById('task-toggle-global-error');
    if (errEl) errEl.textContent = '';
  },

  // Returns { ok: true } or { ok: false, error: string }
  editTask(id, text) {
    const task = this._tasks.find(t => t.id === id);
    if (!task) return { ok: false, error: 'Task not found.' };

    const trimmed = Sanitizer.trim(text);
    if (!Validator.isNonEmpty(trimmed)) {
      return { ok: false, error: 'Task text cannot be empty.' };
    }
    const norm = Sanitizer.normalise(trimmed);
    // Duplicate check excludes self (Property 9)
    if (this._tasks.some(t => t.id !== id && Sanitizer.normalise(t.text) === norm)) {
      return { ok: false, error: 'A task with this text already exists.' };
    }

    task.text = trimmed;
    const ok = Storage.write('tld_tasks', this._tasks);
    if (!ok) {
      return { ok: false, error: 'Could not save changes — storage unavailable.' };
    }
    this.render();
    return { ok: true };
  },

  deleteTask(id) {
    const idx = this._tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    const removed = this._tasks.splice(idx, 1)[0];
    const ok = Storage.write('tld_tasks', this._tasks);
    if (!ok) {
      // Restore at original position (Req 12.4)
      this._tasks.splice(idx, 0, removed);
      this._showDeleteError('Could not delete task — storage unavailable.');
      return;
    }
    this._clearDeleteError();
    this.render();
  },

  _showDeleteError(msg) {
    let errEl = document.getElementById('task-delete-global-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'task-delete-global-error';
      errEl.className = 'error-msg';
      errEl.setAttribute('role', 'alert');
      errEl.setAttribute('aria-live', 'assertive');
      const listEl = document.getElementById('task-list');
      if (listEl && listEl.parentNode) listEl.parentNode.insertBefore(errEl, listEl);
    }
    errEl.textContent = msg;
  },

  _clearDeleteError() {
    const errEl = document.getElementById('task-delete-global-error');
    if (errEl) errEl.textContent = '';
  },

  _getSortedTasks() {
    const copy = this._tasks.slice(); // never mutate canonical array
    if (this._sortMode === 'active-first') {
      copy.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.createdAt - b.createdAt;
      });
    } else if (this._sortMode === 'completed-first') {
      copy.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? -1 : 1;
        return a.createdAt - b.createdAt;
      });
    } else {
      // date-added: insertion order (createdAt ascending)
      copy.sort((a, b) => a.createdAt - b.createdAt);
    }
    return copy;
  },

  render() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    const sorted = this._getSortedTasks();

    if (sorted.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'No tasks yet. Add one above!';
      listEl.appendChild(li);
      return;
    }

    sorted.forEach(task => {
      const li = document.createElement('li');
      li.dataset.id = task.id;
      if (task.completed) li.classList.add('completed');

      // Checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'task-check-' + task.id;
      checkbox.checked = task.completed;
      checkbox.setAttribute('aria-label', 'Complete ' + task.text);
      checkbox.addEventListener('change', () => this.toggleTask(task.id));

      // Label
      const label = document.createElement('label');
      label.htmlFor = 'task-check-' + task.id;
      label.className = 'task-label';
      label.textContent = task.text;

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'task-edit-btn';
      editBtn.setAttribute('aria-label', 'Edit ' + task.text);
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this._startEdit(li, task));

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'task-delete-btn';
      deleteBtn.setAttribute('aria-label', 'Delete ' + task.text);
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

      // Inline-edit error placeholder (hidden until needed)
      const editErr = document.createElement('div');
      editErr.className = 'task-edit-error';
      editErr.setAttribute('role', 'alert');
      editErr.setAttribute('aria-live', 'assertive');

      li.appendChild(checkbox);
      li.appendChild(label);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);
      li.appendChild(editErr);
      listEl.appendChild(li);
    });
  },

  _startEdit(li, task) {
    // Replace task row contents with inline edit controls
    li.innerHTML = '';

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.setAttribute('aria-label', 'Edit task text');
    editInput.maxLength = 500;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'task-edit-save-btn';
    saveBtn.setAttribute('aria-label', 'Save edit');
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'task-edit-cancel-btn';
    cancelBtn.setAttribute('aria-label', 'Cancel edit');
    cancelBtn.textContent = 'Cancel';

    const editErr = document.createElement('div');
    editErr.className = 'task-edit-error';
    editErr.setAttribute('role', 'alert');
    editErr.setAttribute('aria-live', 'assertive');

    const confirmEdit = () => {
      const result = this.editTask(task.id, editInput.value);
      if (!result.ok) {
        editErr.textContent = result.error;
        editInput.focus();
      }
      // On success editTask called render() already
    };

    saveBtn.addEventListener('click', confirmEdit);
    cancelBtn.addEventListener('click', () => this.render()); // discard (Req 11.7)

    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); confirmEdit(); }
      if (e.key === 'Escape') { this.render(); }            // cancel (Req 11.7)
    });

    li.appendChild(editInput);
    li.appendChild(saveBtn);
    li.appendChild(cancelBtn);
    li.appendChild(editErr);

    // Focus with cursor at end (Req 11.2)
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }
};

/* ==========================================================
   QuickLinks — user-defined URL shortcuts, open in new tab
   ========================================================== */
const QuickLinks = {
  _links: [],

  init() {
    let raw;
    try {
      raw = Storage.read('tld_links', []);
    } catch (e) {
      raw = [];
      // Storage.read should never throw, but guard defensively
      const listEl = document.getElementById('link-list');
      if (listEl) {
        const li = document.createElement('li');
        li.className = 'empty-state';
        li.textContent = 'Could not load saved links.';
        listEl.appendChild(li);
      }
    }

    if (Array.isArray(raw)) {
      // Skip malformed entries (Req 15.5)
      this._links = raw.filter(link => {
        if (!link || !Validator.isValidUrl(link.url)) {
          if (link) console.warn('QuickLinks: skipping malformed entry:', link);
          return false;
        }
        return true;
      });
    } else {
      this._links = [];
    }

    this.render();

    const form = document.getElementById('link-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const labelInput = document.getElementById('link-label-input');
        const urlInput   = document.getElementById('link-url-input');
        this.addLink(
          labelInput ? labelInput.value : '',
          urlInput   ? urlInput.value   : ''
        );
      });
    }
  },

  addLink(label, url) {
    const errEl      = document.getElementById('link-add-error');
    const labelInput = document.getElementById('link-label-input');
    const urlInput   = document.getElementById('link-url-input');

    const trimLabel = Sanitizer.trim(label);
    const trimUrl   = Sanitizer.trim(url);

    if (!Validator.isNonEmpty(trimLabel)) {
      if (errEl) errEl.textContent = 'Label is required.';
      return;
    }
    if (!Validator.isWithinLength(trimLabel, 100)) {
      if (errEl) errEl.textContent = 'Label must be 100 characters or fewer.';
      return;
    }
    if (!Validator.isValidUrl(trimUrl)) {
      if (errEl) errEl.textContent = 'Please enter a valid URL starting with http:// or https://.';
      return;
    }

    const link = {
      id: generateId(),
      label: trimLabel,
      url: trimUrl,
      createdAt: Date.now()
    };
    this._links.push(link);

    const ok = Storage.write('tld_links', this._links);
    if (!ok) {
      this._links.pop();
      if (errEl) errEl.textContent = 'Could not save link — storage unavailable.';
      return;
    }

    if (errEl) errEl.textContent = '';
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';
    this.render();
  },

  removeLink(id) {
    const idx = this._links.findIndex(l => l.id === id);
    if (idx === -1) return;

    const link = this._links[idx];
    // Confirmation required (Req 17.2)
    const confirmed = window.confirm('Remove "' + link.label + '"?');
    if (!confirmed) return;

    this._links.splice(idx, 1);
    const ok = Storage.write('tld_links', this._links);
    if (!ok) {
      // Restore at original position (Req 17.4)
      this._links.splice(idx, 0, link);
      const listEl = document.getElementById('link-list');
      const errLi = document.createElement('li');
      errLi.className = 'error-msg';
      errLi.setAttribute('role', 'alert');
      errLi.textContent = 'Could not remove link — storage save failed.';
      if (listEl) listEl.prepend(errLi);
      setTimeout(() => { if (errLi.parentNode) errLi.remove(); }, 4000);
      return;
    }
    this.render();
  },

  render() {
    const listEl = document.getElementById('link-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (this._links.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'No links yet. Add one above!';
      listEl.appendChild(li);
      return;
    }

    this._links.forEach(link => {
      const li = document.createElement('li');
      li.dataset.id = link.id;

      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = link.label;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'link-remove-btn';
      removeBtn.setAttribute('aria-label', 'Remove ' + link.label);
      removeBtn.textContent = '\u00D7'; // ×
      removeBtn.addEventListener('click', () => this.removeLink(link.id));

      li.appendChild(a);
      li.appendChild(removeBtn);
      listEl.appendChild(li);
    });
  }
};

/* ==========================================================
   Bootstrap — initialise all modules on DOMContentLoaded
   ThemeManager MUST be first to prevent theme flash (Req 18.4)
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  GreetingWidget.init();
  TimerWidget.init();
  TaskManager.init();
  QuickLinks.init();
});
