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
    const email = (data.get('email') || '').trim();
    if (!name || !email) {
      if (status) { status.textContent = leadForm.dataset.err; status.dataset.state = 'err'; }
      return;
    }
    const lines = ['Заявка с сайта VEGEX:', `Имя: ${name}`];
    const company = (data.get('company') || '').trim();
    if (company) lines.push(`Компания: ${company}`);
    lines.push(`Email: ${email}`);
    const phone = (data.get('phone') || '').trim();
    if (phone) lines.push(`Телефон: ${phone}`);
    const message = (data.get('message') || '').trim();
    if (message) lines.push(`Сообщение: ${message}`);
    if (status) { status.textContent = leadForm.dataset.opening; status.dataset.state = 'ok'; }
    const url = `https://wa.me/${leadForm.dataset.wa}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  });
}

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
