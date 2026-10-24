// Раздел «SEO-панель»: результаты последней SEO-проверки сайта (данные — seo/panel-data.json
// в приватном omobonus-workspace, публикуются с компьютера после проверки). Сама панель —
// тот же интерфейс, что локальная SEO-панель, в отдельной рамке без доступа к ключу.
import * as gh from './github.js'

const FILE = 'seo/panel-data.json'
const view = document.getElementById('seo-view')
const bar = document.getElementById('seo-bar')
const frame = document.getElementById('seo-frame')
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const when = (iso) => new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

let loaded = false, busy = false

function info(html, bad = false) {
  bar.innerHTML = html
  bar.classList.toggle('bad', bad)
}

export async function open(force = false, onAuth) {
  view.hidden = false
  if ((loaded && !force) || busy) return
  busy = true
  info('Загрузка данных SEO-панели из GitHub…')
  try {
    const d = await gh.readJson(FILE)
    if (!d || typeof d.DATA !== 'object') throw new Error('Данные SEO-панели на GitHub повреждены.')
    frame.addEventListener('load', () => frame.contentWindow.omobonusStart(d), { once: true })
    frame.src = 'seo.html?' + Date.now()
    loaded = true
    info(`Данные SEO-проверки от <b>${esc(when(d.published))}</b>. Сами проверки запускаются на компьютере; решения сохраняются в этом браузере — «Скопировать решения для Claude». <button type="button" class="dt-b g" id="seo-refresh">Обновить</button>`)
  } catch (e) {
    if (e.code === 'AUTH') return onAuth?.(e.message)
    info(`${esc(e.message)} <button type="button" class="dt-b g" id="seo-refresh">Повторить</button>`, true)
  } finally {
    busy = false
  }
}

export function hide() {
  view.hidden = true
}

export function reset() {
  loaded = false
  frame.src = 'about:blank'
  info('')
  hide()
}
