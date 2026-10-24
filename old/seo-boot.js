// Запуск SEO-панели внутри облачной панели: данные передаёт страница-родитель (тот же адрес),
// ключ доступа сюда не попадает.
window.omobonusStart = function (d) {
  if (window.omobonusStarted) return
  window.omobonusStarted = true
  window.DATA = d.DATA || {}
  window.HIST = d.HIST || {}
  window.MISSING = d.MISSING || {}
  var s = document.createElement('script')
  s.src = 'seo-app.js'
  document.body.appendChild(s)
}
document.addEventListener('DOMContentLoaded', function () {
  if (window.parent !== window) return
  var e = document.getElementById('empty')
  e.textContent = 'SEO-панель открывается из облачной панели Omobonus (раздел «SEO-панель»).'
  e.classList.remove('hidden')
})
