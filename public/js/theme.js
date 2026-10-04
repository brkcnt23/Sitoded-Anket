// The public site and platform use the same light appearance.
(function(){function apply(){document.body.dataset.theme='light';try{localStorage.setItem('sitoded-theme','light');}catch(e){}}if(document.body)apply();else document.addEventListener('DOMContentLoaded',apply);})();
