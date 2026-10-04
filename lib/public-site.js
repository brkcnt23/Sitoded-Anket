const archive = require('../content/archive.json');
const areas = [
 ['genclik','Gençlik','Youth','hero','peach','Gençlik değişimleri, yaygın öğrenme ve gönüllülükle gençlerin kendi geleceklerinde söz sahibi olmasını destekliyoruz.','Supporting young people through exchanges, non-formal learning and volunteering.'],
 ['cocuklar','Çocuklar','Children','children','blue','Oyun, kültür ve öğrenmeyi buluşturan etkinliklerle çocukların gelişimine katkı sunuyoruz.','Bringing play, culture and learning together to support children’s development.'],
 ['engelliler','Engelli bireyler','People with disabilities','inclusion','sage','Erişilebilirliği, eşit fırsatları ve toplumsal hayata katılımı birlikte güçlendiriyoruz.','Working together for accessibility, equal opportunities and participation.'],
 ['kadinlar','Kadınlar','Women','women','lavender','Kadınların karar alma süreçlerine, öğrenmeye ve üretime katılımını destekliyoruz.','Supporting women’s participation in decision-making, learning and creating.'],
 ['kultur','Kültür ve turizm','Culture and tourism','culture','sand','Erzurum’un kültürel mirasını tanıtıyor; farklı kültürler arasında diyalog kuruyoruz.','Sharing Erzurum’s heritage and building dialogue between cultures.'],
 ['spor','Spor','Sport','cycling','blue','Aktif yaşamı, takım ruhunu ve dayanışmayı bir araya getiren çalışmalar yürütüyoruz.','Connecting active living, teamwork and solidarity.'],
 ['cevre','Çevre','Environment','climate','sage','İklim farkındalığı, sürdürülebilir yaşam ve çevre eğitimi için yerelden harekete geçiyoruz.','Taking local action for climate awareness, sustainable living and environmental education.']
];
const categories={yerel:['Yerel projeler','Local projects'],uluslararasi:['Uluslararası projeler','International projects'],gelecek:['Gelecek çalışmalar','Future initiatives']};
// Illustrated subject families are explicit; the archive does not pretend these are event photos.
const projectArt={
 'dogayi-degil-bisikleti-kullan':'cycling','girisimci-gencler':'women',
 'gizli-kalmis-hazine':'culture','gonulluden-fikirler':'hero',
 'kucuk-yurekler-eglenerek-ogreniyor':'children','nesilden-nesile':'culture',
 'gocle-gelen-genclik':'inclusion','2011-gonulluleri':'cycling',
 'kultur-evi':'culture','hersey-ilkle-baslar':'hero',
 'sivil-iz-basarinin-anahtari-guc-birligi':'hero','yesil-yarinlar-yok-olmasin':'climate',
 'saglik-hijyen':'children','kardes-kulturler':'culture',
 'umutla-elele':'inclusion','coruh-un-turkusu':'climate',
 'anadolu-nun-zirvesinde-bulusalim':'culture','yeni-nesil-yeni-baslangic':'hero',
 'genclik-bilgi-bahcesi':'hero','genclik-koprusu':'hero',
 'genclik-ve-demokrasi-icin-calisalim':'inclusion','ucurtmalar-dogu-dan-genclerle-yukseliyor':'children',
 'bir-dunya-bin-millet':'culture','rehbergenc':'hero',
 'doga-tarih-adrenalin':'cycling','kar-altindan-gunyuzune':'culture',
 'sessiz-sohbetler':'inclusion','muzikle-anlasmak':'inclusion',
 'genclik-yonunu-buluyor':'women','ilk-adim-erzurum':'culture',
 'volunteerzurum':'hero','volunteerzurum-2':'children','volunteerzurum-3':'climate',
 'volunteerzurum-4':'inclusion','gonullu-girisimciler':'women'
};
const topics={hero:['Gençlik ve katılım','Youth and participation','people'],children:['Çocuklar ve öğrenme','Children and learning','book'],inclusion:['Kapsayıcılık ve iletişim','Inclusion and dialogue','dialog'],women:['Girişimcilik ve üretim','Enterprise and creativity','spark'],culture:['Kültür ve yerel miras','Culture and heritage','pin'],cycling:['Spor ve aktif yaşam','Sport and active living','sports'],climate:['Çevre ve iklim','Environment and climate','leaf']};
const featuredSlugs=['dogayi-degil-bisikleti-kullan','kucuk-yurekler-eglenerek-ogreniyor','sessiz-sohbetler','yesil-yarinlar-yok-olmasin','kultur-evi','girisimci-gencler'];
archive.projects.forEach(p=>{p.art=projectArt[p.slug]||'hero';p.topic=topics[p.art];p.featured=featuredSlugs.includes(p.slug);p.tone='sage';
 const meaningful=p.paragraphs.find(text=>text.length>75)||p.paragraphs[0]||'';
 p.summary=meaningful.length>180?meaningful.slice(0,180).replace(/\s+\S*$/,'')+'…':meaningful;
});
const destinations=[['sofia','Sofya','Sofia','Bulgaristan','Bulgaria','Medya ve gençlik iletişimi','Media and youth communication'],['visoko','Visoko','Visoko','Bosna Hersek','Bosnia and Herzegovina','Topluluk ve çocuklarla gönüllülük','Community and children’s volunteering'],['braga','Braga','Braga','Portekiz','Portugal','Çevre ve kuşaklar arası dayanışma','Environment and intergenerational solidarity'],['skopje','Üsküp','Skopje','Kuzey Makedonya','North Macedonia','Sosyal içerme ve gençlik çalışmaları','Social inclusion and youth work']];
archive.news.forEach((n,i)=>{n.art=destinations[i][0];n.destination=destinations[i];n.tone='sand';});
function publicLocals(req,page){
 const lang=req.query.lang==='en'?'en':'tr'; const t=(tr,en)=>lang==='en'?en:tr;
 const url=path=>{const [p,hash]=path.split('#');return p+(lang==='en'?(p.includes('?')?'&':'?')+'lang=en':'')+(hash?'#'+hash:'');};
 const names={home:['Sivil Toplum Destekleme Derneği','Civil Society Support Association'],about:['Hakkımızda','About us'],work:['Çalışma alanlarımız','Our work'],projects:['Projeler','Projects'],news:['Haberler','News'],contact:['İletişim','Contact'],cop31:['COP31 · Climate Zero','COP31 · Climate Zero']};
 return {lang,t,url,page,currentPath:req.path,user:req.user||null,title:t(...(names[page]||names.home))+' — SİTODED',description:t('Erzurum’da gençlik, gönüllülük ve sivil toplum. 2006’dan bu yana yerelden dünyaya uzanan bir dayanışma.','Youth, volunteering and civil society in Erzurum. Connecting local action with the world since 2006.'),areas,categories,topics,projects:archive.projects,news:archive.news};
}
module.exports={publicLocals,archive};
