// Чтение и запись журнала напрямую в приватный репозиторий через официальный API GitHub.
// Ключ доступа живёт только в памяти этой вкладки и уходит только на api.github.com.
import { apply, serialize, validate, findSimilar, TaskError } from './core.js'

export const CONFIG = {
  api: 'https://api.github.com',
  owner: '733603020al-crypto',
  repo: 'omobonus-workspace',
  branch: 'main',
  path: 'tasks/deferred-tasks.json',
}

let token = ''
let sha = '' // версия файла на GitHub — защита от записи поверх чужих изменений
let data = null

export const setToken = (t) => (token = String(t || '').trim())
export const hasToken = () => !!token
export const forget = () => ((token = ''), (sha = ''), (data = null))
export const fileLabel = () => `${CONFIG.owner}/${CONFIG.repo} · ${CONFIG.path} (ветка ${CONFIG.branch})`

const enc = new TextEncoder()
const dec = new TextDecoder()
function toB64(s) {
  const bytes = enc.encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const fromB64 = (b) => dec.decode(Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0)))

const url = (p = CONFIG.path) => `${CONFIG.api}/repos/${encodeURIComponent(CONFIG.owner)}/${encodeURIComponent(CONFIG.repo)}/contents/${p.split('/').map(encodeURIComponent).join('/')}`

async function gh(method, u, body, accept = 'application/vnd.github+json') {
  if (!token) throw new TaskError('AUTH', 'Введите ключ доступа GitHub')
  let r
  try {
    r = await fetch(u, {
      method,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        accept,
        authorization: 'Bearer ' + token,
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new TaskError('NETWORK', 'Нет связи с GitHub. Проверьте интернет — изменения не сохранены.')
  }
  const j = await r.json().catch(() => ({}))
  if (r.ok) return j
  const m = (j.message || '').toLowerCase()
  if (r.status === 401) throw new TaskError('AUTH', 'GitHub не принял ключ: он неверный, отозван или истёк. Введите ключ заново.')
  if ((r.status === 403 || r.status === 429) && m.includes('rate limit')) throw new TaskError('LIMIT', 'GitHub временно ограничил число запросов. Подождите несколько минут и повторите.')
  if (r.status === 403) throw new TaskError('FORBIDDEN', 'У ключа нет права записи в omobonus-workspace (нужно «Contents: Read and write»). Изменения не сохранены.')
  if (r.status === 404) throw new TaskError('NOT_FOUND_REPO', 'Журнал не найден или у ключа нет доступа к репозиторию omobonus-workspace.')
  if (r.status === 409 || (r.status === 422 && m.includes('sha'))) throw new TaskError('STALE', 'Журнал изменился на GitHub')
  throw new TaskError('GITHUB', `GitHub вернул ошибку ${r.status}${j.message ? ': ' + j.message : ''}. Изменения не сохранены.`)
}

export async function load() {
  const j = await gh('GET', `${url()}?ref=${encodeURIComponent(CONFIG.branch)}&t=${Date.now()}`)
  let d
  try {
    d = JSON.parse(fromB64(j.content || ''))
  } catch {
    throw new TaskError('BAD_FILE', 'Журнал на GitHub повреждён (не читается). Ничего не записываю.')
  }
  validate(d)
  sha = j.sha
  data = d
  return data
}
export const current = () => data

const MSG = { add: 'добавлена', update: 'изменена', close: 'закрыта', reopen: 'открыта снова' }

// Сохранение: действие применяется к свежему журналу и пишется с проверкой версии файла.
// Если файл успел измениться (другая сессия, Claude) — перечитываем и применяем действие заново;
// правила версий задач (rev) не дадут молча перезаписать чужую правку той же задачи.
export async function save(op) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!data || attempt > 0) await load()
    const draft = structuredClone(data)
    const t = apply(draft, { ...op, by: 'пользователь (облачная панель)' })
    try {
      const j = await gh('PUT', url(), {
        message: `Журнал задач: ${t.id} ${MSG[op.type]} (облачная панель)`,
        content: toB64(serialize(draft)),
        sha,
        branch: CONFIG.branch,
      })
      sha = j.content.sha
      data = draft
      return t
    } catch (e) {
      if (e.code !== 'STALE') throw e
    }
  }
  throw new TaskError('STALE', 'Журнал одновременно меняют в другом месте. Список обновлён — повторите действие через несколько секунд.')
}

export const similar = (title) => findSimilar(title, data?.tasks || [])

// Только чтение любого JSON-файла из omobonus-workspace (например, данные SEO-панели).
// Файл может быть больше 1 МБ, поэтому берётся «сырым» содержимым.
export async function readJson(p) {
  try {
    return await gh('GET', `${url(p)}?ref=${encodeURIComponent(CONFIG.branch)}&t=${Date.now()}`, undefined, 'application/vnd.github.raw+json')
  } catch (e) {
    if (e.code === 'NOT_FOUND_REPO') throw new TaskError('NOT_FOUND', `Данные ${p} ещё не опубликованы в omobonus-workspace.`)
    throw e
  }
}
