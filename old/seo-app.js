// Создано tools/build-seo.mjs из шаблона SEO-панели сайта — руками не править
// Данные (DATA, HIST, MISSING) передаёт облачная панель — см. seo-boot.js
// ===== Общее =====
const LN={pl:'PL',uk:'UK',ru:'RU',en:'EN'};
const len=s=>[...s].length;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cv=document.createElement('canvas').getContext('2d');
const px=(t,f='20px Arial')=>{cv.font=f;return Math.round(cv.measureText(t).width)};
const now=()=>new Date().toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
const fmtD=d=>d.split('-').reverse().join('.');
const load=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(e){return {}}};
const BRANDS=/\b(Zebra|Dymo|HP|Canon|Epson|Brother|Xerox|Kyocera|Ricoh|Lexmark|OKI|Samsung|Konica|Minolta|Sharp|Evolis|Fargo|Datacard|APC|Eaton|Jura|Saeco|Philips|Siemens|Bosch|DeLonghi|Lenovo|Dell|Asus|Acer|Apple|Godex|Sato|Bixolon|Citizen|Sawgrass|Mimaki|Mutoh|Roland|Kornit|Magicard|Entrust|Vertiv|Ever|Fellowes|HSM|Kobra|Rexel|BenQ|Optoma|Sony|Bambu|Creality|Anycubic|Prusa)\b/g;
// Отсечка: где обрежется текст шириной maxW (в px) — возвращает обрезанный хвост
function cutTail(t,maxW,font){if(px(t,font)<=maxW)return null;const ch=[...t];let n=ch.length;
  while(n>0&&px(ch.slice(0,n).join('')+'...',font)>maxW)n--;return {n,cut:ch.slice(n).join('').trim()}}

// ===== Лист Title (логика без изменений) =====
const TPL={pl:'Serwis i naprawa ',uk:'Сервіс і ремонт ',ru:'Сервис и ремонт ',en:' repair and service'};
// Шаблон: PL/UK/RU — «Serwis i naprawa [устройства]», EN — «[Device] repair and service»
const tplOk=(l,b)=>l==='en'?b.endsWith(TPL.en)&&len(b)>len(TPL.en):b.startsWith(TPL[l])&&len(b)>len(TPL[l]);
const tplName=l=>l==='en'?'[Device]'+TPL.en:TPL[l]+'[устройства]';
const EXTRA=/\s[—–-]\s.*|(cennik|ціни|цены|ceny)|\(.*?\)/gi;
// Синонимы одного устройства, соединённые «и/і/i/та/oraz», — бессмысленный повтор
const SYN=/(UPS|ДБЖ|ИБП)\s+(і|и|i|та|oraz)\s+(джерел|источник|zasilacz)|(джерел|источник|zasilacz)[^|]*?\s(і|и|i|та|oraz)\s+(UPS|ДБЖ|ИБП)/i;
const TBRANDS=/(Zebra|Dymo|HP|Canon|Epson|Brother|Xerox|Kyocera|Ricoh|Lexmark|OKI|Samsung|Konica|Minolta|Sharp|Evolis|Fargo|Datacard|APC|Eaton|Jura|Saeco|Philips|Siemens|Bosch|DeLonghi|Lenovo|Dell|Asus|Acer|Apple)/g;
const TITLE={key:'title',name:'Title',store:'omobonus-title-audit-v2',
  rows:DATA.title?DATA.title.rows:[],groups:DATA.title?DATA.title.groups:[],
  issues(r,full){const out=[];const base=full.endsWith(r.suffix)?full.slice(0,-r.suffix.length):full;
    if((full.match(/Omobonus/g)||[]).length!==1||!full.endsWith(r.suffix))out.push({cls:'bad',txt:'Суффикс не стандартный или повторяется'});
    if(SYN.test(base))out.push({cls:'bad',txt:'Повтор синонимов одного устройства'});
    if(!r.exc){
      if(!tplOk(r.l,base))out.push({cls:'bad',txt:`Не по шаблону «${tplName(r.l)}»`});
      const br=[...new Set(base.match(TBRANDS)||[])];if(br.length)out.push({cls:'bad',txt:`Производители: ${br.join(', ')}`});
      const ex=(base.match(EXTRA)||[]).map(x=>x.trim()).filter(Boolean);
      if(ex.length)out.push({cls:'bad',txt:`Лишнее: «${ex.join(' ')}»`});
    }
    const d=cutTail(full,600,'20px Arial');if(d)out.push(d.n<len(base)?{cls:'bad',txt:`ПК: обрезаются ключевые слова («…${d.cut}»)`}:{cls:'warn',txt:`ПК: обрезается «${d.cut}»`});
    let lines=1,line='';for(const w of full.split(' ')){const tr=line?line+' '+w:w;if(px(tr)>330&&line){lines++;line=w}else line=tr}
    if(lines>2)out.push({cls:'warn',txt:'Телефон: больше 2 строк, конец может обрезаться'});
    return out},
  status(r){if(r.isNew||r.prop||r.review)return 'todo';if(r.appr)return r.appr.applied?'done':'todo';
    return (r.exc||this.issues(r,r.t).length)?'todo':'done'},
  reasons(r){const t=[];
    if(r.review){t.push(['rv',r.review.status==='ok'?'Ваш вариант — проверено, ожидает утверждения':'Исправление вашего варианта']);if(r.review.why)t.push(['p',r.review.why]);return t}
    if(r.isNew)t.push(['nw','Новая страница — Title ещё не согласован']);
    if(r.appr&&!r.appr.applied)t.push(['p','Утверждено, но на сайте другой Title']);
    for(const i of this.issues(r,r.t))t.push(['',i.txt.replace(/^(ПК|Телефон): /,'Сейчас — $1: ')]);
    if(r.exc)t.push(['p',r.exc]);
    if(r.def===r.base&&!r.appr&&!r.isNew)t.push(['p','Предложение: оставить как есть']);
    return t},
  reasonCol:false,doneLabel:'Утверждено',ownPh:'Ваш Title',
  intro:todo=>todo
   ?`Шаблон: <b>Serwis i naprawa [устройства] | Omobonus Wrocław</b> (UK «Сервіс і ремонт …», RU «Сервис и ремонт …», EN «[Device] repair and service»). Суффикс добавляется автоматически и учтён в длине; показаны только проблемы (✕ — серьёзно, ◐ — может обрезаться хвост). <b>Утвердить</b> — принять предложение Claude. <b>Отклонить</b> — откроется поле «Свой вариант»: Claude проверит его после экспорта, до утверждения на сайт он не попадёт.`
   :`Только просмотр: применённые утверждённые Title и Title, полностью соответствующие стандарту. Повторно согласовывать не нужно.`,
  emptyTodo:'Новых ошибок, изменений и несогласованных Title нет — всё утверждено.'};

// ===== Лист Description =====
const DTAIL={pl:'Pełny cennik bez ukrytych kosztów',uk:'Повний прайс без прихованих витрат',ru:'Полный прайс без скрытых платежей',en:'Full price list, no hidden costs'};
const DCITY={pl:/we Wrocławiu/,uk:/у Вроцлаві/,ru:/во Вроцлаве/,en:/in Wrocław/};
// Обещания, которые должны быть подтверждены на странице (слово само по себе не запрещено)
const PROMISE=/bezpłatn\p{L}*|darmow\p{L}*|gratis|безкоштовн\p{L}*|бесплатн\p{L}*|najtań\p{L}*|найдешевш\p{L}*|самы\p{L}* дешев\p{L}*|najlepsz\p{L}*|найкращ\p{L}*|лучш\p{L}*|nr ?1\b|№ ?1\b|gwarancj\p{L}*|гаранті\p{L}*|гаранти\p{L}*|\b\d+ ?(min|minut|хв|мин)(?!\p{L})/giu;
const DESC={key:'description',name:'Description',store:'omobonus-description-audit-v1',
  rows:DATA.description?DATA.description.rows:[],groups:DATA.description?DATA.description.groups:[],
  // Правила — docs/seo/description-standard.md
  issues(r,t){const out=[];const n=len(t);
    if(n>160)out.push({cls:'bad',txt:`Длиннее 160 символов (+${n-160})`});
    else if(n<150)out.push({cls:'warn',txt:`Короче 150 (${n})`});
    // Google показывает ~2 строки по ~600 px (Arial 14px) — оценка приблизительная, только предупреждение
    let lines=1,line='',rest=[];for(const w of t.split(' ')){const tr=line?line+' '+w:w;
      if(lines>2)rest.push(w);else if(px(tr,'14px Arial')>600&&line){lines++;line=w;if(lines>2)rest.push(w)}else line=tr}
    if(lines>2)out.push({cls:'warn',txt:`ПК: не помещается в 2 строки, может обрезаться «${rest.join(' ')}»`});
    if(!/☎ 793 759 262$/.test(t))out.push({cls:'bad',txt:'Нет телефона «☎ 793 759 262» в конце'});
    if(!/Wrocław|Вроцлав/.test(t))out.push({cls:'bad',txt:'Нет города'});
    else if(!DCITY[r.l].test(t))out.push({cls:'warn',txt:`Город не в форме «${DCITY[r.l].source}»`});
    // Производители техники запрещены; названия ПО/прошивок (Klipper, Marlin) — допустимы
    const br=[...new Set(t.match(BRANDS)||[])];if(br.length)out.push({cls:'bad',txt:`Производители: ${br.join(', ')}`});
    if(r.excPending)out.push({cls:'warn',txt:'Исключение ждёт согласования: '+r.excPending});
    else{if(!r.exc&&(r.l==='en'?!/^✔ \S.* repair and service in Wrocław ✔/.test(t):!t.startsWith('✔ '+TPL[r.l])))out.push({cls:'bad',txt:r.l==='en'?'Не по шаблону «✔ [Device] repair and service in Wrocław ✔ …»':`Не по шаблону «✔ ${TPL[r.l]}[urządzeń] …»`});
      if(!t.endsWith(`✔ ${DTAIL[r.l]} ☎ 793 759 262`))out.push({cls:'bad',txt:`Концовка не «✔ ${DTAIL[r.l]} ☎ 793 759 262»`})}
    const pr=[...new Set((t.match(PROMISE)||[]).map(x=>x.trim()))];if(pr.length)out.push({cls:'warn',txt:`Проверить, что обещание подтверждено на странице: ${pr.join(', ')}`});
    // Повтор слова из первого блока (услуга в целом) в работах допустим: «Serwis i naprawa … ✔ Naprawa głowicy»
    const body=t.split('✔').filter(s=>s.trim()).slice(1).join(' ');
    const seen={},rep=new Set();for(const w of body.toLowerCase().match(/[\p{L}-]{5,}/gu)||[]){if(seen[w])rep.add(w);seen[w]=1}
    if(rep.size)out.push({cls:'warn',txt:`Повтор: ${[...rep].join(', ')}`});
    return out},
  status(r){if(r.review)return 'todo';if(r.appr)return r.appr.applied?'done':'todo';
    if(!r.exc&&!r.excPending)return 'todo'; // новая страница/язык — Description ещё не согласован
    return r.prop&&r.prop!==r.t?'todo':'done'},
  reasons(r){const t=[];
    if(r.review){t.push(['rv',r.review.status==='ok'?'Ваш вариант — проверено, ожидает утверждения':'Исправление вашего варианта']);if(r.review.why)t.push(['p',r.review.why]);return t}
    if(!r.appr&&!r.prop)t.push(['nw','Новая страница — Description ещё не согласован']);
    if(r.appr&&!r.appr.applied)t.push(['p','Утверждено, но на сайте другой Description']);
    if(r.why)t.push(['p',r.why]);
    for(const i of this.issues(r,r.t))t.push(['','Сейчас — '+i.txt]);
    if(r.exc)t.push(['p','Исключение: '+r.exc]);
    return t},
  detail(r){if(r.review||!r.prop)return '';let h='';
    if(r.works&&r.works.length)h+=`<ul class="works">${r.works.map(w=>`<li><b>${esc(w.w)}</b> — ${esc(w.why)}</li>`).join('')}</ul>`;
    if(r.warnings&&r.warnings.length)h+=`<span class="tags">${r.warnings.map(w=>`<span class="tag p">◐ ${esc(w)}</span>`).join('')}</span>`;
    if(r.evidence&&r.evidence.length)h+=`<details class="ev"><summary>Доказательства</summary><ul>${r.evidence.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></details>`;
    return h},
  reasonCol:true,doneLabel:'Без изменений',ownPh:'Ваш Description',
  intro:todo=>todo
   ?`Формат: <b>✔ Serwis i naprawa [urządzeń] we Wrocławiu ✔ [2–4 konkretne prace] ✔ Pełny cennik bez ukrytych kosztów ☎ 793 759 262</b> (UK «… у Вроцлаві … ✔ Повний прайс без прихованих витрат», RU «… во Вроцлаве … ✔ Полный прайс без скрытых платежей», EN «✔ [Device] repair and service in Wrocław … ✔ Full price list, no hidden costs» — те же работы в том же порядке, не дословный перевод). Цель 150–160 символов, максимум 160. Работы — реальные ремонтные работы из прайса, выбранные по исследованию (конкуренты, подсказки Google, Ads, прайс Omobonus); в колонке «Причина» — работы, предупреждения, доказательства. Правила — <b>docs/seo/description-standard.md</b>. ✕ — нарушение стандарта, ◐ — рекомендация (обрезка, длина меньше 150, проверить обещание), текст автоматически не меняется. <b>Утвердить</b> — принять предложение Claude. <b>Отклонить</b> — поле «Свой вариант»: Claude проверит его после экспорта, до утверждения на сайт ничего не попадёт.`
   :`Утверждённые и применённые Description — только просмотр, повторно не согласуются. ◐ здесь — рекомендации стандарта, автоматически ничего не меняется. «Исключение ждёт согласования» — отличие от стандарта, вопрос по которому ещё открыт.`,
  emptyTodo:'Новых ошибок и несогласованных Description нет.',
  emptyDone:'Таких страниц пока нет: ни один текущий Description не совпадает с согласованным форматом, поэтому все страницы вынесены в «Требуют решения».'};

const SHEETS=[['title','Title',TITLE],['description','Description',DESC],['h1','H1',mkHead('h1','H1')],['h2','H2',mkHead('h2','H2')],['h3','H3',mkHead('h3','H3')],['h4','H4',mkHead('h4','H4')]];

// ===== Состояние =====
const UIKEY='omobonus-title-audit-ui2';
let UI={sheet:'title',tab:{}};Object.assign(UI,load(UIKEY));
if(typeof UI.tab!=='object'||!UI.tab)UI.tab={title:UI.tab||'todo'};
{const k=location.hash.slice(1);if(SHEETS.some(s=>s[0]===k))UI.sheet=k} // localhost:4100/#description — открыть нужный лист
if(!SHEETS.some(s=>s[0]===UI.sheet))UI.sheet='title';
const saveUI=()=>{try{localStorage.setItem(UIKEY,JSON.stringify(UI))}catch(e){}};
for(const C of [TITLE,DESC]){
  C.S=load(C.store);C.save=()=>{try{localStorage.setItem(C.store,JSON.stringify(C.S))}catch(e){}};
  C.rows.forEach(r=>{r.st=C.status(r);
    r.def=r.review?(r.review.status==='ok'?r.review.own:r.review.fix):r.appr&&!r.appr.applied?r.appr.base:(r.prop??r.base)});
  C.TODO=C.rows.filter(r=>r.st==='todo');
  if(!C.TODO.length)UI.tab[C.key]='done'; // нечего решать — сразу показываем остальное
  if(!UI.tab[C.key])UI.tab[C.key]='todo';
}
let C=TITLE;
const st=r=>C.S[r.u]||(C.S[r.u]={});
// Решение действует только для того предложения, к которому оно было принято
const dec=r=>{const s=st(r);return s.d&&s.p===r.def?s.d:null};
const fullOf=r=>r.def+r.suffix;

// ===== Строки =====
function numHtml(r,f,cur){const n=len(f);const lim=C===DESC?160:60;const c=n>lim?' class="soft"':'';
  const w=C===DESC?px(f,'14px Arial'):px(f);
  let h=`<span class="num">${cur||f===r.t?`<b${c}>${n}</b>`:`${r.len} → <b${c}>${n}</b>`} · ${w} px</span>`;
  for(const i of C.issues(r,f))h+=`<span class="ck ${i.cls}">${i.cls==='bad'?'✕':'◐'} ${esc(i.txt)}</span>`;
  return h}
function urlCell(r){return `<span class="lang">${LN[r.l]}</span><a class="url" href="https://serwis.omobonus.com.pl${esc(r.u)}" target="_blank">${esc(r.u)}</a>`}
const cls=r=>{const d=dec(r);return d==='ok'?'approved':d==='no'?'rejected':''};
const ownCnt=(r,v)=>v.trim()?`${len(v.trim()+r.suffix)} симв.${r.suffix?' с суффиксом':''}`:(r.suffix?'впишите свой Title — суффикс добавится сам':'впишите свой Description');
const tagsHtml=r=>`<span class="tags">${C.reasons(r).map(([k,t])=>`<span class="tag ${k}">${esc(t)}</span>`).join('')}</span>`;
function decRow(r){const s=st(r),d=dec(r),own=s.own||'';
  return `<tr class="main ${cls(r)}" data-u="${esc(r.u)}">
  <td>${urlCell(r)}</td><td class="cur">${esc(r.t)}</td>
  <td><div class="prop">${esc(r.def)}<span class="suf">${esc(r.suffix)}</span></div>
   ${C.reasonCol?'':tagsHtml(r)}
   ${r.review&&r.review.status!=='ok'?`<span class="yours">Ваш вариант: «${esc(r.review.own+r.suffix)}»</span>`:''}
   ${r.rej?`<span class="prev">Ранее отклонено: «${esc(r.rej.t)}» — повторно не предлагаю</span>`:''}
   ${d==='no'?`<div class="own"><label>Свой вариант</label><div class="edit"><textarea class="ow" rows="1" placeholder="${C.ownPh}">${esc(own)}</textarea><span class="suf">${esc(r.suffix)}</span></div><span class="cnt">${ownCnt(r,own)}</span></div>`:''}</td>
  <td class="n">${numHtml(r,fullOf(r))}</td>
  ${C.reasonCol?`<td class="why">${tagsHtml(r)}${C.detail?C.detail(r):''}</td>`:''}
  <td><div class="act"><button class="a ok ${d==='ok'?'on':''}" data-d="ok">Утвердить</button><button class="a no ${d==='no'?'on':''}" data-d="no">Отклонить</button></div></td></tr>`}
function doneRow(r){const a=r.appr;
  return `<tr><td style="width:300px">${urlCell(r)}</td><td class="cur">${esc(r.t)}</td><td class="n">${numHtml(r,r.t,true)}</td>
  <td class="hist">${a?`Утверждено ${a.date}`:''}</td></tr>`}
function render(){const todo=UI.tab[C.key]==='todo';const want=todo?'todo':'done';
  const byPage={};C.rows.forEach(r=>{if(r.st===want)(byPage[r.s]=byPage[r.s]||[]).push(r)});
  let nav='',pages='';
  for(const [g,slugs] of C.groups){const list=slugs.filter(s=>byPage[s]);if(!list.length)continue;
    nav+=`<div class="g">${esc(g)}</div>`;
    for(const s of list){const rs=byPage[s];const id='p-'+(s||'home');
      nav+=`<a href="#${id}"><span>${esc(rs[0].name)}</span><span class="d" data-s="${s}">${todo?navCount(rs):rs.length}</span></a>`;
      const ttl=`${esc(rs[0].name)} <small>${s?'/uslugi/'+s:'/'}</small>`;
      pages+=`<section class="page" id="${id}">${todo?`<h2>${ttl}</h2>`:''}<table>`;
      pages+=todo?`<thead><tr><th style="width:150px">Язык / URL</th><th>${C.name} сейчас</th><th style="width:${C.reasonCol?28:32}%">Предлагаемый ${C.name}</th><th style="width:${C.reasonCol?14:18}%">Символы до → после</th>${C.reasonCol?'<th style="width:16%">Причина</th>':''}<th style="width:190px">Решение</th></tr></thead><tbody>${rs.map(decRow).join('')}</tbody>`
        :`<thead><tr><th class="pth" style="width:300px">${ttl}</th><th>${C.name}</th><th style="width:20%">Символы / предупреждение</th><th style="width:24%">История</th></tr></thead><tbody>${rs.map(doneRow).join('')}</tbody>`;
      pages+='</table></section>'}}
  document.getElementById('hist').innerHTML=histHtml(C.key);
  document.getElementById('nav').innerHTML=nav;document.getElementById('nav').classList.toggle('hidden',!nav);
  document.getElementById('pages').innerHTML=pages||`<div class="intro">${todo?C.emptyTodo:(C.emptyDone||'Пока пусто.')}</div>`;
  document.getElementById('intro').innerHTML=C.intro(todo);
  document.querySelectorAll('tr.main').forEach(bindRow);stats();tabs()}
const navCount=rs=>rs.filter(r=>dec(r)).length+'/'+rs.length;
function updNav(){document.querySelectorAll('nav .d').forEach(e=>{if(UI.tab[C.key]==='todo')e.textContent=navCount(C.TODO.filter(r=>r.s===e.dataset.s))})}
function bindRow(tr){const r=C.rows.find(x=>x.u===tr.dataset.u);
  tr.querySelectorAll('.a').forEach(b=>b.addEventListener('click',()=>{const s=st(r);const v=b.dataset.d;
    if(dec(r)===v){delete s.d;delete s.p}else{s.d=v;s.p=r.def}
    (s.log=s.log||[]).push({at:now(),d:s.d||'снято',prop:r.def});C.save();refresh(tr,r)}));
  const ow=tr.querySelector('.ow');if(ow){
    ow.addEventListener('input',()=>{const s=st(r);s.own=ow.value.replace(/\n/g,' ');C.save();tr.querySelector('.cnt').textContent=ownCnt(r,s.own)});
    ow.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ow.blur()}});
    ow.addEventListener('change',()=>{const s=st(r);if(s.own&&s.own.trim())(s.log=s.log||[]).push({at:now(),own:s.own.trim()});C.save();updNav();stats()})}}
function refresh(tr,r){const t=document.createElement('tbody');t.innerHTML=decRow(r);const a=t.firstElementChild;tr.replaceWith(a);bindRow(a);stats();updNav();
  const ow=a.querySelector('.ow');if(ow&&!ow.value)ow.focus()}
function stats(){const T=C.TODO,ok=T.filter(r=>dec(r)==='ok').length,no=T.filter(r=>dec(r)==='no').length;
  document.getElementById('stats').textContent=`Всего ${C.rows.length} · ${C.doneLabel} ${C.rows.length-T.length} · На решении ${T.length}: утв. ${ok} · откл. ${no} · осталось ${T.length-ok-no}`}
function tabs(){const el=document.getElementById('tabs');const t=UI.tab[C.key];
  el.innerHTML=`<button class="tab ${t==='todo'?'on':''}" data-t="todo">Требуют решения · ${C.TODO.length}</button><button class="tab ${t==='done'?'on':''}" data-t="done">${C.doneLabel} · ${C.rows.length-C.TODO.length}</button>`;
  el.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{UI.tab[C.key]=b.dataset.t;saveUI();render();scrollTo(0,0)}))}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
document.getElementById('copy').addEventListener('click',()=>{if(C.copy)return C.copy();const lines=[`Решения по ${C.name} (аудит Omobonus):`,''];
  for(const r of C.TODO){const d=dec(r);if(!d)continue;const s=st(r),f=fullOf(r);
    lines.push(`${r.u} [${LN[r.l]}] — ${d==='ok'?'УТВЕРДИТЬ':'ОТКЛОНИТЬ → свой вариант'}`);
    lines.push(`  сейчас: ${r.t} (${r.len})`);
    if(d==='ok')lines.push(`  итог: ${f} (${len(f)} симв.${C===TITLE?`, ${px(f)} px`:''})${f===r.t?' — без изменений':''}`);
    else{lines.push(`  предложено Claude: ${f}`);const o=(s.own||'').trim();
      lines.push(o?`  свой вариант: ${o+r.suffix} (${len(o+r.suffix)} симв.) — на проверку`:'  свой вариант: (не указан)')}}
  if(lines.length===2)lines.push('(решений пока нет)');
  const txt=lines.join('\n');
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Скопировано')).catch(()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Скопировано')})});

// ===== Листы H1–H4 =====
// Тот же порядок работы, что у Title и Description: страница — один блок, под каждым заголовком строки PL / UK / RU,
// у каждой языковой версии своё решение: Утвердить / Отклонить / Свой вариант (+ комментарий).
// Данные — scripts/seo-audit/heading-audit.mjs, предложения аудита — docs/seo/heading-decisions.json.
// Из панели сайт не меняется: решения хранятся в браузере и уходят Claude кнопкой «Скопировать решения для Claude».
// Текст после правки по предложению: строка прайса уходит в H4 без подписи в скобках, в остальных меняется только тег
function pText(p,it){return p.tab==='h4'&&p.prop.tag==='h4'?it.text.replace(/\s*\([^()]*\)\s*$/,''):it.text}
function mkHead(key,name){const d=DATA[key];if(!d)return {key,name,hasData:false,rows:[],TODO:[]};
  const info={};for(const p of d.pages)info[p.u]={l:p.l,slug:p.s.replace(/^uslugi\//,''),name:p.name};
  const byId=Object.fromEntries(d.rows.map(p=>[p.id,p])),rows=[],seen=new Set();
  const add=r=>{let k=key+'|'+r.u+'|'+r.t,n=1;while(seen.has(k))k=key+'|'+r.u+'|'+r.t+'#'+(++n);seen.add(k);
    rows.push(Object.assign(r,{k},info[r.u]||{l:'pl',slug:r.u,name:r.u}))};
  // 1) элементы предложений аудита (в т.ч. не заголовки: строки прайса, карточки) 2) остальные заголовки уровня на сайте
  for(const p of d.rows){const top=p.partOf&&byId[p.partOf]||p;
    for(const pg of p.pages)pg.items.forEach((it,j)=>add({u:pg.u,tag:it.tag,t:it.text,now:it.now,pos:it.pos??1e9,pr:top,sub:p,ptag:p.prop.tag,ptext:pText(p,it),g:'P:'+p.id+':'+j}))}
  const has=new Set(rows.map(r=>r.u+'|'+r.t));
  for(const p of d.pages)(d.live[p.u]||[]).forEach((t,i)=>{if(!has.has(p.u+'|'+t))add({u:p.u,tag:key,t,pos:((d.livePos||{})[p.u]||[])[i]??1e9,g:'L:'+i})});
  for(const r of rows)r.st=r.pr&&r.pr.status==='proposed'?'todo':'done';
  return {key,name,hasData:true,rows,TODO:rows.filter(r=>r.st==='todo'),props:d.rows,keep:d.keep,stages:d.stages,render:hRender,copy:hCopy}}
const HDSTORE='omobonus-headings-v2';const HD=load(HDSTORE);
const hdsave=()=>{try{localStorage.setItem(HDSTORE,JSON.stringify(HD))}catch(e){}};
const HTAGS=['h1','h2','h3','h4','p','div'];
const HST={proposed:'Предложено',approved:'Утверждено',rejected:'Отклонено',rework:'На доработке',implemented:'Внедрено'};
const HDN={ok:'Утвердить',no:'Отклонить',own:'Свой вариант'};
const HLIVE={applied:['уже внедрено','a'],changed:['изменилось на сайте','c'],missing:['не найдено на сайте','m']};
const LORD={pl:0,uk:1,ru:2,en:3};
const tagTxt=t=>/^h\d$/.test(t)?t.toUpperCase():`обычный текст (${t})`;
const hTag=t=>`<code class="htag${/^h\d$/.test(t)?'':' plain'}">&lt;${t}&gt;</code>`;
const mdc=s=>esc(s||'').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');
const hs=r=>HD[r.k]||(HD[r.k]={});
// Решение действует только для той редакции предложения Claude, к которой оно было принято
const hsig=r=>r.pr?r.pr.sig+'|'+r.ptag+'|'+r.ptext:'-';
const hdec=r=>{const s=HD[r.k];return s&&s.d&&s.p===hsig(r)?s.d:null};
// Общий компонент: элементы того же предложения аудита, без него — тот же заголовок на других страницах
const comp=r=>r.pr?C.rows.filter(x=>x.pr===r.pr):C.rows.filter(x=>!x.pr&&x.t===r.t);
const nPages=rs=>new Set(rs.map(x=>x.u)).size;
// Разделы навигации — как у Title; страницы вне них — «Прочие страницы»
function hGroups(){const G=(DATA.title&&DATA.title.groups||[]).map(([g,s])=>[g,s.slice()]),all=new Set(G.flatMap(g=>g[1]));
  const rest=[...new Set(C.rows.map(r=>r.slug))].filter(s=>!all.has(s));if(rest.length)G.push(['Прочие страницы',rest]);return G}
// Языковые версии одного заголовка — строки друг под другом: PL, UK, RU (порядок групп — как на странице)
function hBlocks(rs){const m=new Map();for(const r of rs){if(!m.has(r.g))m.set(r.g,[]);m.get(r.g).push(r)}
  const pos=g=>{const p=g.find(x=>x.l==='pl')||g[0];return p.pos};
  return [...m.values()].map(g=>g.sort((a,b)=>LORD[a.l]-LORD[b.l])).sort((a,b)=>pos(a)-pos(b))}
function hReason(r){if(!r.pr)return '';const p=r.pr,more=[p.conf?`<span class="tag ${p.conf==='П'?'cf':'gs'}">${p.conf==='П'?'подтверждено':'предположение'}</span>`:'',
    p.query?'Запрос: '+mdc(p.query):'',p.source?'Источник: '+mdc(p.source):'',...(p.warnings||[]).map(w=>'◐ '+mdc(w)),p.implNote?'При внедрении: '+mdc(p.implNote):''].filter(Boolean);
  return `<span class="tags"><span class="tag st${p.stage}">Этап ${p.stage}</span><span class="tag">${esc(p.priority)}</span></span><div>${mdc(p.reason)}</div>`
   +(more.length?`<details class="ev"><summary>Запрос, источник, оговорки</summary><ul>${more.map(x=>`<li>${x}</li>`).join('')}</ul></details>`:'')}
function hComp(r){const c=comp(r);if(c.length<2)return '';const ps=[...new Set(c.map(x=>x.u))];
  return `<details class="pl"><summary>${r.pr?'Общий компонент':'Тот же заголовок'}: ${c.length} заг. на ${ps.length} стр.</summary><ul>${ps.map(u=>`<li>${esc(u)}</li>`).join('')}</ul></details>`}
function hHist(r){const s=HD[r.k]||{};const L=(r.pr?r.pr.history||[]:[]).map(h=>`<li>${fmtD(h.date)} — ${r.pr.id}: ${HST[h.status]||h.status}${h.note?': '+esc(h.note):''}</li>`)
  .concat((s.log||[]).map(l=>`<li>${esc(l.at)} — ${l.d?HDN[l.d]:'решение снято'}${l.own?` «${esc(l.own.text)}» ${esc(tagTxt(l.own.tag))}`:''}${l.c?` · комментарий «${esc(l.c)}»`:''}${l.from?` · применено со строки ${esc(l.from)}`:''}</li>`));
  return L.length?`<details class="hh"><summary>История решений (${L.length})</summary><ul>${L.join('')}</ul></details>`:''}
function hRowHtml(r,first){const d=hdec(r),s=HD[r.k]||{},o=s.own||{tag:r.pr?r.ptag:r.tag,text:r.pr?r.ptext:r.t},n=comp(r).length;
  return `<tr class="hr ${d==='ok'?'approved':d==='no'?'rejected':d==='own'?'ownv':''}${first?' gs':''}" data-k="${esc(r.k)}">
  <td>${urlCell(r)}</td>
  <td>${hTag(r.tag)}<div class="cur">${esc(r.t)}</div>${HLIVE[r.now]?`<span class="ls ${HLIVE[r.now][1]}">${HLIVE[r.now][0]}</span>`:''}</td>
  <td>${r.pr?`${hTag(r.ptag)}<div class="prop">${esc(r.ptext)}</div>${r.ptag===r.tag&&r.ptext===r.t?'<span class="tag p">без изменений — уточнить</span>':''}<span class="tag">${esc(r.sub.id)}</span>${r.pr.status!=='proposed'?` <span class="tag hs-${r.pr.status}">${HST[r.pr.status]}</span>`:''}`:'<span class="muted">Изменений не предлагает</span>'}</td>
  <td class="why">${hReason(r)}${hComp(r)}</td>
  <td><div class="act h3b">${['ok','no','own'].map(k=>`<button class="a ${k==='own'?'my':k} ${d===k?'on':''}" data-d="${k}">${HDN[k]}</button>`).join('')}</div>
   ${d==='own'?`<div class="own o2"><label>Свой вариант</label><select class="et">${HTAGS.map(t=>`<option value="${t}" ${t===o.tag?'selected':''}>${tagTxt(t)}</option>`).join('')}</select><div class="edit"><textarea class="ow" rows="1" placeholder="Текст заголовка">${esc(o.text)}</textarea></div></div>`:''}
   ${d?`<div class="edit cm"><textarea class="hc" rows="1" placeholder="${d==='no'?'Почему отклонено (комментарий для Claude)':'Комментарий (необязательно)'}">${esc(s.c||'')}</textarea></div>`:''}
   ${d&&n>1?`<button class="reset all">Применить это решение ко всем ${n} заг. компонента</button>`:''}
   ${hHist(r)}</td></tr>`}
// Свои варианты из прежней версии панели (тот же ключ «лист|URL|текст») переносятся как «Свой вариант»; старые записи не удаляются
function hMigrate(S){if(S.mig)return;S.mig=1;const O=load('omobonus-headings-own-v1');let n=0;
  for(const r of S.rows){const o=O[r.k];if(o&&o.st==='on'&&!HD[r.k]){const own={tag:o.tag,text:o.text};HD[r.k]={d:'own',p:hsig(r),own,c:o.c||'',log:[{at:now(),d:'own',own,c:'перенесено из прежней версии панели'}]};n++}}
  if(n)hdsave()}
let HNAV={};
const hCnt=rs=>rs.filter(r=>hdec(r)).length+'/'+rs.length;
function hRender(){hMigrate(C);if(!UI.tab[C.key])UI.tab[C.key]=C.TODO.length?'todo':'done';const want=UI.tab[C.key],todo=want==='todo';
  const by={};C.rows.forEach(r=>{if(r.st===want)(by[r.slug]=by[r.slug]||[]).push(r)});
  let nav='',pages='';HNAV={};
  for(const [g,slugs] of hGroups()){const list=slugs.filter(s=>by[s]);if(!list.length)continue;
    nav+=`<div class="g">${esc(g)}</div>`;
    for(const s of list){const rs=by[s];const id='hp-'+(s.replace(/\W/g,'_')||'home');HNAV[s]=rs;
      nav+=`<a href="#${id}"><span>${esc(rs[0].name)}</span><span class="d" data-s="${esc(s)}">${hCnt(rs)}</span></a>`;
      pages+=`<section class="page" id="${id}"><h2>${esc(rs[0].name)} <small>${s?(/^(o-nas|kontakt|polityka|regulamin)/.test(s)?'/':'/uslugi/')+esc(s):'/'}</small></h2><table>`
       +`<thead><tr><th style="width:150px">Язык / URL</th><th>${C.name} сейчас</th><th style="width:22%">Предложение Claude</th><th style="width:20%">Причина</th><th style="width:230px">Решение</th></tr></thead><tbody>`
       +hBlocks(rs).map(b=>b.map((r,i)=>hRowHtml(r,i===0)).join('')).join('')+'</tbody></table></section>'}}
  document.getElementById('hist').innerHTML=histHtml(C.key);
  document.getElementById('nav').innerHTML=nav;document.getElementById('nav').classList.toggle('hidden',!nav);document.getElementById('wrap').classList.toggle('nonav',!nav);
  document.getElementById('pages').innerHTML=pages||`<div class="intro">${todo?`Предложений Claude по ${C.name}, ожидающих решения, нет. Любой заголовок можно утвердить, отклонить или заменить своим вариантом на вкладке «Без изменений».`:'Пока пусто.'}</div>`;
  document.getElementById('intro').innerHTML=`<b>${C.name}</b>: каждая страница — один блок, под каждым заголовком языковые версии PL / UK / RU, у каждой своё решение. `
   +(todo?'Здесь заголовки, по которым Claude предлагает изменение (предложения аудита: ID, этап, причина, источник). ':'Здесь остальные заголовки уровня на сайте — Claude их не меняет, но их тоже можно утвердить, отклонить или заменить своим вариантом. ')
   +`<b>Утвердить</b> — принять ${todo?'предложение Claude':'заголовок как есть'}. <b>Отклонить</b> — с комментарием, почему. <b>Свой вариант</b> — свой текст и уровень (H1–H4 или обычный текст). Для общего компонента одно решение применяется ко всем страницам только кнопкой «Применить это решение ко всем». Из панели сайт не меняется; потом «Скопировать решения для Claude».`;
  document.querySelectorAll('tr.hr').forEach(hBind);hStats();hTabs()}
function hBind(tr){const r=C.rows.find(x=>x.k===tr.dataset.k);
  tr.querySelectorAll('.a').forEach(b=>b.addEventListener('click',()=>{const s=hs(r),v=b.dataset.d;
    if(hdec(r)===v){delete s.d;delete s.p}else{s.d=v;s.p=hsig(r);if(v==='own'&&!s.own)s.own={tag:r.pr?r.ptag:r.tag,text:r.pr?r.ptext:r.t}}
    (s.log=s.log||[]).push({at:now(),d:s.d||'',own:s.d==='own'?{...s.own}:undefined});hdsave();hRefresh(tr,r)}));
  const et=tr.querySelector('.et'),ow=tr.querySelector('.ow'),hc=tr.querySelector('.hc'),all=tr.querySelector('.all');
  const logOwn=()=>{const s=hs(r);s.log.push({at:now(),d:'own',own:{...s.own}});hdsave()};
  if(et)et.addEventListener('change',()=>{hs(r).own.tag=et.value;logOwn()});
  if(ow){ow.addEventListener('input',()=>{hs(r).own.text=ow.value.replace(/\n/g,' ');hdsave()});
    ow.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ow.blur()}});ow.addEventListener('change',logOwn)}
  if(hc){hc.addEventListener('input',()=>{hs(r).c=hc.value.replace(/\n/g,' ');hdsave()});
    hc.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();hc.blur()}});
    hc.addEventListener('change',()=>{const s=hs(r);s.log.push({at:now(),d:s.d,c:(s.c||'').trim()});hdsave()})}
  if(all)all.addEventListener('click',()=>hAll(r))}
function hAll(r){const s=HD[r.k],d=hdec(r),c=comp(r).filter(x=>x!==r);if(!d||!c.length)return;
  const diff=c.filter(x=>hdec(x)&&hdec(x)!==d).length;
  if(!confirm(`Применить решение «${HDN[d]}» ещё к ${c.length} заг. на ${nPages(c)} стр.?`+(diff?`
У ${diff} из них уже есть другое решение — оно будет заменено.`:'')+(d==='own'?'\nСвой текст ставится только там, где исходный текст такой же; на других языках и страницах меняется только уровень.':'')))return;
  for(const x of c){const t=hs(x);t.d=d;t.p=hsig(x);
    if(d==='own')t.own={tag:s.own.tag,text:x.t===r.t?s.own.text:(x.pr?x.ptext:x.t)};else delete t.own;
    t.c=s.c||'';(t.log=t.log||[]).push({at:now(),d,own:t.own,c:s.c,from:`${r.u} [${LN[r.l]}]`})}
  hdsave();const y=scrollY;hRender();scrollTo(0,y);toast(`Применено к ${c.length}`)}
function hRefresh(tr,r){const t=document.createElement('tbody');t.innerHTML=hRowHtml(r,tr.classList.contains('gs'));const a=t.firstElementChild;tr.replaceWith(a);hBind(a);
  const f=a.querySelector('.ow')||(hdec(r)==='no'&&a.querySelector('.hc'));if(f&&hdec(r)){f.focus();f.setSelectionRange(f.value.length,f.value.length)}
  hStats();hTabs();sheets();document.querySelectorAll('nav .d[data-s]').forEach(e=>{const rs=HNAV[e.dataset.s];if(rs)e.textContent=hCnt(rs)})}
function hStats(){const T=C.TODO,c={ok:0,no:0,own:0};T.forEach(r=>{const d=hdec(r);if(d)c[d]++});
  const k=C.rows.filter(r=>r.st==='done'&&hdec(r)).length;
  document.getElementById('stats').textContent=`Всего ${C.rows.length} · Без изменений ${C.rows.length-T.length} · На решении ${T.length}: утв. ${c.ok} · откл. ${c.no} · свой ${c.own} · осталось ${T.length-c.ok-c.no-c.own}`+(k?` · решений по остальным ${k}`:'')}
function hTabs(){const el=document.getElementById('tabs'),t=UI.tab[C.key];
  el.innerHTML=`<button class="tab ${t==='todo'?'on':''}" data-t="todo">Требуют решения · ${C.TODO.length}</button><button class="tab ${t==='done'?'on':''}" data-t="done">Без изменений · ${C.rows.length-C.TODO.length}</button>`;
  el.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{UI.tab[C.key]=b.dataset.t;saveUI();hRender();scrollTo(0,0)}))}
function hCopy(){const lines=['Решения по заголовкам H1–H4 (аудит Omobonus). Сайт не менялся — это решения для будущего внедрения.'];let n=0;
  for(const [k,nm,S] of SHEETS){if(!/^h\d$/.test(k)||!S.hasData)continue;hMigrate(S);const G=hGroups(),ord={};G.flatMap(g=>g[1]).forEach((s,i)=>ord[s]=i);
    const gp={};for(const r of S.rows){const g=r.slug+'|'+r.g;if(!(g in gp)||r.l==='pl')gp[g]=r.pos}const P=r=>gp[r.slug+'|'+r.g];
    const rs=S.rows.filter(r=>{const s=HD[r.k];return s&&s.d&&s.p===hsig(r)}).sort((a,b)=>(ord[a.slug]??999)-(ord[b.slug]??999)||P(a)-P(b)||LORD[a.l]-LORD[b.l]);
    if(!rs.length)continue;lines.push('',`== ${nm} ==`);
    for(const r of rs){const s=HD[r.k],d=s.d;n++;
      lines.push(`${r.u} [${LN[r.l]}] — ${d==='ok'?(r.pr?'УТВЕРДИТЬ предложение '+r.sub.id:'УТВЕРДИТЬ: оставить как есть'):d==='no'?(r.pr?'ОТКЛОНИТЬ предложение '+r.sub.id:'ОТКЛОНИТЬ: заголовок требует доработки'):'СВОЙ ВАРИАНТ — на проверку'}`);
      lines.push(`  сейчас: <${r.tag}> ${r.t}`);
      if(r.pr&&d!=='ok')lines.push(`  предложено Claude: <${r.ptag}> ${r.ptext}`);
      if(d==='ok')lines.push(`  итог: <${r.pr?r.ptag:r.tag}> ${r.pr?r.ptext:r.t}${!r.pr||(r.ptag===r.tag&&r.ptext===r.t)?' — без изменений':''}`);
      if(d==='own')lines.push(`  свой вариант: <${s.own.tag}> ${s.own.text}`);
      const c=(s.c||'').trim();if(c)lines.push(`  комментарий: ${c}`);else if(d==='no')lines.push('  комментарий: (не указан)');
      const f=(s.log||[]).filter(l=>l.from).at(-1);if(f)lines.push(`  применено ко всему компоненту со строки ${f.from}`)}}
  if(!n)lines.push('','(решений пока нет)');
  const txt=lines.join('\n');
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Скопировано')).catch(()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Скопировано')})}

// ===== Листы и история =====
const setHH=()=>document.documentElement.style.setProperty('--hh',document.getElementById('hdr').offsetHeight+'px');
function chgLine(c){return c.type==='new'?`<b>новая</b> ${esc(c.u)} — «${esc(c.to)}»`:c.type==='removed'?`<b>пропала</b> ${esc(c.u)} — была «${esc(c.from)}»`:`${esc(c.u)}: <s>${esc(c.from)}</s> → «${esc(c.to)}»`}
function histOne(e,last){return `<div class="row"><span>${last?'Последняя проверка':'Проверка'}: <b>${fmtD(e.date)}</b></span><span>страниц: <b>${e.pages}</b></span><span>требуют решения: <b>${e.problems}</b></span><span>изменений с прошлой проверки: <b>${e.changes.length}</b></span></div>`
  +(e.note?`<div style="color:var(--muted);margin-top:3px">${esc(e.note)}</div>`:'')
  +(e.changes.length?`<details><summary>Список изменений (${e.changes.length})</summary><ul>${e.changes.map(c=>`<li>${chgLine(c)}</li>`).join('')}</ul></details>`:'')}
function histHtml(key){const L=HIST[key]||[];
  if(!L.length)return '<div class="histbox"><b>История проверок:</b> проверка ещё не проводилась.</div>';
  const prev=L.slice(0,-1).reverse();
  return `<div class="histbox">${histOne(L.at(-1),true)}`
   +(prev.length?`<details class="old"><summary>Предыдущие проверки (${prev.length})</summary>${prev.map(e=>`<div class="old">${histOne(e)}</div>`).join('')}</details>`:'')
   +((MISSING[key]||[]).length?`<div class="prev">Утверждённые страницы пропали с сайта: ${MISSING[key].map(esc).join(', ')}</div>`:'')+'</div>'}
function sheets(){const el=document.getElementById('sheets');
  el.innerHTML=SHEETS.map(([k,n,c])=>`<button class="sheet ${UI.sheet===k?'on':''}" data-k="${k}">${n}${c&&c.rows.length?`<span class="c">${c.TODO.length}</span>`:''}</button>`).join('');
  el.querySelectorAll('.sheet').forEach(b=>b.addEventListener('click',()=>{UI.sheet=b.dataset.k;saveUI();show();scrollTo(0,0)}))}
function show(){const sh=SHEETS.find(s=>s[0]===UI.sheet);const live=sh[2]&&(sh[2].rows.length||sh[2].hasData);sheets();
  for(const id of ['wrap','tabs','copy','stats'])document.getElementById(id).classList.toggle('hidden',!live);
  const em=document.getElementById('empty');em.classList.toggle('hidden',!!live);
  if(live){C=sh[2];document.getElementById('wrap').classList.remove('nonav');(C.render||render)()}else em.innerHTML=histHtml(UI.sheet)+`<div class="intro"><b>${sh[1]}</b>: проверки для этого элемента ещё не настроены. Лист оставлен пустым — аудит ${sh[1]} проводится отдельной задачей.</div>`;
  setHH()}
show();
(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>show());
addEventListener('resize',setHH);
