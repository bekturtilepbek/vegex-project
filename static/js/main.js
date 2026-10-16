/* VEGEX — клиентский JS. Ванильный, без сборщиков. */

/* --- reveal-анимации при скролле (из концепта v3) --- */
const io = new IntersectionObserver(es => {
  es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: .1 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

/* --- анимация калибр-баров при попадании секции spec в вид (из концепта v3) --- */
const spec = document.querySelector('.spec');
const io2 = new IntersectionObserver(es => {
  es.forEach(e => {
    if (e.isIntersecting) {
      document.querySelectorAll('.cal-bar i').forEach(b => b.style.width = b.dataset.w + '%');
      io2.disconnect();
    }
  });
}, { threshold: .25 });
if (spec) io2.observe(spec);

/* --- форма заявки: собирает поля в сообщение и открывает WhatsApp ---
   Бэкенда нет (пока не решено, куда уходят заявки — см. content/ru.yaml,
   contact.form) — данные никуда не отправляются и не сохраняются, просто
   формируют текст для wa.me. Когда появится бэкенд — заменить открытие
   wa.me на fetch к API. */
const leadForm = document.getElementById('lead-form');
if (leadForm) {
  leadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = leadForm.querySelector('[data-form-status]');
    const data = new FormData(leadForm);
    const name = (data.get('name') || '').trim();
    if (!name) {
      if (status) { status.textContent = leadForm.dataset.err; status.dataset.state = 'err'; }
      return;
    }
    const lines = ['Заявка с сайта VEGEX:', `Имя: ${name}`];
    const company = (data.get('company') || '').trim();
    if (company) lines.push(`Компания: ${company}`);
    const phone = (data.get('phone') || '').trim();
    const cc = (data.get('cc') || '').trim();
    if (phone) lines.push(`Телефон: ${cc ? cc + ' ' : ''}${phone}`);
    const message = (data.get('message') || '').trim();
    if (message) lines.push(`Сообщение: ${message}`);
    if (status) { status.textContent = leadForm.dataset.opening; status.dataset.state = 'ok'; }
    const url = `https://wa.me/${leadForm.dataset.wa}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  });
}

/* --- выбор кода страны у телефона: listbox с поиском по названию/коду --- */
document.querySelectorAll('[data-cc]').forEach((box) => {
  const btn = box.querySelector('.cc-btn');
  const pop = box.querySelector('.cc-pop');
  const q = box.querySelector('.cc-q');
  const empty = box.querySelector('.cc-empty');
  const cur = box.querySelector('.cc-cur');
  const hidden = box.querySelector('input[name="cc"]');
  const tel = box.querySelector('input[type="tel"]');
  const opts = [...box.querySelectorAll('[role="option"]')];
  // популярные страны (до разделителя) дублируются в общем списке —
  // при поиске их прячем, чтобы не было повторов
  const sep = box.querySelector('.cc-sep');
  const topLis = [];
  for (let li = sep.previousElementSibling; li; li = li.previousElementSibling) topLis.push(li);
  const visible = () => opts.filter(o => !o.parentElement.hidden);
  const norm = (v) => v.toLowerCase().replace(/ё/g, 'е').trim();

  const filter = () => {
    const v = norm(q.value);
    const digits = v.replace(/[^\d]/g, '');
    const searching = v.length > 0;
    topLis.forEach(li => { li.hidden = searching; });
    sep.hidden = searching;
    let n = 0;
    opts.forEach((o) => {
      if (topLis.includes(o.parentElement)) return;
      const s = o.dataset.s;
      // по цифрам ищем код («49», «+49»), по буквам — начало любого слова названия
      const ok = !searching || (digits && /^[+\d\s]+$/.test(v)
        ? o.dataset.dial.slice(1).startsWith(digits)
        : s.startsWith(v) || s.includes(' ' + v) || s.includes('-' + v));
      o.parentElement.hidden = !ok;
      if (ok) n++;
    });
    empty.hidden = n > 0;
    pop.querySelector('.cc-list').scrollTop = 0;
  };

  const toggle = (open) => {
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    if (open) {
      q.value = '';
      filter();
      const sel = opts.find(o => o.getAttribute('aria-selected') === 'true');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
      q.focus();
    }
  };
  const pick = (o) => {
    const dial = o.dataset.dial;
    opts.forEach(x => x.setAttribute('aria-selected', x.dataset.s === o.dataset.s));
    hidden.value = dial;
    cur.innerHTML = o.querySelector('.cc-flag').outerHTML + `<b>${dial}</b>`;
    toggle(false);
    tel.focus();
  };

  // в номере — только цифры (код страны выбирается списком), максимум 15
  // (E.164). Чистим и ввод, и вставку/автозаполнение, сохраняя позицию
  // курсора. maxlength не ставим: он обрезал бы вставку «+996 (555) …»
  // ещё до очистки и терял хвост номера.
  tel.addEventListener('input', () => {
    const v = tel.value;
    const clean = v.replace(/\D/g, '').slice(0, 15);
    if (clean === v) return;
    const pos = Math.min(v.slice(0, tel.selectionStart).replace(/\D/g, '').length, clean.length);
    tel.value = clean;
    tel.setSelectionRange(pos, pos);
  });

  btn.addEventListener('click', () => toggle(pop.hidden));
  opts.forEach(o => o.addEventListener('click', () => pick(o)));
  q.addEventListener('input', filter);
  q.addEventListener('keydown', (e) => {
    const v = visible();
    if (e.key === 'ArrowDown' && v.length) { e.preventDefault(); v[0].focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (v.length) pick(v[0]); }
  });
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { toggle(false); btn.focus(); return; }
    if (e.key === 'Tab') { toggle(false); return; }
    if (document.activeElement === q) return;
    const v = visible();
    const i = v.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); v[Math.min(i + 1, v.length - 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i <= 0 ? q.focus() : v[i - 1].focus(); }
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) toggle(false); });
});

/* --- бургер-меню: показать/скрыть навигацию на мобильных --- */
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav ul');
if (burger && nav) {
  burger.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
  });
  nav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => document.body.classList.remove('nav-open'))
  );
}
