// Облачная панель «Отложенные задачи» — тот же интерфейс, что в локальной панели (localhost:4100/#zadania),
// но данные читаются и пишутся напрямую в приватный omobonus-workspace через API GitHub.
import { PRIORITIES, STATUSES } from './core.js'
import * as gh from './github.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const ACT = { created: 'создана', edited: 'изменена', closed: 'закрыта', reopened: 'открыта снова' }
const FIELD = { title: 'название', priority: 'приоритет', status: 'статус', area: 'область', why: 'зачем', todo: 'что сделать', risks: 'риски', research: 'исследовано' }

const root = document.getElementById('dt-root')
const ind = document.getElementById('ws-sync')
const alertBox = document.getElementById('ws-alert')
const outBtn = document.getElementById('logout')

let tasks = []
let filter = 'open', openId = null, form = null, closing = null, msg = '', busy = false

function status(state, text = '') {
  const L = { idle: ['Сохранено в GitHub', 'ok'], loading: ['Загрузка…', 'wait'], saving: ['Сохранение в GitHub…', 'wait'], error: ['Ошибка сохранения', 'bad'], off: ['Не подключено', 'ok-local'] }
  const [label, cls] = L[state]
  ind.className = 'ws-' + cls
  ind.textContent = label
  alertBox.innerHTML = state === 'error' ? `<b>Не сохранено.</b> ${esc(text)}` : ''
  alertBox.classList.toggle('on', state === 'error')
}
const toast = (t) => {
  const el = document.getElementById('toast')
  el.textContent = t
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 1800)
}

// ---------- вход ----------
function login(err = '') {
  gh.forget()
  tasks = []
  form = closing = openId = null
  outBtn.hidden = true
  status('off')
  root.innerHTML = `<form class="dt-form dt-login" id="login" autocomplete="off">
    <b>Вход в панель задач Omobonus</b>
    <p>Вставьте личный ключ доступа GitHub (только к репозиторию omobonus-workspace). Ключ хранится только в памяти этой вкладки: после закрытия или обновления страницы его нужно ввести снова. Отправляется он только в GitHub.</p>
    <label for="tok">Ключ доступа GitHub</label>
    <input id="tok" type="password" spellcheck="false" autocapitalize="off" autocomplete="off" required>
    ${err ? `<div class="dt-warn">${esc(err)}</div>` : ''}
    <div class="acts"><button class="dt-b" type="submit">Войти</button></div></form>`
  document.getElementById('tok').focus()
}
root.addEventListener('submit', async (e) => {
  if (e.target.id !== 'login') return
  e.preventDefault()
  const inp = document.getElementById('tok')
  gh.setToken(inp.value)
  inp.value = ''
  status('loading')
  try {
    await gh.load()
    outBtn.hidden = false
    reload(true)
  } catch (err) {
    login(err.message)
  }
})
outBtn.addEventListener('click', () => login())

// ---------- данные ----------
async function reload(fromCache = false) {
  try {
    if (!fromCache) {
      status('loading')
      await gh.load()
    }
    tasks = gh.current().tasks
    status('idle')
  } catch (e) {
    if (e.code === 'AUTH') return login(e.message)
    status('error', e.message)
    msg = e.message
  }
  paint()
}

async function run(op, done) {
  if (busy) return
  busy = true
  status('saving')
  paint()
  try {
    const t = await gh.save(op)
    tasks = gh.current().tasks
    status('idle')
    toast(done)
    return t
  } catch (e) {
    if (e.code === 'AUTH') return login(e.message)
    // Ошибки правил (дубликат, пустое название…) — не сбой GitHub, показываем у формы
    const rule = ['DUPLICATE', 'INVALID', 'CONFLICT', 'NOT_FOUND'].includes(e.code)
    if (e.code === 'CONFLICT' || e.code === 'STALE') await gh.load().then(() => (tasks = gh.current().tasks)).catch(() => {})
    if (rule) status('idle')
    else status('error', e.message)
    throw e
  } finally {
    busy = false
  }
}

// ---------- отрисовка (как в локальной панели) ----------
const isOpen = (t) => t.status !== 'closed'
const fmt = (d) => (d ? d.slice(0, 10).split('-').reverse().join('.') : '')
const order = { high: 0, medium: 1, low: 2 }
const tag = (kind, k, map) => `<span class="dt-tag ${kind}-${esc(k)}">${esc(map[k] || k)}</span>`

function detail(t) {
  const sec = (h, v) => (v ? `<h4>${h}</h4><p>${esc(v)}</p>` : '')
  const name = (k, v) => esc((k === 'status' ? STATUSES : PRIORITIES)[v] || v)
  const hist = t.history
    .slice()
    .reverse()
    .map((h) => {
      const ch = h.changes ? Object.entries(h.changes).map(([k, c]) => (k === 'status' || k === 'priority' ? `${FIELD[k]}: ${name(k, c.from)} → ${name(k, c.to)}` : esc(FIELD[k] || k))).join('; ') : ''
      return `<li>${fmt(h.date)} ${esc(String(h.date).slice(11, 16))} — ${esc(h.by)}: ${esc(ACT[h.action] || h.action)}${ch ? ' (' + ch + ')' : ''}${h.note ? ' — «' + esc(h.note) + '»' : ''}</li>`
    })
    .join('')
  const closeBox =
    closing === t.id
      ? `<div class="dt-form dt-close"><label for="dt-close-note">Причина закрытия (обязательно)</label><textarea id="dt-close-note"></textarea>${msg ? `<div class="dt-warn">${esc(msg)}</div>` : ''}<div class="acts"><button class="dt-b r" data-a="close-ok" ${busy ? 'disabled' : ''}>Закрыть задачу</button><button class="dt-b g" data-a="close-cancel">Отмена</button></div></div>`
      : ''
  return `<div class="dt-det">${t.area ? `<div class="meta">Область: ${esc(t.area)}</div>` : ''}${sec('Зачем нужна', t.why)}${sec('Что сделать', t.todo)}${sec('Риски', t.risks)}${sec('Что уже исследовано', t.research)}
    <div class="meta">Создана ${fmt(t.created)} · изменена ${fmt(t.updated)} · версия ${esc(t.rev)}</div>
    <div class="acts">${isOpen(t) ? `<button class="dt-b" data-a="edit">Изменить</button><button class="dt-b r" data-a="close">Закрыть</button>` : `<button class="dt-b" data-a="reopen" ${busy ? 'disabled' : ''}>Открыть снова</button>`}</div>
    ${closeBox}<details><summary>История изменений (${t.history.length})</summary><ul>${hist}</ul></details></div>`
}

function formHtml() {
  const t = form.task || {}
  const opts = (map, v) => Object.entries(map).filter(([k]) => k !== 'closed').map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')
  const ta = (k, label) => `<label for="dt-${k}">${label}</label><textarea id="dt-${k}">${esc(t[k])}</textarea>`
  const warn = form.similar?.length
    ? `<div class="dt-warn"><b>Похожие задачи уже есть:</b><ul>${form.similar.map((s) => `<li>${esc(s.id)} «${esc(s.title)}» — ${esc(STATUSES[s.status] || s.status)}</li>`).join('')}</ul>Если это точно другая задача — нажмите «Всё равно сохранить».</div>`
    : ''
  return `<div class="dt-form" id="dt-form"><b>${form.id ? 'Изменить ' + esc(form.id) : 'Новая задача'}</b>
    <label for="dt-title">Короткое название</label><input id="dt-title" maxlength="120" value="${esc(t.title)}">
    <div class="two"><div><label for="dt-priority">Приоритет</label><select id="dt-priority">${opts(PRIORITIES, t.priority || 'medium')}</select></div>
    <div><label for="dt-status">Статус</label><select id="dt-status">${opts(STATUSES, t.status || 'deferred')}</select></div>
    <div><label for="dt-area">Область</label><input id="dt-area" value="${esc(t.area)}" placeholder="SEO, cookie, дизайн…"></div></div>
    ${ta('why', 'Зачем нужна')}${ta('todo', 'Что сделать')}${ta('risks', 'Риски')}${ta('research', 'Что уже исследовано')}
    <label for="dt-note">Комментарий к изменению (в историю)</label><input id="dt-note" value="${esc(form.note)}">
    ${form.error ? `<div class="dt-warn">${esc(form.error)}</div>` : ''}${warn}
    <div class="acts"><button class="dt-b" data-a="save" ${busy ? 'disabled' : ''}>${busy ? 'Сохранение…' : 'Сохранить'}</button>${form.similar?.length ? `<button class="dt-b r" data-a="save-force" ${busy ? 'disabled' : ''}>Всё равно сохранить</button>` : ''}<button class="dt-b g" data-a="cancel">Отмена</button></div></div>`
}

function paint() {
  if (!gh.hasToken()) return
  syncForm()
  const all = tasks.slice().sort((a, b) => isOpen(b) - isOpen(a) || order[a.priority] - order[b.priority] || String(b.updated).localeCompare(a.updated))
  const list = all.filter((t) => (filter === 'open' ? isOpen(t) : filter === 'closed' ? !isOpen(t) : true))
  const nOpen = all.filter(isOpen).length
  const rows = list
    .map((t) => `<div class="dt-row ${openId === t.id ? 'open' : ''}" data-id="${esc(t.id)}"><span class="id">${esc(t.id)}</span><span class="t">${esc(t.title)}</span>${tag('p', t.priority, PRIORITIES)}${tag('s', t.status, STATUSES)}<span class="d">${fmt(t.updated)}</span></div>${openId === t.id ? detail(t) : ''}`)
    .join('')
  root.innerHTML = `<div class="dt-top"><h2>Отложенные задачи</h2>
    <div class="dt-f">${[['open', 'Открытые', nOpen], ['closed', 'Закрытые', all.length - nOpen], ['all', 'Все', all.length]].map(([k, n, c]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${n} · ${c}</button>`).join('')}</div>
    <button class="dt-b g" data-a="refresh">Обновить</button><button class="dt-b" data-a="new">+ Добавить задачу</button></div>
    <div class="dt-note">Общий журнал Omobonus для всех веток и сессий Claude. Задачи отсюда <b>не выполняются автоматически</b> — только после отдельного разрешения.</div>
    ${msg && !closing ? `<div class="dt-warn">${esc(msg)}</div>` : ''}${form ? formHtml() : ''}
    <div class="dt-list">${rows || '<div class="dt-empty">Задач нет</div>'}</div><div class="dt-file">Журнал: ${esc(gh.fileLabel())}</div>`
}

const val = (k) => document.getElementById('dt-' + k)?.value ?? ''
// Перед перерисовкой сохраняем то, что уже введено в форму
function syncForm() {
  if (!form || !document.getElementById('dt-title')) return
  for (const k of ['title', 'priority', 'status', 'area', 'why', 'todo', 'risks', 'research']) form.task[k] = val(k)
  form.note = val('note')
}

async function save(force) {
  syncForm()
  const f = form
  const fields = { ...f.task }
  for (const k of ['id', 'rev', 'history', 'created', 'updated']) delete fields[k]
  if (!force && !f.id) {
    const s = gh.similar(fields.title)
    if (s.length) return ((f.similar = s), (f.error = ''), paint())
  }
  try {
    const t = await run(f.id ? { type: 'update', id: f.id, rev: f.rev, fields, note: f.note || '', force } : { type: 'add', fields, note: f.note || '', force }, 'Сохранено в GitHub')
    if (!t) return
    form = null
    openId = t.id
  } catch (e) {
    f.similar = e.similar || []
    f.error = e.code === 'DUPLICATE' ? '' : e.message
    if (e.code === 'CONFLICT') f.rev = tasks.find((x) => x.id === f.id)?.rev ?? f.rev
  }
  paint()
}

async function act(op, done) {
  try {
    if (!(await run(op, done))) return
    closing = null
  } catch (e) {
    msg = e.message // окно закрытия остаётся открытым, причина — под ним
  }
  paint()
}

root.addEventListener('click', (e) => {
  if (!gh.hasToken()) return
  if (e.target.closest('[data-a],[data-f],.dt-row')) msg = ''
  const f = e.target.closest('[data-f]')
  if (f) return ((filter = f.dataset.f), paint())
  const a = e.target.closest('[data-a]')?.dataset.a
  const t = tasks.find((x) => x.id === openId)
  if (a === 'refresh') return reload()
  if (a === 'new') return ((form = { task: {} }), paint(), document.getElementById('dt-title')?.focus())
  if (a === 'cancel') return ((form = null), paint())
  if (a === 'save') return save(false)
  if (a === 'save-force') return save(true)
  if (a === 'edit' && t) return ((form = { id: t.id, rev: t.rev, task: { ...t } }), paint(), scrollTo(0, 0))
  if (a === 'close' && t) return ((closing = t.id), paint(), document.getElementById('dt-close-note')?.focus())
  if (a === 'close-cancel') return ((closing = null), paint())
  if (a === 'close-ok' && t) return act({ type: 'close', id: t.id, rev: t.rev, note: val('close-note') }, 'Задача закрыта')
  if (a === 'reopen' && t) return act({ type: 'reopen', id: t.id, rev: t.rev, note: '' }, 'Задача открыта снова')
  if (a) return
  const row = e.target.closest('.dt-row')
  if (row) {
    openId = openId === row.dataset.id ? null : row.dataset.id
    closing = null
    paint()
  }
})

// Не терять несохранённое: предупредить при закрытии вкладки с открытой формой
addEventListener('beforeunload', (e) => {
  if (form || busy) e.preventDefault()
})

login()
