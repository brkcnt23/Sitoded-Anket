(() => {
  const button = document.getElementById('navToggle');
  const menu = document.getElementById('mobileNav');
  const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; menu.hidden = !open; button.setAttribute('aria-expanded', String(open)); });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { close(); button.focus(); } });
  window.matchMedia('(min-width: 1061px)').addEventListener('change', event => { if (event.matches) close(); });
  const language = document.getElementById('langToggle');
  language.addEventListener('click', () => { language.hash = location.hash; });
})();
// Archive filtering is progressive enhancement; every project remains linked without JS.
(() => {
 const search=document.getElementById('projectSearch'); if(!search)return;
 const entries=[...document.querySelectorAll('.project-entry')];
 search.addEventListener('input',()=>{const query=search.value.trim().toLocaleLowerCase('tr');let count=0;entries.forEach(entry=>{entry.hidden=!entry.dataset.search.toLocaleLowerCase('tr').includes(query);if(!entry.hidden)count++;});document.getElementById('projectEmpty').hidden=count!==0;});
})();
