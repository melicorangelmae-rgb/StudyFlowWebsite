

(function () {
  'use strict';
  const KEY = 'studyflow-tasks', LIMIT = 6, SOON = 3, TIMER_KEY = 'studyflow-timer';
  const PRIO = ['high', 'med', 'low'], VIEWS = ['dashboard', 'tasks', 'focus'];
  const BASE_TITLE = document.title;
  let tasks = [], filter = 'open';
  const $ = (id) => document.getElementById(id);
  const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

  /* Dates: whole calendar days, safe across daylight saving */
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const daysLeft = (t) => { const [y, m, d] = t.due.split('-').map(Number), n = today();
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); };
  const dueText = (n) => n < 0 ? Math.abs(n) + (n === -1 ? ' day' : ' days') + ' overdue' : n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : 'Due in ' + n + ' days';
  const fh = (h) => String(Math.round(h * 10) / 10);
  const left = (t) => Math.max(t.hours - t.spent, 0);
  const byDue = (a, b) => a.due.localeCompare(b.due);
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }

  /* Storage */
  const valid = (t) => t && typeof t.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) && Number.isFinite(t.hours) && PRIO.includes(t.prio);
  const norm = (t) => { t.spent = Math.max(Number(t.spent) || 0, 0); return t; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch (e) {} };
  function load() {
    try { const p = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(p)) { tasks = p.filter(valid).map(norm); return; } } catch (e) {}
    const s = (id, title, course, d, hours, prio) => ({ id, title, course, due: iso(addDays(today(), d)), hours, prio, done: false, spent: 0 });
    tasks = [s(1, 'Statistics problem set', 'MATH 210', 1, 4, 'high'), s(2, 'History essay draft', 'HIST 105', 3, 8, 'med'),
             s(3, 'Midterm exam revision', 'BIO 120', 5, 10, 'high'), s(4, 'Reading response', 'ENG 101', 6, 2, 'low')];
  }

  /* Dashboard */
  function renderDashboard() {
    const open = tasks.filter((t) => !t.done);
    $('sOpen').textContent = open.length;
    $('sHours').textContent = fh(open.reduce((s, t) => s + left(t), 0));
    $('sSoon').textContent = open.filter((t) => daysLeft(t) <= SOON).length;

    const load = new Array(7).fill(0);
    open.forEach((t) => { const span = Math.max(daysLeft(t), 0) + 1;
      for (let i = 0; i < span && i < 7; i++) load[i] += left(t) / span; });
    const max = Math.max(8, Math.ceil(Math.max(...load)));
    const week = $('week'), days = $('days'), start = today();
    week.querySelectorAll('.col').forEach((c) => c.remove());
    days.textContent = '';
    let over = 0;
    load.forEach((h, i) => {
      if (h > LIMIT) over++;
      const col = el('div', 'col');
      col.style.setProperty('--h', h / max * 100 + '%');
      col.append(el('div', 'bar' + (h > LIMIT ? ' over' : '')), el('small', '', h > 0 ? fh(h) + 'h' : ''));
      week.appendChild(col);
      days.appendChild(el('span', '', i === 0 ? 'Today' : dayName.format(addDays(start, i))));
    });
    $('limitLabel').textContent = LIMIT + ' h limit';
    $('limit').style.setProperty('--at', LIMIT / max * 100 + '%');
    $('note').textContent = over ? over + (over > 1 ? ' days are' : ' day is') + ' over ' + LIMIT + ' hours. Try starting some tasks earlier.'
      : open.length ? 'Your week looks manageable.' : 'Nothing planned. Add a task to get started.';
    week.setAttribute('aria-label', 'Planned study hours: ' + load.map((h, i) => (i ? dayName.format(addDays(start, i)) : 'today') + ' ' + fh(h) + ' hours').join(', '));

    const box = $('today'), items = open.filter((t) => left(t) > 0).sort(byDue);
    box.textContent = '';
    if (!items.length) { box.appendChild(el('div', 'empty', 'Nothing to study today. Add a task to build your plan.')); return; }
    const total = items.reduce((s, t) => s + left(t) / (Math.max(daysLeft(t), 0) + 1), 0);
    box.appendChild(el('p', 'meta', fh(total) + ' h planned today' + (total > LIMIT ? ', over your ' + LIMIT + ' h limit' : '')));
    items.forEach((t) => {
      const row = el('div', 'plan'), info = el('div');
      info.append(el('strong', '', t.title), el('div', 'meta', (t.course ? t.course + ' · ' : '') + dueText(daysLeft(t))));
      const b = el('button', 'btn ghost sm', 'Focus'); b.type = 'button'; b.dataset.focus = t.id;
      row.append(info, el('b', '', fh(left(t) / (Math.max(daysLeft(t), 0) + 1)) + ' h'), b);
      box.appendChild(row);
    });
  }

  /* Tasks */
  const shows = (t) => filter === 'all' || (filter === 'open' && !t.done) || (filter === 'done' && t.done) || (filter === 'soon' && !t.done && daysLeft(t) <= SOON);
  function renderTasks() {
    const list = $('list'), shown = tasks.filter(shows).sort(byDue);
    list.textContent = '';
    if (!shown.length) { list.appendChild(el('div', 'empty', filter === 'done' ? 'No completed tasks yet.' : 'No tasks here. Tap “New task” to add one.')); return; }
    shown.forEach((t) => {
      const n = daysLeft(t), row = el('div', 'task ' + t.prio + (t.done ? ' done' : ''));
      const box = el('input'); box.type = 'checkbox'; box.checked = t.done; box.dataset.id = t.id;
      box.setAttribute('aria-label', 'Mark "' + t.title + '" complete');
      const info = el('div'), prog = el('div', 'prog');
      prog.style.setProperty('--p', Math.min(t.spent / t.hours, 1) * 100 + '%');
      info.append(el('h3', '', t.title), el('div', 'meta', (t.course ? t.course + ' · ' : '') + fh(t.spent) + ' / ' + fh(t.hours) + ' h done'), prog);
      const side = el('div'), del = el('button', 'del', 'Delete');
      del.type = 'button'; del.dataset.del = t.id; del.setAttribute('aria-label', 'Delete "' + t.title + '"');
      side.append(el('div', 'due' + (n < 0 && !t.done ? ' late' : ''), dueText(n)), del);
      row.append(box, info, side);
      list.appendChild(row);
    });
  }

  /* Focus timer: uses an end timestamp so background tabs stay accurate */
  const num = (v, lo, hi, d) => { v = Math.round(Number(v)); return v >= lo && v <= hi ? v : d; };
  let focusMin = 25, restMin = 5;
  try { const c = JSON.parse(localStorage.getItem(TIMER_KEY)); if (c) { focusMin = num(c.f, 1, 180, 25); restMin = num(c.r, 1, 60, 5); } } catch (e) {}
  const timer = { mode: 'focus', len: focusMin, ms: focusMin * 6e4, end: 0, id: null };
  function setMode(mode) { timer.mode = mode; timer.len = mode === 'focus' ? focusMin : restMin; timer.ms = timer.len * 6e4; }
  function applyCfg(f, r) {
    focusMin = num(f, 1, 180, focusMin); restMin = num(r, 1, 60, restMin);
    $('fFocus').value = focusMin; $('fRest').value = restMin;
    try { localStorage.setItem(TIMER_KEY, JSON.stringify({ f: focusMin, r: restMin })); } catch (e) {}
    if (!timer.id) setMode(timer.mode);
    draw();
  }
  const clock = (ms) => { const s = Math.max(Math.ceil(ms / 1000), 0); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function draw(note) {
    $('clock').textContent = clock(timer.ms);
    $('fStart').textContent = timer.id ? 'Pause' : 'Start';
    $('fnote').textContent = note || (timer.mode === 'focus' ? 'Focus · ' + timer.len + ' min' : 'Rest · ' + timer.len + ' min');
    $('clock').classList.toggle('rest', timer.mode === 'break');
    $('fSkip').hidden = timer.mode !== 'break';
    $('fFocus').disabled = $('fRest').disabled = Boolean(timer.id);
    document.title = timer.id ? clock(timer.ms) + ' · StudyFlow' : BASE_TITLE;
  }
  function renderSelect() {
    const sel = $('fTask'), prev = sel.value, open = tasks.filter((t) => !t.done).sort(byDue);
    sel.textContent = '';
    if (!open.length) { const o = el('option', '', 'No open tasks'); o.value = ''; sel.appendChild(o); return; }
    open.forEach((t) => { const o = el('option', '', t.title); o.value = t.id; sel.appendChild(o); });
    if (open.some((t) => String(t.id) === prev)) sel.value = prev;
  }
  const stop = () => { clearInterval(timer.id); timer.id = null; };
  function finish() {
    stop();
    let note;
    if (timer.mode === 'focus') {
      const t = tasks.find((x) => String(x.id) === $('fTask').value);
      const done = timer.len;
      if (t) { t.spent += done / 60; save(); render(); note = done + ' min logged to "' + t.title + '". Rest for ' + restMin + ' min.'; }
      else note = 'Session done. Pick a task next time to log it. Rest for ' + restMin + ' min.';
      setMode('break');
    } else { setMode('focus'); note = 'Rest is over. Ready for the next session?'; }
    draw(note);
  }
  function toggle() {
    if (timer.id) { timer.ms = timer.end - Date.now(); stop(); }
    else { timer.end = Date.now() + timer.ms; timer.id = setInterval(() => { timer.ms = timer.end - Date.now(); timer.ms <= 0 ? finish() : draw(); }, 250); }
    draw();
  }
  function reset() { stop(); setMode('focus'); draw(); }

  /* Views */
  function show(view) {
    if (!VIEWS.includes(view)) view = 'dashboard';
    VIEWS.forEach((v) => {
      $('v-' + v).hidden = v !== view;
      const b = document.querySelector('#nav [data-view="' + v + '"]');
      if (v === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('title').textContent = view[0].toUpperCase() + view.slice(1);
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    window.scrollTo(0, 0);
  }
  function render() { renderDashboard(); renderTasks(); renderSelect(); }

  /* Events */
  function openDialog() { $('form').reset(); $('tDue').min = iso(today()); $('tDue').value = iso(addDays(today(), 1)); $('dlg').showModal(); $('tTitle').focus(); }
  $('newTask').addEventListener('click', openDialog);
  $('cancel').addEventListener('click', () => $('dlg').close());
  $('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) $('dlg').close(); });
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => $(id).value.trim(), title = v('tTitle');
    if (!title) return;
    tasks.push({ id: Date.now(), title, course: v('tCourse'), due: v('tDue'), hours: parseFloat(v('tHours')) || 1, spent: 0, prio: PRIO.includes(v('tPrio')) ? v('tPrio') : 'med', done: false });
    save(); render(); $('dlg').close();
  });
  $('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) show(b.dataset.view); });
  $('list').addEventListener('change', (e) => {
    const b = e.target.closest('input[data-id]'); if (!b) return;
    const t = tasks.find((x) => String(x.id) === b.dataset.id); if (t) t.done = b.checked;
    save(); render();
  });
  $('list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    tasks = tasks.filter((t) => String(t.id) !== b.dataset.del); save(); render();
  });
  document.querySelector('.filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    filter = c.dataset.f;
    document.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    renderTasks();
  });
  $('today').addEventListener('click', (e) => {
    const b = e.target.closest('[data-focus]'); if (!b) return;
    show('focus'); $('fTask').value = b.dataset.focus;
  });
  $('fStart').addEventListener('click', toggle);
  $('fReset').addEventListener('click', reset);
  $('fSkip').addEventListener('click', () => { stop(); setMode('focus'); draw(); });
  ['fFocus', 'fRest'].forEach((id) => $(id).addEventListener('change', () => applyCfg($('fFocus').value, $('fRest').value)));
  document.querySelector('.presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b || timer.id) return;
    const [f, r] = b.dataset.p.split(','); applyCfg(f, r);
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  /* Start */
  $('date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  load(); render(); $('fFocus').value = focusMin; $('fRest').value = restMin; draw(); show(location.hash.slice(1));
})();
