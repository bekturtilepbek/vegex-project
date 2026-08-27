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
