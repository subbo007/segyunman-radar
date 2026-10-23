const $ = (id) => document.getElementById(id);
const WORLD = [
  {id:'ebola',label:'에볼라 (분디부교형)',available:true},
  {id:'dengue',label:'뎅기열',available:false},
  {id:'measles',label:'홍역',available:false},
  {id:'mpox',label:'엠폭스',available:false},
  {id:'cholera',label:'콜레라',available:false},
  {id:'influenza',label:'계절성 독감',available:false}
];
const KOREA = [
  {id:'chickenpox',label:'수두'},{id:'pertussis',label:'백일해'},
  {id:'measles',label:'홍역'},{id:'malaria',label:'말라리아'},
  {id:'dengue',label:'뎅기열(국내 신고)'},{id:'influenza',label:'독감(표본감시)'},
  {id:'covid19',label:'코로나19(표본감시)'},{id:'rhinovirus',label:'리노바이러스(표본감시)'},
  {id:'mycoplasma',label:'마이코플라스마 폐렴(표본감시)'},
  {id:'salmonella',label:'살모넬라 장염(표본감시)'},{id:'hfmd',label:'수족구병(표본감시)'}
];
const PROVINCES = [
  ['11','서울',126.986,37.568],['26','부산',129.075,35.180],['27','대구',128.602,35.871],
  ['28','인천',126.645,37.456],['29','광주',126.851,35.160],['30','대전',127.387,36.351],
  ['31','울산',129.311,35.539],['36','세종',127.290,36.480],['41','경기',127.090,37.413],
  ['42','강원',128.10,37.75],['43','충북',127.67,36.77],['44','충남',126.85,36.55],
  ['45','전북',127.04,35.72],['46','전남',126.78,34.90],['47','경북',128.70,36.40],
  ['48','경남',128.18,35.42],['50','제주',126.55,33.48]
];
const SOURCES = {
  world: 'https://www.who.int/emergencies/alert-and-response',
  korea: 'https://www.data.go.kr/data/15139178/openapi.do',
  dengue: 'https://worldhealthorg.shinyapps.io/dengue_global/'
};
const ebTitle = '2026 에볼라(분디부교 바이러스병)';
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = n => Number(n).toLocaleString('ko-KR');
const readableDate = s => /^\d{4}-\d\d-\d\d$/.test(s||'') ? s.replaceAll('-','.') : '확인 필요';
const safeUrl = u => /^https:\/\/[a-z\d.-]+(?:[/:?#]|$)/i.test(u||'') ? u : '#';
const VALID_SCOPES = ['world','korea'];
const state = {scope:'world',disease:'ebola',period:'latest',data:{},geo:{},imported:loadLocalImports(),selected:'COD',zoom:1,mapCenter:[500,250],renderedCodes:new Set(),lastLoadError:''};

function loadLocalImports(){try{const value=JSON.parse(localStorage.getItem('outbreak-atlas-import-v1')||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function saveLocalImports(){try{localStorage.setItem('outbreak-atlas-import-v1',JSON.stringify(state.imported))}catch{toast('브라우저 저장 공간이 부족합니다.')}}
function toast(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hidden'),3400)}

function diseaseName(scope,id){return (scope==='world'?WORLD:KOREA).find(d=>d.id===id)?.label||id}
function recordsWithLatest(list){const latest = new Map();for(const r of list){const prev=latest.get(r.code);if(!prev||(r.asOf||r.period||'')>=(prev.asOf||prev.period||''))latest.set(r.code,r)}return [...latest.values()]}
function importedRecords(){let records=state.imported.filter(r=>r.scope===state.scope&&r.disease===state.disease);if(state.period!=='latest') records=records.filter(r=>r.period===state.period);return recordsWithLatest(records)}
function activeData(){
  const custom=importedRecords();
  if(custom.length){return {
    id:'user-import', scope:state.scope, disease:state.disease, title:diseaseName(state.scope,state.disease),
    source:'사용자가 가져온 CSV (독립 검증되지 않음)',sourceUrl:'#',metric:'reported_cases',
    metricLabel:'가져온 파일의 신고·감시 수치',period:state.period==='latest'?'파일별 최신 기준일':state.period,
    snapshotDate:custom.reduce((d,r)=>r.asOf>d?r.asOf:d,''),records:custom, imported:true,
    countingNotes:['사용자가 가져온 자료입니다. 공식 수치 및 환자 분류 기준을 반드시 확인하세요.','지역별 신고 건수와 실제 감염 장소는 다를 수 있습니다.','동일 국가/시·도의 여러 날짜 자료는 가장 최신 기준일 하나만 표시합니다.']
  }}
  if(state.scope==='world'&&state.disease==='ebola')return state.data.ebola||{records:[]};
  const bundled=state.data[state.scope];
  const bundledRows=(bundled?.records||[]).filter(r=>r.disease===state.disease);
  if(bundledRows.length){const normalized=recordsWithLatest(bundledRows);return {...bundled,records:normalized,period:bundled.period||'제공된 최신 보고',snapshotDate:normalized.reduce((d,r)=>r.asOf>d?r.asOf:d,''),countingNotes:bundled.countingNotes||['원천 자료의 발생건수와 집계 구간을 확인하세요.','각 지역의 자료 기준일은 다를 수 있습니다.']};}
  return {scope:state.scope,disease:state.disease,records:[],source:state.scope==='korea'?'질병관리청 전수신고 감염병 발생현황 API':'WHO 공식 감시자료',sourceUrl:state.scope==='korea'?SOURCES.korea:(state.disease==='dengue'?SOURCES.dengue:'https://www.who.int/emergencies'),status:'pending',period:null,countingNotes:['아직 정규화된 지역별 실제 환자 데이터가 연결되지 않았습니다.','미수집 자료는 0명이 아니라 자료 없음으로 표시합니다.']};
}

function refreshDiseaseOptions(){
  const list=state.scope==='world'?WORLD:KOREA;
  $('diseaseSelect').innerHTML=list.map(d=>`<option value="${d.id}">${esc(d.label)}${(state.scope==='world'&&d.id==='ebola')?' · WHO 데이터':''}</option>`).join('');
  if(!list.some(d=>d.id===state.disease))state.disease=list[0].id;
  $('diseaseSelect').value=state.disease;
  const currentImports=state.imported.filter(r=>r.scope===state.scope&&r.disease===state.disease);
  const periods=[...new Set(currentImports.map(r=>r.period).filter(Boolean))].sort().reverse();
  $('periodSelect').innerHTML='<option value="latest">최신 보고 누적</option>'+periods.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
  if(state.period!=='latest'&&!periods.includes(state.period))state.period='latest';
  $('periodSelect').value=state.period;
  $('periodSelect').disabled=!periods.length;
}

function setScope(newScope){if(!VALID_SCOPES.includes(newScope))return;
  state.scope=newScope;state.disease=newScope==='world'?'ebola':'chickenpox';state.period='latest';state.selected=newScope==='world'?'COD':'11';state.zoom=1;state.mapCenter=newScope==='world'?[500,250]:[500,300];
  document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',b.dataset.scope===newScope));$('scopeSelect').value=newScope;
  refreshDiseaseOptions();renderAll();
}

function renderAll(){
  const ds=activeData(), records=ds.records||[], has=records.length>0, isEbola=state.scope==='world'&&state.disease==='ebola'&&!ds.imported;
  $('pageTitle').innerHTML=state.scope==='world'?'세계 감염병 발생 현황 <span class="title-dot">.</span>':'국내 감염병 발생 현황 <span class="title-dot">.</span>';
  $('pageSubtitle').textContent=state.scope==='world'?'WHO 공식 감시자료 기반 국가별 보고 현황을 탐색하세요.':'질병관리청 자료 기반 시·도별 발생 신고 현황을 탐색하세요.';
  $('breadcrumbScope').textContent=state.scope==='world'?'글로벌 현황':'대한민국 현황';
  $('ebolaFocus').classList.toggle('hidden',!isEbola);
  $('metricRegionLabel').textContent=state.scope==='world'?'확진 보고 국가':'신고 보고 시·도';
  $('mapTitle').textContent=state.scope==='world'?'국가별 감염병 발생 지도':'시·도별 감염병 발생 지도';
  $('mapDescription').textContent=isEbola?'에볼라 누적 확진 국가를 강조했습니다. 색상은 발생 건수 범주입니다.':'지역을 클릭하면 해당 지역의 신고 현황을 확인할 수 있습니다.';
  $('detailTitle').textContent=state.scope==='world'?'국가별 발생 현황':'시·도별 발생 현황';
  $('mapWatermark').textContent=state.scope==='world'?'WHO · NATURAL EARTH':'KDCA · ADMINISTRATIVE BOUNDARIES';
  $('mapBadge').textContent=has?(ds.imported?'USER IMPORT':'WHO OFFICIAL'):'DATA PENDING';
  $('filterDot').classList.toggle('warning',!has||ds.imported);
  $('filterStatusLabel').textContent=has?(ds.imported?'사용자 제공 데이터':'WHO 원천 수치'):'공식 지역별 수치 미연동';
  $('filterStatusDetail').textContent=has?('최신 관측 '+readableDate(ds.snapshotDate||'')):'인증·정규화 작업 필요';
  $('headerDataDate').textContent=has?('자료 기준 '+readableDate(ds.snapshotDate)):'지역별 수치 미연동';
  $('metricCases').textContent=has?nf(records.reduce((a,r)=>a+r.cases,0)):'—';
  $('metricDeaths').textContent=has&&records.some(r=>r.deaths!==null&&r.deaths!==undefined)?nf(records.reduce((a,r)=>a+(typeof r.deaths==='number'?r.deaths:0),0)):'—';
  $('metricRegions').textContent=has?nf(records.filter(r=>r.cases>0).length):'—';
  $('metricDate').textContent=has?readableDate(ds.snapshotDate):'—';
  $('metricCasesNote').textContent=has?(isEbola?'WHO: 2026년 유행 누적 확진':'공개 자료에 수록된 합계'):'실제 수치를 연결해야 표시';
  $('metricDeathsNote').textContent=has?'보고된 사망자만 합산 · 미보고 제외':'정식 연동 전 표시하지 않음';
  $('metricRegionsNote').textContent=has?'확진 건수가 보고된 지역':'0건과 미수집은 서로 다름';
  $('metricDateNote').textContent=has?'지역별 최종 관측일은 다름':'발표일과 실제 기준일을 구분';
  $('mapFooterNote').textContent=has?'지도 클릭 · 지역 선택':'연동 대기 · CSV로 데이터 가져오기';
  if(!records.some(r=>r.code===state.selected))state.selected=records[0]?.code||(state.scope==='world'?'COD':'11');
  renderMap(records);renderRegionList(records);renderSelected(records);renderSource(ds);renderNotes(ds);
}

const projWorld=([lng,lat])=>[(lng+180)/360*1000,(90-lat)/180*500];
const projKorea=([lng,lat])=>[(lng-123.9)/(131.6-123.9)*1000,(39.2-lat)/(39.2-32.6)*600];
function ringPath(coords,project){return coords.map((p,i)=>{const [x,y]=project(p);return (i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)}).join(' ')+'Z'}
function geometryPath(geometry,project){if(!geometry)return '';const type=geometry.type,coordinates=geometry.coordinates;return (type==='Polygon'?coordinates:[].concat(coordinates)).map(poly=>{
  if(type==='MultiPolygon')return poly.map(r=>ringPath(r,project)).join(' ');
  return ringPath(poly,project);
}).join(' ')}
function caseClass(cases){return cases>=100?'cases-high':cases>=10?'cases-mid':cases>0?'cases-few':''}
function svg(tag,attrs={},text=''){let node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));if(text)node.textContent=text;return node}
function regionByCode(code,rows){return rows.find(r=>r.code===code)}
function countryInfo(countryCode,rows){const r=regionByCode(countryCode,rows);return r?`${r.name} — ${nf(r.cases)}명 (기준 ${readableDate(r.asOf)})`:null}
function markerAt(x,y,code,name,count,scope){const g=svg('g');const c=svg('circle',{cx:x,cy:y,r:scope==='world'?3.5:4.4,class:scope==='world'?'map-marker':'map-city-pin','data-code':code,tabindex:scope==='world'?-1:0,role:scope==='world'?'presentation':'button','aria-label':`${name} ${count===null?'자료 없음':nf(count)+'명'}`});g.appendChild(c);
  if(scope==='korea'){const label=svg('text',{x:x+8,y:y+3,'text-anchor':'start',class:'map-city-label'},name);g.appendChild(label)}
  else if(count!==null && (count>=100 || state.zoom>=2.0)){const text=svg('text',{x:x+6,y:y-6,class:'map-marker-label'},nf(count));g.appendChild(text)}
  return g}
function countryCenter(f){const nums=[];function rec(v){if(Array.isArray(v)&&typeof v[0]==='number')nums.push(v);else if(Array.isArray(v))v.forEach(rec)}rec(f.geometry.coordinates);
  if(!nums.length)return[0,0];const box=nums.reduce((a,[x,y])=>[Math.min(a[0],x),Math.min(a[1],y),Math.max(a[2],x),Math.max(a[3],y)],[180,90,-180,-90]);return[(box[0]+box[2])/2,(box[1]+box[3])/2]}
const KNOWN_CENTERS={COD:[23,-3],KEN:[37.9,.15],NGA:[8,9.1],UGA:[32.5,1.3],FRA:[2.5,46.6]};
function attachMapEvents(node,code,name,rows){node.dataset.code=code;
  node.addEventListener('pointermove',event=>showTooltip(event,code,name,rows));
  node.addEventListener('pointerleave',hideTooltip);
  node.addEventListener('focus',event=>showTooltip(event,code,name,rows));
  node.addEventListener('blur',hideTooltip);
  node.addEventListener('click',()=>{state.selected=code;renderRegionList(rows);renderSelected(rows);highlightMap();});
  node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();node.click()}})
}
function showTooltip(event,code,name,rows){const r=regionByCode(code,rows), tip=$('mapTooltip'),canvas=$('mapCanvas');tip.innerHTML=`<strong>${esc(r?.name||name)}</strong><br/>${r?`확진 <b>${nf(r.cases)}명</b><br/><small>기준 ${readableDate(r.asOf)}</small>`:'<small>해당 자료 없음 · 0명 아님</small>'}`;
  tip.classList.remove('hidden');let x,y;if(event.clientX!==undefined&&event.clientX>0){const rect=canvas.getBoundingClientRect();x=event.clientX-rect.left+12;y=event.clientY-rect.top-55;}else{x=20;y=30;}tip.style.left=Math.max(5,Math.min(x,canvas.clientWidth-155))+'px';tip.style.top=Math.max(5,Math.min(y,canvas.clientHeight-88))+'px'
}
function hideTooltip(){$('mapTooltip').classList.add('hidden')}
function highlightMap(){document.querySelectorAll('.map-country').forEach(p=>p.classList.toggle('is-selected',p.dataset.code===state.selected))}
function updateViewBox(){const [W,H]=state.scope==='world'?[1000,500]:[1000,600],zx=W/state.zoom,zy=H/state.zoom,cx=state.mapCenter[0],cy=state.mapCenter[1];let x=Math.max(0,Math.min(W-zx,cx-zx/2)),y=Math.max(0,Math.min(H-zy,cy-zy/2));$('mapSvg').setAttribute('viewBox',`${x} ${y} ${zx} ${zy}`)}

function renderMap(rows){const world=state.scope==='world',geo=state.geo[world?'world':'korea'],g=$('mapPaths'),m=$('mapMarkers');g.replaceChildren();m.replaceChildren();$('mapSvg').setAttribute('aria-label',world?'국가별 감염병 보고 현황 세계 지도':'대한민국 시·도별 신고 감염병 지도');
  $('mapLoading').classList.toggle('hidden',!!geo);
  if(!geo){$('mapLoading').textContent='지도를 불러오지 못했습니다. 원본 자료 출처를 확인하세요.';return}
  const project=world?projWorld:projKorea;
  const features=geo.features||[];
  const dataByCode=new Map(rows.map(r=>[r.code,r]));
  const frag=document.createDocumentFragment();
  features.forEach(f=>{
    const raw=world?f.properties.iso3:(f.properties.CTPRVN_CD||f.properties.code||f.properties.iso3||'');
    const code=String(raw),r=dataByCode.get(code),name=world?f.properties.name:(f.properties.CTP_KOR_NM||f.properties.name||'대한민국');
    const attrs={d:geometryPath(f.geometry,project),class:'map-country '+(world?'':'korea-outline ')+caseClass(r?.cases||0),tabindex:0,role:'button','aria-label':`${name}: ${r?nf(r.cases)+'명':'자료 없음'}`};
    if(!attrs.d)return;
    const p=svg('path',attrs);attachMapEvents(p,code,name,rows);frag.appendChild(p);
  });g.appendChild(frag);
  if(world){rows.filter(r=>r.cases>0).forEach(r=>{
    const f=features.find(f=>f.properties.iso3===r.code),cen=KNOWN_CENTERS[r.code]||(f?countryCenter(f):null);if(!cen)return;const [x,y]=project(cen);m.appendChild(markerAt(x,y,r.code,r.name,r.cases,'world'))
  })}
  else{const hasProvinceShapes=features.some(f=>!!f.properties.CTPRVN_CD);
    if(!hasProvinceShapes) $('mapWatermark').textContent='대한민국 외곽 + 시·도 대표점 (경계 로드 실패)';
    for(const [code,name,lng,lat]of PROVINCES){const [x,y]=project([lng,lat]);const r=dataByCode.get(code),pin=markerAt(x,y,code,name,r?.cases??null,'korea');const c=pin.querySelector('circle');attachMapEvents(c,code,name,rows);m.appendChild(pin)}
  }
  updateViewBox();highlightMap();
}
function renderRegionList(rows){const list=$('regionList');list.replaceChildren();if(!rows.length){list.innerHTML='<div class="empty-regions">아직 지역별 발생 건수가 연결되지 않았습니다.<br/>공식 API를 연결하거나 CSV를 가져오면<br/>여기에 실제 수치가 표시됩니다.</div>';return}
  const sorted=[...rows].sort((a,b)=>b.cases-a.cases);
  for(let i=0;i<sorted.length;i++){const r=sorted[i],btn=document.createElement('button');btn.type='button';btn.className='region-row'+(state.selected===r.code?' active':'');btn.innerHTML=`<span class="region-left"><span class="region-rank">${String(i+1).padStart(2,'0')}</span><span><span class="region-name">${esc(r.name)}</span><span class="region-sub">${esc(r.statusLabel||'신고자료')} · ${esc(r.code)}</span></span></span><span class="region-value"><b>${nf(r.cases)}명</b><small>${readableDate(r.asOf)}</small></span>`;
    btn.addEventListener('click',()=>{state.selected=r.code;renderRegionList(rows);renderSelected(rows);highlightMap()});list.appendChild(btn)
  }
}
function renderSelected(rows){const r=regionByCode(state.selected,rows),target=$('selectedRegion');if(!r){target.textContent='지역별 수치를 연결하면 상세 발생 현황을 표시합니다.';$('detailBottom').textContent='미수집 지역을 환자 0명으로 간주하지 않습니다.';return}
  target.innerHTML=`<strong>${esc(r.name)} <span style="font-weight:500;color:#8b9aa8;font-size:10px">${esc(r.code)}</span></strong><div class="selected-figures"><span>누적 확진<br/><b>${nf(r.cases)}명</b></span><span>사망<br/><b>${r.deaths===null||r.deaths===undefined?'미보고':nf(r.deaths)+'명'}</b></span><span>기준일<br/><b style="font-size:13px">${readableDate(r.asOf)}</b></span></div>`;
  $('detailBottom').textContent=(r.statusLabel?`${r.statusLabel} · `:'')+'해당 숫자는 현재 격리 중인 환자 수가 아닌 누적 신고 수치입니다.';
}
function renderSource(ds){const body=$('sourcePanel');let url=safeUrl(ds.sourceUrl);body.innerHTML=`<div class="source-item"><span>통계 제공 기관</span><strong>${esc(ds.source||'미연동')}</strong></div><div class="source-item"><span>자료 공개 / 기준일</span><strong>${esc(readableDate(ds.snapshotDate))}</strong></div><div class="source-item"><span>데이터 상태</span><strong><span class="source-pill ${ds.imported||ds.status==='pending'?'warn':''}">${ds.imported?'개인 로컬 CSV':ds.status==='pending'?'지역별 자료 미연동':ds.updatedAutomatically?'자동 갱신 결과':'검증된 최초 스냅샷'}</span></strong></div><div class="source-item"><span>원천 자료</span><strong>${url==='#'?'사용자 제공 파일':`<a target="_blank" rel="noopener noreferrer" href="${url}">기관 공식 사이트 ↗</a>`}</strong></div>`;
  if(ds.checkedAt){let elem=document.createElement('div');elem.className='source-item';elem.innerHTML=`<span>마지막 자료 확인일</span><strong>${readableDate(ds.checkedAt.slice(0,10))}</strong>`;body.appendChild(elem)}
}
function renderNotes(ds){const body=$('qualityNotes');body.replaceChildren();for(const note of (ds.countingNotes||[]).slice(0,4)){let li=document.createElement('li');li.textContent=note;body.appendChild(li)} }

function renderNews(){const node=$('newsList');if(!node)return;const arr=state.data.alerts?.items||[];if(!arr.length){node.innerHTML='<div class="news-empty">최신 WHO 발생 경보 데이터를 연결하지 못했습니다. <a href="https://www.who.int/emergencies/disease-outbreak-news" target="_blank" rel="noopener noreferrer">WHO 공식 경보 확인 ↗</a></div>';return;}node.innerHTML=arr.slice(0,6).map(item=>`<a class="news-item" target="_blank" rel="noopener noreferrer" href="${safeUrl(item.url)}"><time>${readableDate(item.published)}</time><strong>${esc(item.title)}</strong><small>WHO 원문 보기 ↗</small></a>`).join('');}

function switchDisease(id){const allowed=state.scope==='world'?WORLD:KOREA;if(!allowed.some(d=>d.id===id))return;state.disease=id;state.period='latest';state.selected=state.scope==='world'?'COD':'11';refreshDiseaseOptions();renderAll()}

function parseCSV(text){const out=[];let row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){value+='"';i++;continue}if(c==='"'){quoted=!quoted;continue}if(c===','&&!quoted){row.push(value);value='';continue}if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(value);value='';if(row.some(v=>v.trim()))out.push(row);row=[];continue}value+=c}if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');row.push(value);if(row.some(v=>v.trim()))out.push(row);return out}
function normalizeCode(scope,code){code=String(code).trim().toUpperCase();if(scope==='korea')return code.padStart(2,'0');return code}
function importCSV(text){const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw Error('데이터 행이 없습니다.');const headers=rows.shift().map(h=>h.trim().toLowerCase());const required=['scope','disease','region_code','region_name','as_of','cases'];if(required.some(k=>!headers.includes(k)))throw Error('필수 열 누락: '+required.filter(k=>!headers.includes(k)).join(', '));
  const imported=[];for(const row of rows){const obj=Object.fromEntries(headers.map((k,i)=>[k,(row[i]||'').trim()]));if(!VALID_SCOPES.includes(obj.scope))throw Error('scope은 world 또는 korea여야 합니다.');const valid=(obj.scope==='world'?WORLD:KOREA).some(d=>d.id===obj.disease);if(!valid)throw Error('지원하지 않는 disease: '+obj.disease);
    const code=normalizeCode(obj.scope,obj.region_code);if(obj.scope==='world'&&!/^[A-Z]{3}$/.test(code))throw Error('세계 region_code는 ISO 3166-1 alpha-3 3자리여야 합니다.');if(obj.scope==='korea'&&code!=='JG'&&!PROVINCES.some(p=>p[0]===code))throw Error('알 수 없는 국내 시·도 코드: '+code);
    if(!obj.cases)throw Error('cases는 빈칸일 수 없습니다.');const cases=Number(obj.cases),deaths=obj.deaths===''||obj.deaths===undefined?null:Number(obj.deaths);if(!Number.isSafeInteger(cases)||cases<0)throw Error('cases는 0 이상 정수여야 합니다.');if(deaths!==null&&(!Number.isSafeInteger(deaths)||deaths<0))throw Error('deaths는 빈칸 또는 0 이상 정수여야 합니다.');
    const annual=obj.metric_type==='annual_reported';
    if(annual){if(obj.scope!=='korea'||obj.as_of||!/^20\d{2}$/.test(obj.period))throw Error('연도별 국내 자료는 as_of를 비우고 period에 YYYY를 입력하세요.');}
    else if(!/^\d{4}-\d{2}-\d{2}$/.test(obj.as_of)||Number.isNaN(Date.parse(obj.as_of))||new Date(obj.as_of).toISOString().slice(0,10)!==obj.as_of)throw Error('as_of는 올바른 YYYY-MM-DD 날짜여야 합니다.');
    const province=PROVINCES.find(p=>p[0]===code);imported.push({scope:obj.scope,disease:obj.disease,code,name:code==='JG'?'전남광주':province?.[1]||obj.region_name||code,asOf:annual?null:obj.as_of,cases,deaths,period:obj.period||'',metric:annual?'reported_cases':undefined,sourceUrl:safeUrl(obj.source_url||''),statusLabel:obj.metric_type==='sentinel'?'표본감시':annual?'사용자 제공 연도별 신고':'사용자 제공 신고자료'});
  }if(imported.length>20000)throw Error('한 번에 최대 20,000행까지만 가져올 수 있습니다.');
  const kinds=new Map();for(const r of [...state.imported,...imported]){const key=r.scope+':'+r.disease,kind=r.asOf?'dated':'annual';if(kinds.has(key)&&kinds.get(key)!==kind)throw Error('같은 질병의 연도별 자료와 날짜별 자료를 섞을 수 없습니다. 기존 사용자 자료를 지운 뒤 가져오세요.');kinds.set(key,kind);}
  const latest=new Map(state.imported.map(r=>[`${r.scope}:${r.disease}:${r.code}:${r.asOf}:${r.period}`,r]));for(const r of imported)latest.set(`${r.scope}:${r.disease}:${r.code}:${r.asOf}:${r.period}`,r);state.imported=[...latest.values()];saveLocalImports();setScope(imported[0].scope);switchDisease(imported[0].disease);toast(nf(imported.length)+'개 데이터 행을 가져왔습니다. (이 브라우저에만 저장)');return imported.length;
}
const CSV_TEMPLATE='scope,disease,region_code,region_name,as_of,cases,deaths,period,metric_type,source_url\n';
function downloadFile(content,fileName,type='text/plain;charset=utf-8'){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function downloadCsv(){const ds=activeData(),rows=ds.records||[];if(!rows.length){toast('내보낼 수 있는 지역별 수치가 아직 없습니다.');return}
  const lines=[CSV_TEMPLATE.trim()];for(const r of rows){const cells=[state.scope,state.disease,r.code,r.name,r.asOf||'',r.cases,r.deaths??'',r.period||'',!r.asOf&&r.period?'annual_reported':r.statusLabel==='표본감시'?'sentinel':'reported',r.sourceUrl||ds.sourceUrl||''];lines.push(cells.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(','))}
  downloadFile('\uFEFF'+lines.join('\r\n'),`세균맨 레이더-${state.scope}-${state.disease}.csv`,'text/csv;charset=utf-8');toast('CSV 다운로드를 시작했습니다.')
}
function openModal(type){const modal=$('modalBackdrop'),content=$('modalContent');modal.classList.remove('hidden');$('modalTitle').textContent=type==='import'?'CSV 데이터 가져오기':'공식 데이터와 주의사항';
  if(type==='import'){
    content.innerHTML=`<div class="modal-content"><p>국가별·시도별 <b>실제 자료</b> CSV를 선택하면 지도에 적용됩니다. 가져온 데이터는 이 브라우저에만 저장되며 서버로 업로드하지 않습니다.</p><p>필수 열: <code>scope</code>, <code>disease</code>, <code>region_code</code>, <code>region_name</code>, <code>as_of</code>, <code>cases</code></p><p>선택 열: <code>deaths</code>, <code>period</code>, <code>metric_type</code>, <code>source_url</code>. 국내 지역 코드는 11(서울), 26(부산), 41(경기) 등 시·도 2자리, 세계는 ISO3를 사용합니다.</p><button id="downloadTemplate" class="btn-ghost">↓ 빈 CSV 양식 다운로드</button><label for="csvInput">CSV 파일 선택 (UTF-8)</label><input id="csvInput" type="file" accept=".csv,text/csv"/><p id="importMessage" class="import-msg"></p><button id="clearImport" class="btn-ghost">이 브라우저의 가져온 자료 전체 삭제</button><p style="font-size:10px">* 공공데이터포털 API 인증키를 브라우저에 입력하거나 CSV에 포함하지 마세요.</p></div>`;
    $('downloadTemplate').onclick=()=>downloadFile('\uFEFF'+CSV_TEMPLATE,'세균맨 레이더-가져오기-양식.csv','text/csv;charset=utf-8');
    $('csvInput').onchange=async(e)=>{try{const f=e.target.files[0];if(!f)return;if(f.size>3*1024*1024)throw Error('3 MB 이하 CSV 파일만 지원합니다.');const count=importCSV(await f.text());$('importMessage').textContent=`${nf(count)}행 가져오기 완료. 지도에 반영했습니다.`}catch(err){$('importMessage').textContent='오류: '+err.message;toast('CSV 형식 확인이 필요합니다.')}};
    $('clearImport').onclick=()=>{state.imported=[];saveLocalImports();renderAll();$('importMessage').textContent='가져온 데이터가 삭제되었습니다.'};
  }else{content.innerHTML=`<div class="modal-content"><p><b>에볼라:</b> WHO <a target="_blank" rel="noopener noreferrer" href="https://www.who.int/emergencies/alert-and-response">Alert and response</a>에서 제공하는 2026년 분디부교 바이러스병의 국가별 누적 확진·사망 자료를 사용합니다. 국가별 자료 기준일이 다릅니다.</p><p><b>국내:</b> <a target="_blank" rel="noopener noreferrer" href="${SOURCES.korea}">질병관리청 전수신고 감염병 발생현황 API</a>는 인증키 발급과 실제 응답 스키마 확인이 필요하므로 초기 버전에서는 지역별 환자 수를 임의로 채우지 않습니다.</p><p><b>데이터 갱신:</b> 함께 제공하는 GitHub Actions를 켜면 WHO의 HTML 표를 일 단위로 검증해 스냅샷을 갱신하도록 설계했습니다. 현재 사이트가 배포되기 전까지는 수록된 스냅샷만 보입니다.</p><p><b>지도 경계:</b> 세계는 Natural Earth, 국내 17개 시·도 경계는 국가공간정보포털을 가공한 <a target="_blank" rel="noopener noreferrer" href="https://github.com/KnellBalm/kr-admin-geojson">공개 GeoJSON</a>을 참조합니다.</p><p><b>주의:</b> 보고 건수는 실제 감염 지역, 현재 치료 중인 환자 수, 전국/세계 전체 추정 감염자 수를 의미하지 않습니다. 표본감시 데이터는 전수신고와 별도로 해석해야 합니다.</p></div>`}
  $('closeModal').focus();
}
function closeModal(){$('modalBackdrop').classList.add('hidden')}

async function loadJson(url){const response=await fetch(url+'?v='+Date.now(),{cache:'no-store'});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.json()}
async function loadStaticData(){let errors=[];await Promise.all([
  loadJson('./data/ebola.json').then(data=>{state.data.ebola=data}).catch(e=>errors.push('WHO 스냅샷: '+e.message)),
  loadJson('./data/alerts.json').then(data=>{state.data.alerts=data}).catch(e=>errors.push('WHO 경보: '+e.message)),
  loadJson('./data/korea.json').then(data=>{state.data.korea=data}).catch(e=>errors.push('국내 자료: '+e.message)),
  loadJson('./data/world.json').then(data=>{state.data.world=data}).catch(e=>errors.push('세계 추가자료: '+e.message)),
  loadJson('./assets/world.geojson').then(data=>{state.geo.world=data}).catch(e=>errors.push('세계지도: '+e.message)),
  loadJson('https://raw.githubusercontent.com/KnellBalm/kr-admin-geojson/main/ctprvn.geojson').then(data=>{
    if(data?.features?.length>=17&&data.features.some(f=>f.properties?.CTPRVN_CD))state.geo.korea=data;
    else throw Error('예상 행정경계 필드 없음');
  }).catch(async()=>{try{state.geo.korea=await loadJson('./assets/korea-outline.geojson')}catch(e){errors.push('국내 지도: '+e.message)}})
]);state.lastLoadError=errors.join(' / ');renderNews();if(errors.length)toast('일부 외부 지도가 로드되지 않아 대체 지도 또는 로컬 자료로 표시합니다.');renderAll();}

function init(){const now=new Date();$('todayText').textContent=now.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'});document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setScope(b.dataset.scope)));
  $('scopeSelect').addEventListener('change',e=>setScope(e.target.value));$('diseaseSelect').addEventListener('change',e=>switchDisease(e.target.value));$('periodSelect').addEventListener('change',e=>{state.period=e.target.value;renderAll()});
  $('openImport').addEventListener('click',()=>openModal('import'));$('mobileImport').addEventListener('click',()=>openModal('import'));$('openSources').addEventListener('click',()=>openModal('sources'));$('closeModal').addEventListener('click',closeModal);$('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  $('downloadCsvButton').addEventListener('click',downloadCsv);$('refreshButton').addEventListener('click',async()=>{await loadStaticData();toast(state.lastLoadError|| (ATLAS_OFFLINE?'포함된 자료를 다시 읽었습니다.':'최신 배포 자료를 확인했습니다. 공식기관 수집은 서버 일정에 따릅니다.'))});
  $('zoomIn').addEventListener('click',()=>{state.zoom=Math.min(5,state.zoom*1.6);updateViewBox();renderMap(activeData().records||[])});$('zoomOut').addEventListener('click',()=>{state.zoom=Math.max(1,state.zoom/1.6);updateViewBox();renderMap(activeData().records||[])});$('zoomReset').addEventListener('click',()=>{state.zoom=1;state.mapCenter=state.scope==='world'?[500,250]:[500,300];updateViewBox()});
  refreshDiseaseOptions();renderAll();loadStaticData();
}

/* Original MVP data, CSV workflow and selectors are retained. This layer owns the redesigned maps. */
const baseRenderAll=renderAll;
renderAll=function(){
  baseRenderAll();
  const ds=activeData(),rows=ds.records||[],world=state.scope==='world',official=world&&state.disease==='ebola'&&!ds.imported,has=rows.length>0;
  $('pageTitle').textContent='세계와 우리 동네, 한눈에.';
  $('pageSubtitle').textContent='감염병 보고 현황을 살피고, 출처와 기준일을 함께 확인해요.';
  $('mapTitle').textContent=world?'세계 감염병 지도':'우리나라 감염병 지도';
  $('mapDescription').textContent=diseaseName(state.scope,state.disease)+' · '+(has?(ds.imported?'사용자가 가져온 자료':'WHO 누적 확진 보고'):'지역별 공식 수치 미연동');
  $('mapBadge').textContent=has?(ds.imported?'사용자 CSV':'WHO 스냅샷'):'미연동';
  $('metricCasesNote').textContent=has?(official?'2026년 유행 · 보고값 합계':'선택 자료의 보고값 합계'):'0명이 아닌 미연동';
  $('metricDeathsNote').textContent=has?(rows.some(r=>r.deaths==null)?'미보고 제외 · 부분 합계':'자료에 보고된 사망 합계'):'공식 자료 미연동';
  $('metricRegionsNote').textContent=has?'과거 보고·종료 사례 포함':'0건과 미수집은 달라요';
  $('metricDateNote').textContent=has?'국가·지역별 기준일은 다름':'기준일도 아직 없어요';
  $('casesLabel').textContent=official?'누적 확진':'신고·감시 수치';
  $('deathsLabel').textContent=official?'보고된 확진자 사망':'보고된 사망';
  $('mapCanvas').classList.toggle('korea-canvas',!world);
  document.querySelectorAll('.ocean').forEach(e=>e.classList.toggle('hidden',!world));
  document.querySelectorAll('[data-scope]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.scope===state.scope)));
  renderStories();renderCompanion();renderMobileRegions();renderSelectionBar();hideTooltip();
};

caseClass=function(count){return count==null?'':count>=100?'cases-high':count>=10?'cases-mid':count>0?'cases-few':'cases-zero'};
const WORLD_LABELS={FRA:[300,55],NGA:[315,184],COD:[368,352],UGA:[655,180],KEN:[695,315]};
const KOREA_LABELS={'11':[90,70],'28':[90,145],'41':[90,220],'44':[90,295],'30':[90,370],'45':[90,445],'29':[90,520],'46':[90,595],'50':[260,770],'42':[700,70],'43':[710,150],'36':[700,230],'47':[710,310],'27':[710,390],'31':[730,470],'26':[695,550],'48':[695,625]};
// Preserve coastline aspect ratio at Korean latitudes; include Jeju and eastern islands.
const koreaProject=([lon,lat])=>[175+(lon-125.0)*105,50+(38.75-lat)*132];
const provinceCode=f=>({51:'42',52:'45'}[String(f.properties.CTPRVN_CD||f.properties.code)]||String(f.properties.CTPRVN_CD||f.properties.code||''));
const originalNormalizeCode=normalizeCode;
normalizeCode=function(scope,code){const normalized=originalNormalizeCode(scope,code);return scope==='korea'?({51:'42',52:'45'}[normalized]||normalized):normalized;};
attachMapEvents=function(node,code,name,rows){node.dataset.code=code;node.addEventListener('pointermove',event=>showTooltip(event,code,name,rows));node.addEventListener('pointerleave',hideTooltip);node.addEventListener('focus',event=>showTooltip(event,code,name,rows));node.addEventListener('blur',hideTooltip);const select=()=>{state.selected=code;renderRegionList(rows);renderSelected(rows);highlightMap()};node.addEventListener('click',select);node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select()}});};
const provinceName=f=>f.properties.CTP_KOR_NM||f.properties.name||'대한민국';
renderMap=function(rows){
  const world=state.scope==='world',geo=state.geo[world?'world':'korea'];$('mapPaths').replaceChildren();$('mapMarkers').replaceChildren();
  $('mapSvg').setAttribute('aria-label',world?'국가별 보고 수치와 기준일 지도':'대한민국 17개 시·도별 신고 수치 지도');
  $('mapLoading').classList.toggle('hidden',!!geo);if(!geo)return;
  const project=world?projWorld:koreaProject,byCode=new Map(rows.map(r=>[r.code,r]));
  for(const f of geo.features){const code=world?f.properties.iso3:provinceCode(f),name=world?f.properties.name:provinceName(f),r=byCode.get(code);if(code==='ATA')continue;
    const p=svg('path',{d:geometryPath(f.geometry,project),class:'map-country '+(!world?'korea-outline ':'')+caseClass(r?.cases),role:'button',tabindex:0,'aria-label':`${r?.name||name}: ${r?nf(r.cases)+rowUnit(r)+', '+rowDate(r):'자료 미연동, 0명 아님'}`});
    attachMapEvents(p,code,name,rows);$('mapPaths').append(p);
  }
  if(world){for(const r of rows){const feature=geo.features.find(f=>f.properties.iso3===r.code);const center=KNOWN_CENTERS[r.code]||(feature?countryCenter(feature):null);if(!center)continue;const [x,y]=project(center),pos=WORLD_LABELS[r.code]||[Math.min(820,x+18),Math.max(10,y-70)];addCallout(x,y,pos[0],pos[1],r.code,r.name,r,rows,world);}}
  else for(const [code,name,lon,lat] of PROVINCES){const [x,y]=project([lon,lat]);const pos=KOREA_LABELS[code];addCallout(x,y,pos[0],pos[1],code,name,byCode.get(code),rows,false);}
  updateViewBox();highlightMap();
};
// The tip remains at the geographic coordinate; only the pin artwork is offset.
function addAtlasPin(parent,x,y,missing=false){
  const pin=svg('g',{transform:`translate(${x} ${y})`,class:'atlas-pin'+(missing?' is-missing':''),'aria-hidden':'true'});
  pin.append(svg('circle',{cx:0,cy:-13,r:16,class:'pin-hit-target'}));
  pin.append(svg('ellipse',{cx:0,cy:2,rx:9,ry:3,class:'pin-shadow'}));
  const art=svg('g',{class:'pin-art'});
  art.append(svg('path',{d:'M0 0C-3-5-11-10-11-18a11 11 0 0 1 22 0C11-10 3-5 0 0Z',class:'pin-body'}));
  art.append(svg('circle',{cx:0,cy:-18,r:4,class:'pin-center'}));
  pin.append(art);parent.append(pin);
}
function addCallout(x,y,bx,by,code,name,r,rows,world){
  const g=svg('g',{'data-code':code,class:'map-label-group',role:'button',tabindex:0,'aria-label':`${name}: ${r?nf(r.cases)+rowUnit(r)+', '+rowDate(r):'자료 미연동, 0명 아님'}`});
  const w=world?180:168,h=world?76:58,edge=bx>x?bx:bx+w;
  g.classList.toggle('is-missing',!r);
  g.append(svg('path',{d:`M${x} ${y} Q${x} ${by+h/2} ${edge} ${by+h/2}`,class:'leader-line'}));
  g.append(svg('circle',{cx:x,cy:y,r:r?15:11,class:'marker-halo'}));
  addAtlasPin(g,x,y,!r);
  g.append(svg('rect',{x:bx,y:by,width:w,height:h,rx:16,class:'map-label-box'}));
  g.append(svg('circle',{cx:bx+14,cy:by+20,r:3.5,class:'label-status-dot'}));
  g.append(svg('text',{x:bx+25,y:by+25,class:'map-label-name'},name));
  g.append(svg('text',{x:bx+13,y:by+(world?49:46),class:'map-label-number'},r?nf(r.cases)+rowUnit(r):'— 미연동'));
  if(world)g.append(svg('text',{x:bx+13,y:by+66,class:'map-label-date'},r?rowDate(r)+' 기준':'기준일 없음'));
  else if(r)g.append(svg('text',{x:bx+w-10,y:by+46,'text-anchor':'end',class:'map-label-date'},(r.asOf?r.asOf.slice(5).replace('-','.'):r.period+'년')));
  attachMapEvents(g,code,name,rows);$('mapMarkers').append(g);
}
updateViewBox=function(){const world=state.scope==='world',[W,H]=world?[1000,500]:[1000,850],zx=W/state.zoom,zy=H/state.zoom,cx=state.zoom===1?W/2:state.mapCenter[0],cy=state.zoom===1?H/2:state.mapCenter[1];const x=Math.max(0,Math.min(W-zx,cx-zx/2)),y=Math.max(0,Math.min(H-zy,cy-zy/2));$('mapSvg').setAttribute('viewBox',`${x} ${y} ${zx} ${zy}`)};
const originalHighlight=highlightMap;
highlightMap=function(){originalHighlight();document.querySelectorAll('.map-label-group').forEach(e=>{e.classList.toggle('is-selected',e.dataset.code===state.selected);e.setAttribute('aria-pressed',String(e.dataset.code===state.selected))});document.querySelectorAll('.map-country').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.code===state.selected)));renderSelectionBar();};
function renderSelectionBar(){const ds=activeData(),r=regionByCode(state.selected,ds.records||[]);$('mapSelection').innerHTML=r?`<span class="selection-dot"></span><strong>${esc(r.name)}</strong><span>보고 <b>${nf(r.cases)}${rowUnit(r)}</b></span><span>· 사망 ${r.deaths==null?'미보고':nf(r.deaths)+'명'}</span><span>· ${rowDate(r)} 기준</span>`:`<span class="selection-dot"></span><strong>${esc(selectedName())}</strong><span>지역별 수치 미연동 · 0명을 뜻하지 않아요</span>`;}
function selectedName(){if(state.scope==='korea')return PROVINCES.find(p=>p[0]===state.selected)?.[1]||'선택한 지역';return state.geo.world?.features.find(f=>f.properties.iso3===state.selected)?.properties.name||'선택한 지역'}
function renderMobileRegions(){const rows=activeData().records||[];$('mobileRegions').replaceChildren();for(const r of rows){const b=document.createElement('button');b.className='mobile-region';b.innerHTML=`<span>${esc(r.name)}</span><b>${nf(r.cases)}${rowUnit(r)}</b><small>${rowDate(r)} 기준</small>`;b.addEventListener('click',()=>{state.selected=r.code;renderSelected(rows);renderRegionList(rows);highlightMap()});$('mobileRegions').append(b);}}
const baseSelected=renderSelected;
renderSelected=function(rows){baseSelected(rows);if(!regionByCode(state.selected,rows)){$('selectedRegion').innerHTML=`<strong>${esc(selectedName())}</strong><p>아직 연결된 수치가 없어요.<br>자료 없음은 0명과 다릅니다.</p>`;}else if(activeData().imported){$('selectedRegion').innerHTML=$('selectedRegion').innerHTML.replace('누적 확진','신고·감시 수치');$('detailBottom').textContent='사용자 제공 자료 · 신고자료와 표본감시의 집계 기준은 다를 수 있습니다.';}renderSelectionBar();};
showTooltip=function(event,code,name,rows){const r=regionByCode(code,rows),tip=$('mapTooltip'),canvas=$('mapCanvas');tip.innerHTML=`<strong>${esc(r?.name||name)}</strong><br>${r?`보고 <b>${nf(r.cases)}${rowUnit(r)}</b> · 사망 ${r.deaths==null?'미보고':nf(r.deaths)+'명'}<br><small>${rowDate(r)} 기준<br>${esc(r.statusLabel||'사용자 제공 수치')}</small>`:'<small>지역별 자료 미연동<br>0명이 아닙니다 · 기준일 없음</small>'}`;tip.classList.remove('hidden');const rect=canvas.getBoundingClientRect(),nodeRect=event.currentTarget?.getBoundingClientRect();const x=event.clientX>0?event.clientX:nodeRect?.x||rect.x+10,y=event.clientY>0?event.clientY:nodeRect?.y||rect.y+10;tip.style.left=(canvas.scrollLeft+Math.max(4,Math.min(x-rect.left+12,canvas.clientWidth-tip.offsetWidth-8)))+'px';tip.style.top=Math.max(4,Math.min(y-rect.top-30,canvas.clientHeight-tip.offsetHeight-8))+'px';};

function renderStories(){const list=state.scope==='world'?WORLD:KOREA,icons=['✳','◌','✿','✧','≈','❋','○','✺','◈','✤','✽'];$('diseaseStories').replaceChildren();for(let i=0;i<list.length;i++){const d=list[i],official=state.scope==='world'&&d.id==='ebola',custom=state.imported.some(r=>r.scope===state.scope&&r.disease===d.id),button=document.createElement('button');button.className='story'+(state.disease===d.id?' active':'');button.setAttribute('aria-pressed',String(state.disease===d.id));button.innerHTML=`<span class="story-circle" aria-hidden="true">${icons[i]}</span><span class="story-name">${esc(d.label.replace(/\s*\(.*?\)/g,''))}</span><span class="story-status">${custom?'사용자 CSV':official?'WHO 수록':'자료 미연동'}</span>`;button.addEventListener('click',()=>switchDisease(d.id));$('diseaseStories').append(button);}}
function companionData(){const other=state.scope==='world'?'korea':'world',disease=other==='world'?'ebola':'chickenpox',custom=recordsWithLatest(state.imported.filter(r=>r.scope===other&&r.disease===disease)),records=custom.length?custom:(other==='world'?state.data.ebola?.records:state.data.korea?.records?.filter(r=>r.disease===disease))||[];return{other,disease,records,custom:!!custom.length};}
function renderCompanion(){
 const {other,disease,records,custom}=companionData(),kr=other==='korea',geo=state.geo[other];$('companionMap').replaceChildren();
 $('companionTitle').textContent=kr?'우리나라 지도':'세계 감염병 지도';$('companionSubtitle').textContent=kr?'17개 시·도 · 수두':'에볼라 · WHO 누적 확진';$('companionBadge').textContent=records.length?(custom?'사용자 CSV':'WHO 수록'):'미연동';
 $('companionSummary').innerHTML=records.length?`<strong>${nf(records.reduce((s,r)=>s+r.cases,0))}명 <span style="display:inline">보고 합계</span></strong><span>최근 기준 ${readableDate(records.reduce((d,r)=>r.asOf>d?r.asOf:d,''))}</span>`:'<strong>아직 연결 전이에요</strong><span>지역별 수치를 준비하고 있어요.</span>';
 $('companionNote').innerHTML=records.length?'국가·지역마다 자료 기준일이 달라요.<br>지도를 누르면 상세 수치로 이동해요.':'미연동은 0명이 아니에요.<br>공식 수치가 연결되면 이곳에 표시해요.';
 $('openCompanion').innerHTML=(kr?'우리나라':'세계 지도')+' 자세히 보기 <span>↗</span>';$('openCompanion').onclick=()=>setScope(other);
 $('companionMap').setAttribute('viewBox',kr?'160 0 690 850':'0 0 1000 550');$('companionMap').setAttribute('aria-label',kr?'국내 17개 시도 지도 · 수두 미연동':'세계 에볼라 지도');
 $('miniTooltip').textContent=kr?'지역을 선택해 보세요':'국가를 선택해 보세요';if(!geo)return;
 const byCode=new Map(records.map(r=>[r.code,r])),project=kr?koreaProject:projWorld;
 for(const f of geo.features){const code=kr?provinceCode(f):f.properties.iso3,name=kr?provinceName(f):f.properties.name,r=byCode.get(code);if(code==='ATA')continue;
 const p=svg('path',{d:geometryPath(f.geometry,project),class:kr?'mini-province '+caseClass(r?.cases):'mini-country'+(r?' has-cases':''),tabindex:0,role:'button','aria-label':`${name}: ${r?nf(r.cases)+rowUnit(r):'자료 미연동'}`});
 const hover=()=>{$('miniTooltip').textContent=`${r?.name||name} · ${r?nf(r.cases)+rowUnit(r)+' · '+rowDate(r):'미연동'}`};p.addEventListener('pointerenter',hover);p.addEventListener('focus',hover);p.addEventListener('click',()=>{setScope(other);state.selected=code;renderSelected(activeData().records||[]);renderRegionList(activeData().records||[]);highlightMap()});p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();p.dispatchEvent(new MouseEvent('click'))}});$('companionMap').append(p);
 }
 if(kr){for(const code of ['11','42','44','47','46','26','50']){const [c,name,lon,lat]=PROVINCES.find(p=>p[0]===code),[x,y]=project([lon,lat]);addAtlasPin($('companionMap'),x,y,!byCode.has(c));$('companionMap').append(svg('text',{x:x+17,y:y+5,class:'mini-label'},name));}}
 else for(const r of records){const c=KNOWN_CENTERS[r.code];if(c){const[x,y]=project(c);addAtlasPin($('companionMap'),x,y);}}
}

const baseOpenModal=openModal;let modalReturnFocus=null;
openModal=function(type){modalReturnFocus=document.activeElement;baseOpenModal(type);if(type==='sources'){$('modalContent').innerHTML=`<div class="modal-content"><p><b>WHO 에볼라 수치</b><br>원본 HTML의 2026.10.21 확인 스냅샷을 그대로 보존했습니다. <a href="https://www.who.int/emergencies/alert-and-response" target="_blank" rel="noopener noreferrer">WHO Alert and response</a>의 국가별 표와 대조했습니다. 국가별 기준일은 2026.07.06~2026.10.20이며 누적 확진자 9,583명, 보고된 확진자 사망 4,605명입니다. 나이지리아 사망 수치는 미보고입니다.</p><p><b>다른 감염병·국내 자료</b><br>지역별 수치를 미연동 상태로 유지합니다. 회색 지역은 0명이 아닙니다. CSV를 가져오면 사용자 자료로 명시합니다.</p><p><b>갱신 방식</b><br>단일 HTML은 포함된 스냅샷을 다시 읽습니다. 원천기관 자동 갱신 기능은 이 패키지에 연결되어 있지 않습니다. 데이터 확인일은 환자 수의 기준일과 다릅니다.</p><p><b>지도 경계</b><br>세계는 원본의 Natural Earth 177개 지형(남극 제외 표시), 국내는 <a href="https://github.com/KnellBalm/kr-admin-geojson" target="_blank" rel="noopener noreferrer">2023년 17개 시·도 경계</a>를 포함했습니다. 세부 도서와 경계는 표시 해상도에 따라 생략될 수 있습니다.</p><p>CSV는 이 브라우저에만 저장됩니다. 미보고 사망자는 0으로 간주하지 않으며 누적 보고와 현재 감염 규모는 다릅니다.</p></div>`;}
};
closeModal=function(){$('modalBackdrop').classList.add('hidden');modalReturnFocus?.focus();};
document.addEventListener('keydown',e=>{if(e.key!=='Tab'||$('modalBackdrop').classList.contains('hidden'))return;const els=[...$('modalBackdrop').querySelectorAll('button,a[href],input,select')].filter(e=>!e.disabled);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});

loadJson=async function(url){const path=url.replace(/^\.\//,'').split('?')[0];if(Object.prototype.hasOwnProperty.call(STATIC_DATA,path))return structuredClone(STATIC_DATA[path]);throw Error('포함되지 않은 자료: '+path)};
loadStaticData=async function(){state.data={ebola:await loadJson('data/ebola.json'),world:await loadJson('data/world.json'),korea:await loadJson('data/korea.json'),alerts:await loadJson('data/alerts.json')};state.geo={world:await loadJson('assets/world.geojson'),korea:await loadJson('assets/korea.geojson')};state.lastLoadError='';renderNews();renderAll();};

// Pan uses viewBox coordinates, with pointer capture and click suppression after a drag.
let panStart=null,panMoved=false;
$('mapSvg').addEventListener('pointerdown',e=>{if(state.zoom<=1||e.pointerType==='touch')return;const v=$('mapSvg').viewBox.baseVal;panStart={x:e.clientX,y:e.clientY,cx:v.x+v.width/2,cy:v.y+v.height/2,w:v.width,h:v.height};panMoved=false;});
$('mapSvg').addEventListener('pointermove',e=>{if(!panStart)return;const rect=$('mapSvg').getBoundingClientRect(),dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;if(Math.abs(dx)+Math.abs(dy)<5)return;panMoved=true;$('mapSvg').setPointerCapture(e.pointerId);state.mapCenter=[panStart.cx-dx/rect.width*panStart.w,panStart.cy-dy/rect.height*panStart.h];hideTooltip();updateViewBox();});
$('mapSvg').addEventListener('pointerup',()=>panStart=null);$('mapSvg').addEventListener('pointercancel',()=>panStart=null);$('mapSvg').addEventListener('click',e=>{if(panMoved){e.stopImmediatePropagation();panMoved=false}},true);

/* The browser reads only public snapshots. Provider keys stay in GitHub Actions. */
function rowUnit(row){return row.metric==='reported_cases'?'건':'명'}
function rowDate(row){return row.asOf?readableDate(row.asOf):row.period?`${row.period}년 집계`:'기준일 미제공'}
function koreaOfficial(ds){return state.scope==='korea'&&!ds.imported&&(ds.records||[]).length>0}
function localTime(iso){if(!iso)return '아직 없음';const date=new Date(iso);return Number.isNaN(date.getTime())?'확인 필요':date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' KST'}
function sourceState(scope=state.scope){return state.data.updateStatus?.sources?.[scope==='world'?'who':'kdca']||{};}
function hasOfficialCollector(){return state.scope==='world'?state.disease==='ebola':['chickenpox','pertussis','measles','malaria','dengue'].includes(state.disease);}
function updateStateLabel(scope=state.scope){const info=sourceState(scope);if(info.state==='needs_key')return '인증키 설정 대기';if(info.state==='error')return '갱신 실패 · 이전 자료';if(!info.lastSuccessAt)return '보관된 스냅샷';if(Date.now()-new Date(info.lastSuccessAt).getTime()>48*60*60*1000)return '최근 갱신 지연';return '공식 자료 갱신됨';}

const previousImportedRecords=importedRecords;
importedRecords=function(){const rows=previousImportedRecords();if(rows.length&&rows.every(r=>!r.asOf&&r.period)){const year=rows.map(r=>r.period).sort().at(-1);return rows.filter(r=>r.period===year);}return rows;};
const previousActiveData=activeData;
activeData=function(){const ds=previousActiveData();if(ds.imported&&ds.records.length&&ds.records.every(r=>!r.asOf&&r.period)){const period=ds.records[0].period;return {...ds,snapshotDate:null,period,periodLabel:period+'년 사용자 신고 발생수'};}if(koreaOfficial(ds))return {...ds,snapshotDate:null,period:state.data.korea.period,periodLabel:state.data.korea.periodLabel};return ds;};

function applyPublicData(data){
  if(!data||!Array.isArray(data.ebola?.records)||!Array.isArray(data.korea?.records)||!data.updateStatus?.sources)throw Error('공개 데이터 구조 오류');
  for(const key of ['ebola','korea'])for(const row of data[key].records){if(!Number.isSafeInteger(row.cases)||row.cases<0||typeof row.code!=='string'||!row.name)throw Error('지역 데이터 형식 오류');}
  state.data={ebola:data.ebola,korea:data.korea,world:data.world||{records:[]},alerts:data.alerts||{items:[]},updateStatus:data.updateStatus};
}
function embeddedPublicData(){return {ebola:STATIC_DATA['data/ebola.json'],korea:STATIC_DATA['data/korea.json'],world:STATIC_DATA['data/world.json'],alerts:STATIC_DATA['data/alerts.json'],updateStatus:STATIC_DATA['data/update-status.json']||{sources:{}}};}
loadStaticData=async function(){
  if(state.isRefreshing)return;state.isRefreshing=true;
  try{
    if(ATLAS_OFFLINE){applyPublicData(embeddedPublicData());state.lastLoadError='';}
    else{
      try{const response=await fetch('./data/live.json?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('배포 데이터 읽기 실패');applyPublicData(await response.json());state.lastLoadError='';}
      catch{if(!state.data.ebola)applyPublicData(embeddedPublicData());state.lastLoadError='최신 배포 자료를 읽지 못해 마지막으로 보관한 자료를 표시합니다.';}
    }
    state.geo={world:STATIC_DATA['assets/world.geojson'],korea:STATIC_DATA['assets/korea.geojson']};renderNews();refreshDiseaseOptions();renderAll();
  }finally{state.isRefreshing=false;}
};

const redesignRender=renderAll;
renderAll=function(){
  redesignRender();const ds=activeData(),has=!!ds.records?.length,domestic=koreaOfficial(ds),info=sourceState(),hasProvider=hasOfficialCollector();
  $('metricCasesUnit').textContent=domestic||ds.periodLabel?'건':'명';
  if(domestic||(ds.imported&&ds.periodLabel)){
    $('mapDescription').textContent=diseaseName(state.scope,state.disease)+' · '+ds.periodLabel;
    $('mapBadge').textContent=ds.imported?'사용자 CSV':'KDCA 공식 자료';$('casesLabel').textContent='연도별 신고 발생';
    $('metricCasesNote').textContent=ds.periodLabel+' · 수록 지역 합계';
    $('metricDate').textContent=ds.period+'년';$('metricDate').closest('.metric').querySelector('.metric-head').textContent='집계 연도';
    $('metricDateNote').textContent='일 단위 기준일은 미제공';
    if(!ds.imported)$('metricDeathsNote').textContent='시·도별 사망은 제공하지 않음';
    $('metricRegionsNote').textContent=`수록 ${ds.records.length}개 지역 · 통합 응답 포함`;
    if(!importedRecords().length){$('periodSelect').innerHTML=`<option value="latest">${esc(ds.periodLabel)}</option>`;$('periodSelect').disabled=true;}
  }else{$('metricDate').closest('.metric').querySelector('.metric-head').textContent='최신 자료 기준일';}
  if(!ds.imported&&hasProvider){$('filterStatusLabel').textContent=updateStateLabel();$('filterStatusDetail').textContent=info.lastSuccessAt?'성공 '+localTime(info.lastSuccessAt):(info.message||'연동 준비 중');$('filterDot').classList.toggle('warning',info.state!=='ok');}
  const chip=document.querySelector('.snapshot-chip');chip.replaceChildren();const dot=document.createElement('span');const label=document.createElement('strong');label.textContent=ds.imported?'사용자 CSV':ATLAS_OFFLINE?'파일에 포함된 자료':(state.lastLoadError?'배포 자료 읽기 실패':hasProvider?updateStateLabel():'미연동 질병');chip.append(dot,label);
  if(ATLAS_OFFLINE){document.querySelector('.source-caption').textContent='이 HTML은 저장된 시점의 오프라인 사본입니다. 자동 갱신 결과는 배포된 사이트에서 확인하세요.';}
  else{document.querySelector('.source-caption').textContent=state.lastLoadError||'공식기관 수집은 GitHub Actions가 수행합니다. 이 화면은 배포된 자료를 5분마다 다시 읽습니다.';}
  $('refreshButton').textContent=ATLAS_OFFLINE?'↻ 포함된 자료 다시 읽기':'↻ 최신 배포 자료 확인';
  $('refreshButton').title=ATLAS_OFFLINE?'포함된 스냅샷을 읽습니다':'GitHub Actions가 배포한 공개 데이터를 다시 읽습니다';
  if(!ds.imported&&hasProvider&&info.message&&(info.state==='error'||info.state==='needs_key')){const warning=document.createElement('li');warning.textContent=info.message;$('qualityNotes').prepend(warning);}
  document.querySelector('.rank-head span:last-child').textContent=domestic||ds.periodLabel?'신고 발생 / 집계 연도':'보고 수치 / 기준일';
  renderRecentReports();
  let boundary=$('boundaryNote');if(!boundary){boundary=document.createElement('div');boundary.id='boundaryNote';boundary.className='boundary-note';$('maps').after(boundary);}
  const combined=domestic&&ds.records.find(r=>r.code==='JG');boundary.classList.toggle('hidden',!combined);
  if(combined)boundary.textContent=`원천의 전남광주 통합 신고 ${nf(combined.cases)}건은 지역 목록에 별도로 표시합니다. 2023년 지도 경계의 광주·전남에 나누어 넣지 않습니다. 지도와 목록은 ${ds.period}년 집계이며 아래 추이는 전국 통계입니다.`;
};

function recentModel(data,disease,mode='daily'){
  const recent=data?.recent,entry=recent?.diseases?.[disease];if(!entry)return null;
  const points=mode==='weekly'?entry.weekly.map(r=>({label:r.label,tick:r.week+'주',cases:r.cases})):entry.daily.map(r=>({label:r.date,tick:r.date.slice(5).replace('-','/'),cases:r.cases}));
  return {recent,entry,points,max:Math.max(1,...points.map(r=>r.cases??0)),weekly:mode==='weekly'};
}
function renderRecentReports(){
  const box=$('recentReports'),ds=activeData();const model=state.scope==='korea'&&!ds.imported?recentModel(state.data.korea,state.disease,state.trendMode):null;
  box.classList.toggle('hidden',!model);if(!model)return;
  const {recent,entry,points,max,weekly}=model,lastWeek=entry.weekly.at(-1),format=n=>n==null?'미보고':nf(n)+'건';
  const info=sourceState('korea'),warning=info.state==='error'||updateStateLabel('korea')==='최근 갱신 지연';
  box.innerHTML=`<div class="recent-heading"><div><div class="eyebrow">THE LATEST REPORTS</div><h2 id="recentTitle">${esc(diseaseName('korea',state.disease))}, 최근 신고 흐름</h2><p>전국 신고 통계 · 지역 선택과 별개 · ${readableDate(recent.endDate)} 23:59 KST 기준</p></div><span class="recent-badge">잠정 통계 · 수정 가능</span></div>
  <div class="recent-stats"><div class="recent-stat"><span>최신 집계일 신고</span><strong>${format(entry.latestDay.cases)}</strong><small>${readableDate(entry.latestDay.date)} 하루</small></div><div class="recent-stat"><span>최근 7일 신고</span><strong>${format(entry.last7Days)}</strong><small>${recent.startDate.slice(5).replace('-','.')}–${recent.endDate.slice(5).replace('-','.')} · 7일 합계</small></div><div class="recent-stat"><span>최근 완료 주차</span><strong>${format(lastWeek.cases)}</strong><small>${esc(lastWeek.label)} · 전국</small></div></div>
  ${warning?'<p class="recent-warning">최근 갱신에 문제가 있어 마지막으로 검증한 자료를 표시합니다. 아래 수집 시각과 기준일을 확인하세요.</p>':''}
  <div class="trend-toolbar"><div class="trend-toggle" aria-label="신고 추이 기간"><button type="button" data-trend="daily" aria-pressed="${!weekly}">최근 7일 · 일별</button><button type="button" data-trend="weekly" aria-pressed="${weekly}">최근 8주 · 주별</button></div><span class="small-note">${weekly?'진행 중인 주차 제외 · 완료 주차도 잠정값':'신고일 기준 · 0건과 미보고 구분'}</span></div>
  <div class="trend-chart" style="--columns:${points.length}" role="img" aria-label="${weekly?'최근 8주':'최근 7일'} 전국 신고 추이. 상세 수치는 아래 표에서 확인할 수 있습니다.">${points.map(p=>`<div class="trend-column" title="${esc(p.label)}: ${format(p.cases)}"><span class="trend-value">${p.cases==null?'—':nf(p.cases)}</span><div class="trend-bar${p.cases==null?' trend-missing':''}" style="height:${p.cases==null?8:Math.max(1,p.cases/max*70)}%"></div><span class="trend-tick">${esc(p.tick)}</span></div>`).join('')}</div>
  <details class="trend-table"><summary>날짜별 수치와 집계 기간 보기</summary><table><caption>${weekly?'완료 주차별 신고':'일별 신고'} · 전국</caption><thead><tr><th scope="col">${weekly?'집계 주차':'신고일'}</th><th scope="col">신고 발생수</th></tr></thead><tbody>${points.map(p=>`<tr><th scope="row">${esc(p.label)}</th><td>${format(p.cases)}</td></tr>`).join('')}</tbody></table></details>
  <p class="recent-foot">일별: <a href="${safeUrl(recent.dailySource)}" target="_blank" rel="noopener noreferrer">질병관리청 공식 대시보드 ↗</a> · 주별: <a href="${safeUrl(recent.weeklySource)}" target="_blank" rel="noopener noreferrer">전수신고 API ↗</a><br>수집 확인 ${localTime(recent.checkedAt)} · 신고 건수는 현재 감염자 수와 다릅니다. 최근 7일과 공식 주차의 시작·종료일은 서로 다릅니다.</p>`;
  box.querySelectorAll('[data-trend]').forEach(b=>b.onclick=()=>{state.trendMode=b.dataset.trend;renderRecentReports();box.querySelector(`[data-trend="${state.trendMode}"]`).focus();});
}

renderSelected=function(rows){const r=regionByCode(state.selected,rows),ds=activeData();if(!r){$('selectedRegion').innerHTML=`<strong>${esc(selectedName())}</strong><p>아직 연결된 수치가 없어요.<br>자료 없음은 0명과 다릅니다.</p>`;$('detailBottom').textContent='미수집 지역을 0명으로 간주하지 않습니다.';}else{
  const label=koreaOfficial(ds)?'신고 발생수':ds.imported?'신고·감시 수치':'누적 확진';
  $('selectedRegion').innerHTML=`<strong>${esc(r.name)}</strong><div class="selected-figures"><span>${label}<br><b>${nf(r.cases)}${rowUnit(r)}</b></span><span>사망<br><b>${r.deaths==null?'미보고':nf(r.deaths)+'명'}</b></span><span>${r.asOf?'자료 기준일':'집계 기간'}<br><b style="font-size:13px">${rowDate(r)}</b></span></div>`;
  $('detailBottom').textContent=koreaOfficial(ds)?'연도 단위 신고 발생수입니다. 수집일을 환자 발생 기준일로 표시하지 않습니다.':ds.imported?'사용자 자료 · 원천 집계 기준을 확인하세요.':'WHO 유행 기간의 누적 확진입니다. 현재 감염자 수가 아닙니다.';
 }renderSelectionBar();};
renderSelectionBar=function(){const r=regionByCode(state.selected,activeData().records||[]);$('mapSelection').innerHTML=r?`<span class="selection-dot"></span><strong>${esc(r.name)}</strong><span>보고 <b>${nf(r.cases)}${rowUnit(r)}</b></span><span>· 사망 ${r.deaths==null?'미보고':nf(r.deaths)+'명'}</span><span>· ${rowDate(r)}</span>`:`<strong>${esc(selectedName())}</strong><span>자료 미연동 · 0명이 아닙니다</span>`;};
renderRegionList=function(rows){const list=$('regionList');list.replaceChildren();if(!rows.length){list.innerHTML='<div class="empty-regions">지역별 수치가 아직 연결되지 않았어요.<br>연결 상태와 출처를 확인해 주세요.</div>';return;}for(const [i,r] of [...rows].sort((a,b)=>b.cases-a.cases).entries()){const b=document.createElement('button');b.className='region-row'+(r.code===state.selected?' active':'');b.innerHTML=`<span class="region-left"><span class="region-rank">${i+1}</span><span><span class="region-name">${esc(r.name)}</span><span class="region-sub">${esc(r.statusLabel||'신고자료')}</span></span></span><span class="region-value"><b>${nf(r.cases)}${rowUnit(r)}</b><small>${rowDate(r)}</small></span>`;b.onclick=()=>{state.selected=r.code;renderRegionList(rows);renderSelected(rows);highlightMap()};list.append(b);}};
showTooltip=function(event,code,name,rows){const r=regionByCode(code,rows),tip=$('mapTooltip'),canvas=$('mapCanvas');tip.innerHTML=`<strong>${esc(r?.name||name)}</strong><br>${r?`보고 <b>${nf(r.cases)}${rowUnit(r)}</b><br><small>${rowDate(r)}<br>사망 ${r.deaths==null?'미보고':nf(r.deaths)+'명'}</small>`:'<small>자료 미연동 · 0명 아님</small>'}`;tip.classList.remove('hidden');const rect=canvas.getBoundingClientRect(),target=event.currentTarget.getBoundingClientRect(),x=event.clientX||target.x,y=event.clientY||target.y;tip.style.left=canvas.scrollLeft+Math.max(4,Math.min(x-rect.left+10,canvas.clientWidth-tip.offsetWidth-8))+'px';tip.style.top=Math.max(4,Math.min(y-rect.top,canvas.clientHeight-tip.offsetHeight-8))+'px';};
renderSource=function(ds){const provider=hasOfficialCollector(),info=provider?sourceState():{},url=safeUrl(ds.sourceUrl),fields=[['통계 제공 기관',ds.source||'미연동'],['집계 기준',ds.periodLabel||(ds.snapshotDate?readableDate(ds.snapshotDate):'미연동')],['데이터 상태',ds.imported?'사용자 CSV':provider?updateStateLabel():'지역별 미연동'],['마지막 성공 확인',ds.imported?'사용자 제공':provider?localTime(info.lastSuccessAt||ds.checkedAt):'해당 없음'],['마지막 수집 시도',ds.imported||!provider?'해당 없음':localTime(info.lastAttemptAt)]];$('sourcePanel').innerHTML=fields.map(([k,v])=>`<div class="source-item"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')+(url==='#'?'':`<div class="source-item"><span>원천 자료</span><strong><a href="${url}" target="_blank" rel="noopener noreferrer">기관 공식 사이트 ↗</a></strong></div>`);};

const renderOldStories=renderStories;
renderStories=function(){renderOldStories();const list=state.scope==='world'?WORLD:KOREA;document.querySelectorAll('#diseaseStories .story').forEach((node,i)=>{const d=list[i],custom=state.imported.some(r=>r.scope===state.scope&&r.disease===d.id),has=state.scope==='korea'?(state.data.korea?.records||[]).some(r=>r.disease===d.id):d.id==='ebola';if(!custom)node.querySelector('.story-status').textContent=has?(state.scope==='korea'?'KDCA 수록':'WHO 수록'):'자료 미연동';});};
const renderOldCompanion=renderCompanion;
renderCompanion=function(){renderOldCompanion();const c=companionData();if(c.other==='korea'&&c.records.length&&!c.custom){$('companionBadge').textContent='KDCA 수록';$('companionSummary').innerHTML=`<strong>${nf(c.records.reduce((s,r)=>s+r.cases,0))}건</strong><span>${esc(state.data.korea.periodLabel)} · ${c.records.length}개 수록 지역</span>`;$('companionNote').textContent='연도별 신고 · 통합 지역은 목록에 표시 · 상세 화면에서 최근 7일·주간 추이 확인';$('companionMap').setAttribute('aria-label','국내 수두 연도별 신고 발생 지도');}else if(!c.records.length){$('companionNote').textContent=c.other==='korea'?updateStateLabel('korea')+' · 미연동은 0명이 아닙니다.':'자료 미연동';}};

const originalLiveModal=openModal;
openModal=function(type){originalLiveModal(type);if(type==='import'){const p=document.createElement('p');p.textContent='연도별 신고 자료: metric_type은 annual_reported, period는 YYYY, as_of는 빈칸으로 지정합니다. 날짜별 자료와 섞지 않습니다.';$('modalContent').append(p);}if(type==='sources')$('modalContent').innerHTML=`<div class="modal-content"><p><b>WHO 에볼라</b><br><a href="https://www.who.int/emergencies/alert-and-response" target="_blank" rel="noopener noreferrer">WHO 공식 표</a>에서 국가별 확진·사망·기준일을 수집하고 총계를 대조합니다. 수집 실패나 표 구조 변경 시 이전 정상 자료를 유지합니다.</p><p><b>국내 감염병</b><br><a href="https://www.data.go.kr/data/15139178/openapi.do" target="_blank" rel="noopener noreferrer">질병관리청 전수신고 API</a>의 연도별 지역 신고 및 주간 전국 통계를 수집합니다. 최근 7일은 <a href="https://dportal.kdca.go.kr/pot/is/dashboardEDW.do" target="_blank" rel="noopener noreferrer">질병관리청 공개 대시보드</a>의 일별 응답을 사용합니다. 포털 화면용 응답은 구조가 바뀔 수 있어 날짜·질병 코드·누락을 검증하고 실패 시 이전 정상 자료를 유지합니다. 전국 합계는 지도 지역에 중복으로 더하지 않습니다. 전남광주 통합 응답은 별도 목록으로 보존하며 지도에 임의 분배하지 않습니다. 지역별 사망·표본감시는 미연동입니다.</p><p><b>자동 갱신</b><br>GitHub Actions 설정이 완료되면 매일 09:23 KST에 수집·검증·배포합니다. 지연될 수 있으며 실제 성공 시각은 출처 카드에 표시합니다. API 키는 Actions Secret에만 저장합니다.</p><p><b>현재 화면</b><br>${ATLAS_OFFLINE?'저장된 HTML 사본입니다. 이후 자동 갱신은 배포 사이트에서 확인하세요.':'배포된 공개 JSON을 5분마다 읽습니다. 새로고침 버튼이 WHO·질병관리청에 직접 요청하는 것은 아닙니다.'}</p><p><b>지도</b><br>Natural Earth 및 국내 2023 시·도 경계를 사용합니다. 연도별 신고, 누적 확진, 표본감시는 서로 다른 지표입니다.</p></div>`;};

init();
if(!ATLAS_OFFLINE)setInterval(()=>{if(!document.hidden)loadStaticData()},5*60*1000);
