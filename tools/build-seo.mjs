// Собирает раздел «SEO-панель» для облачной панели из шаблона локальной SEO-панели сайта
// (omobonus-serwis/scripts/seo-audit/panel-template.html). Шаблон не меняется — здесь только
// раскладка на файлы под строгую защиту страницы (без встроенных скриптов). Данных в результате нет:
// их облачная панель читает из приватного omobonus-workspace (seo/panel-data.json).
// Запуск: node tools/build-seo.mjs [путь к шаблону]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2] || 'C:/Users/Andrii/omobonus-serwis/scripts/seo-audit/panel-template.html'
const SITE = 'https://serwis.omobonus.com.pl'

const t = fs.readFileSync(SRC, 'utf8')
const pick = (re, what) => {
  const m = t.match(re)
  if (!m) throw new Error('В шаблоне не найдено: ' + what)
  return m[1]
}
const css = pick(/<style>([\s\S]*?)<\/style>/, 'стили')
const body = pick(/<body>([\s\S]*?)<script>/, 'разметка')
let js = pick(/<script>([\s\S]*?)<\/script>/, 'скрипт')
if (!js.includes('/*DATA*/')) throw new Error('В шаблоне нет места для данных /*DATA*/')
js = js.replace('/*DATA*/', '// Данные (DATA, HIST, MISSING) передаёт облачная панель — см. seo-boot.js')
// Ссылки на страницы — на опубликованный сайт вместо локального
js = js.split('http://localhost:3000').join(SITE)
// В данных уже есть английская версия — подпись языка вместо «undefined»
js = js.replace("const LN={pl:'PL',uk:'UK',ru:'RU'}", "const LN={pl:'PL',uk:'UK',ru:'RU',en:'EN'}")

const head = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow">
<title>SEO-панель Omobonus</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="seo.css">
<script src="seo-boot.js"></script>
</head>
<body>`

fs.writeFileSync(path.join(OUT, 'seo.css'), `/* Создано tools/build-seo.mjs из шаблона SEO-панели сайта — руками не править */\n${css.trim()}\n`)
fs.writeFileSync(path.join(OUT, 'seo-app.js'), `// Создано tools/build-seo.mjs из шаблона SEO-панели сайта — руками не править\n${js.trim()}\n`)
fs.writeFileSync(path.join(OUT, 'seo.html'), `${head}\n${body.trim()}\n</body>\n</html>\n`)
console.log('SEO-панель собрана: seo.html, seo.css, seo-app.js')
