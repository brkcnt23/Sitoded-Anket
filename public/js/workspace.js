// Small, shared accessibility behaviours; server-side forms work without this file.
(()=>{
 const body=document.body;
 body.dataset.theme='light';
 document.querySelectorAll('.card-icon:empty,.card-header-icon:empty').forEach(el=>{el.setAttribute('aria-hidden','true');el.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"/></svg>';});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=document.getElementById('sidebar');const button=document.getElementById('menuToggle');if(menu?.classList.contains('menu-open')){menu.classList.remove('menu-open');button?.setAttribute('aria-expanded','false');button?.focus();}}});
 // Explicit labels for compact icon-only actions on mobile.
 const labels={'.tbtn-create':'Etkinlik oluştur','.tbtn-admin':'Yönetim paneli','.tbtn-logout':'Çıkış yap'};
 Object.entries(labels).forEach(([selector,label])=>document.querySelectorAll(selector).forEach(el=>el.setAttribute('aria-label',label)));
})();
