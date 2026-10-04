"""Repeatable import of SİTODED's public archive. Stores text, never executes source HTML."""
import json, re, unicodedata, urllib.request
from html.parser import HTMLParser
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'content/source-cache'; CACHE.mkdir(parents=True, exist_ok=True)
class TextBlocks(HTMLParser):
 def __init__(self):
  super().__init__(); self.blocks=[]; self.tag=None; self.parts=[]
 def handle_starttag(self, tag, attrs):
  if tag in ('h1','h2','h3','p','li'):
   self.flush(); self.tag=tag
  elif tag=='br': self.parts.append(' ')
 def handle_data(self, data):
  if self.tag: self.parts.append(data)
 def handle_endtag(self, tag):
  if tag==self.tag: self.flush()
 def flush(self):
  s=re.sub(r'\s+',' ',''.join(self.parts)).strip()
  if self.tag and s: self.blocks.append((self.tag,s))
  self.parts=[]; self.tag=None

def slug(s):
 s=s.translate(str.maketrans('ıİşŞğĞüÜöÖçÇ','iIsSgGuUoOcC')).lower()
 return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode()).strip('-')
def fetch(item):
 url,name=item; p=CACHE/name
 if not p.exists():
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  p.write_bytes(urllib.request.urlopen(req,timeout=40).read())
 return p.read_text()
projects=[]
for category,file in [('yerel','tr_yerel-projeler.html'),('uluslararasi','tr_uluslararasi-projeler.html')]:
 source=f'https://www.sitoded.org/tr/{category if category=="yerel" else "uluslararasi"}-projeler/'
 raw=(CACHE/file).read_text(); raw=raw.split('<div class="entry-content">',1)[1].split('<!-- entry-content -->')[0]
 parser=TextBlocks(); parser.feed(raw); parser.flush(); current=None
 for tag,txt in parser.blocks:
  if tag=='h2':
   title=txt.capitalize() if txt.isupper() else txt
   current={'slug':slug(txt),'title':title,'category':category,'source':source,'paragraphs':[]}; projects.append(current)
  elif current and tag in ('p','li'): current['paragraphs'].append(txt)
 for p in projects:
  p['summary']=p['paragraphs'][0][:220].rsplit(' ',1)[0]+'…' if p['paragraphs'] and len(p['paragraphs'][0])>220 else (p['paragraphs'][0] if p['paragraphs'] else '')
news_slugs=['sofya-bulgaristan-esc-firsati-2026-2','visoko-bosna-hersek-2026-1-esc-firsati','braga-portekizde-esc-firsati-2026-1','uskup-kuzey-makedonyada-esc-firsati-2026-3']
news=[]
for slug_,raw in zip(news_slugs,ThreadPoolExecutor(4).map(fetch,[(f'https://www.sitoded.org/tr/{s}/',s+'.html') for s in news_slugs])):
 # WordPress exposes article markup even when the REST API is disabled.
 start=raw.find('<article'); end=raw.find('</article>',start)
 article=raw[start:end] if start>=0 else raw
 parser=TextBlocks(); parser.feed(article); parser.flush()
 title=next((t for tag,t in parser.blocks if tag=='h1'),slug_)
 paras=[t for tag,t in parser.blocks if tag in ('p','li') and t]
 news.append({'slug':slug_,'title':title,'date':'2026-05-14','source':f'https://www.sitoded.org/tr/{slug_}/','paragraphs':paras})
(ROOT/'content/archive.json').write_text(json.dumps({'importedAt':'2026-09-20','projects':projects,'news':news},ensure_ascii=False,indent=2))
print('Imported projects:',len(projects),'news:',len(news))
for n in news: print(n['title'],len(n['paragraphs']), '\n', '\n'.join(n['paragraphs'])[:1800])
