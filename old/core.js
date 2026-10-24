// Правила журнала отложенных задач — те же, что у локального журнала (store.mjs в omobonus-serwis):
// задачи не удаляются, у каждой — версия и история, похожие названия отсекаются, закрытие — с причиной.
// Здесь только чистые функции над объектом журнала, без чтения/записи.
export const PRIORITIES = { high: 'Высокий', medium: 'Средний', low: 'Низкий' }
export const STATUSES = { deferred: 'Отложено', approved: 'Разрешено к работе', in_progress: 'В работе', closed: 'Закрыто' }
const TEXT_FIELDS = ['title', 'area', 'why', 'todo', 'risks', 'research']
const EDITABLE = [...TEXT_FIELDS, 'priority', 'status']

export class TaskError extends Error {
  constructor(code, message, extra = {}) {
    super(message)
    this.code = code
    Object.assign(this, extra)
  }
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

export function validate(data) {
  if (!data || !Array.isArray(data.tasks)) throw new TaskError('BAD_FILE', 'Журнал повреждён: нет списка задач')
  return data
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .map((w) => w.slice(0, 6))

export function findSimilar(title, tasks, exceptId) {
  const a = new Set(norm(title))
  if (!a.size) return []
  return tasks
    .filter((t) => t.id !== exceptId)
    .map((t) => {
      const b = new Set(norm(t.title))
      const common = [...a].filter((w) => b.has(w)).length
      return { id: t.id, title: t.title, status: t.status, score: common / Math.min(a.size, b.size || 1) }
    })
    .filter((x) => x.score >= 0.6)
    .sort((x, y) => y.score - x.score)
}

function clean(fields, { partial }) {
  const out = {}
  for (const k of EDITABLE) {
    if (!(k in fields)) continue
    out[k] = typeof fields[k] === 'string' ? fields[k].trim() : fields[k]
  }
  if (!partial || 'title' in out) {
    if (!out.title) throw new TaskError('INVALID', 'Нужно короткое название задачи')
    if (out.title.length > 120) throw new TaskError('INVALID', 'Название длиннее 120 знаков — сократите, подробности — в описании')
  }
  if ('priority' in out && !(out.priority in PRIORITIES)) throw new TaskError('INVALID', 'Неизвестный приоритет')
  if ('status' in out && !(out.status in STATUSES)) throw new TaskError('INVALID', 'Неизвестный статус')
  if (out.status === 'closed') throw new TaskError('INVALID', 'Закрывать — отдельной кнопкой «Закрыть» (с причиной)')
  return out
}

const nextId = (tasks) => 'T-' + String(tasks.reduce((m, t) => Math.max(m, +t.id.slice(2) || 0), 0) + 1).padStart(3, '0')

function find(data, id) {
  const t = data.tasks.find((x) => x.id === id)
  if (!t) throw new TaskError('NOT_FOUND', `Задача ${id} не найдена`)
  return t
}
function checkRev(t, expectedRev) {
  if (expectedRev != null && +expectedRev !== t.rev) {
    throw new TaskError('CONFLICT', `Задачу ${t.id} уже изменили в другом месте (версия ${t.rev}, у вас ${expectedRev}). Список обновлён — проверьте и повторите.`, { task: t })
  }
}

// Применить действие к журналу; возвращает задачу. Общие проверки — как в store.mjs mutate()
export function apply(data, op) {
  validate(data)
  const before = data.tasks.length
  const ids = data.tasks.map((t) => t.id)
  const result = run(data, op)
  if (data.tasks.length < before || ids.some((id) => !data.tasks.some((t) => t.id === id))) {
    throw new TaskError('LOSS', 'Отказ: запись привела бы к потере существующих задач')
  }
  data.rev = (data.rev || 0) + 1
  data.updated = now()
  return result
}

function run(data, { type, id, fields = {}, rev, note = '', force = false, by }) {
  if (type === 'add') {
    const f = clean(fields, { partial: false })
    const similar = findSimilar(f.title, data.tasks)
    if (similar.length && !force) throw new TaskError('DUPLICATE', 'Похожая задача уже есть', { similar })
    const t = {
      id: nextId(data.tasks),
      title: f.title,
      priority: f.priority || 'medium',
      status: f.status || 'deferred',
      area: f.area || '',
      why: f.why || '',
      todo: f.todo || '',
      risks: f.risks || '',
      research: f.research || '',
      created: now(),
      updated: now(),
      rev: 1,
      history: [{ date: now(), by, action: 'created', note }],
    }
    data.tasks.push(t)
    return t
  }
  const t = find(data, id)
  checkRev(t, rev)
  if (type === 'update') {
    const f = clean(fields, { partial: true })
    if (t.status === 'closed' && 'status' in f) throw new TaskError('INVALID', 'Задача закрыта — сначала откройте её снова')
    if ('title' in f) {
      const similar = findSimilar(f.title, data.tasks, id)
      if (similar.length && !force) throw new TaskError('DUPLICATE', 'Похожая задача уже есть', { similar })
    }
    const changes = {}
    for (const [k, v] of Object.entries(f)) if (t[k] !== v) changes[k] = { from: t[k], to: v }
    if (!Object.keys(changes).length && !note) return t
    for (const [k, c] of Object.entries(changes)) t[k] = c.to
    t.rev += 1
    t.updated = now()
    t.history.push({ date: now(), by, action: 'edited', changes, note })
    return t
  }
  if (type === 'close') {
    if (!String(note).trim()) throw new TaskError('INVALID', 'Укажите причину закрытия')
    if (t.status === 'closed') throw new TaskError('INVALID', 'Задача уже закрыта')
    t.history.push({ date: now(), by, action: 'closed', changes: { status: { from: t.status, to: 'closed' } }, note })
    t.status = 'closed'
    t.rev += 1
    t.updated = now()
    return t
  }
  if (type === 'reopen') {
    if (t.status !== 'closed') throw new TaskError('INVALID', 'Задача не закрыта')
    t.history.push({ date: now(), by, action: 'reopened', changes: { status: { from: 'closed', to: 'deferred' } }, note })
    t.status = 'deferred'
    t.rev += 1
    t.updated = now()
    return t
  }
  throw new TaskError('INVALID', 'Неизвестное действие')
}

// Как store.mjs: JSON с отступом 1 и переводом строки в конце
export const serialize = (data) => JSON.stringify(data, null, 1) + '\n'
