(() => {
    'use strict';
    const $ = (q, root = document) => root.querySelector(q);
    const KEY = 'kagoshima-trip-v1';
    const SESSION_REV = 'kagoshima-cloud-base';
    const clone = value => JSON.parse(JSON.stringify(value));
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const safeURL = value => {
        try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
    };
    const gmaps = (query, nav = false, mode = 'driving') => 'https://www.google.com/maps/' + (nav ? 'dir/?api=1&destination=' + encodeURIComponent(query) + '&travelmode=' + (mode === 'walking' ? 'walking' : 'driving') : 'search/?api=1&query=' + encodeURIComponent(query));
    let trip = clone(window.TRIP_SEED), selectedDay = 1, selectedStop = '', view = 'route';
    let map, layers, markers = new Map(), geoMarker, cloud = null, cloudUser = null, authSubscription;
    let editId = null, editingFood = [], toastTimer, localBlocked = false, externalChange = false;
    let base = null;
    try { const last = Number(localStorage.getItem('kagoshima-last-day')); if ([1,2,3,4].includes(last)) selectedDay = last; } catch {}
    function toast(message) {
        $('#toast').textContent = message; $('#toast').hidden = false;
        clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5200);
    }
    function validateTrip(value) {
        if (!value || value.version !== 1 || !Array.isArray(value.days) || value.days.length !== 4) throw new Error('이 앱의 4일 일정 백업 파일이 아닙니다.');
        if (!Number.isInteger(value.travelers) || value.travelers < 1 || value.travelers > 20) throw new Error('여행 인원은 1~20명이어야 합니다.');
        if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100) throw new Error('여행 제목을 확인하세요.');
        const ids = new Set();
        value.days.forEach((day, i) => {
            if (day.id !== i + 1 || !Array.isArray(day.stops) || day.stops.length > 100 || typeof day.title !== 'string') throw new Error('날짜 형식이 올바르지 않습니다.');
            day.stops.forEach(stop => {
                if (!stop || typeof stop.id !== 'string' || ids.has(stop.id)) throw new Error('중복되거나 잘못된 장소 ID입니다.');
                ids.add(stop.id);
                for (const k of ['time','title','query','duration','fee','parking','note','source','kind','mode','parkingQuery']) {
                    if (typeof stop[k] !== 'string' || stop[k].length > 12000) throw new Error('장소 데이터 형식을 확인하세요.');
                }
                if (!stop.title.trim() || !stop.query.trim()) throw new Error('장소명과 구글지도 검색어가 필요합니다.');
                if (!Number.isFinite(stop.lat) || stop.lat < -90 || stop.lat > 90 || !Number.isFinite(stop.lng) || stop.lng < -180 || stop.lng > 180) throw new Error('지도 좌표가 올바르지 않습니다.');
                if (!Number.isFinite(stop.amount) || stop.amount < 0 || stop.amount > 10000000 || !['adult','vehicle'].includes(stop.unit)) throw new Error('금액 형식을 확인하세요.');
                if (!Array.isArray(stop.food) || stop.food.length > 30) throw new Error('식당 데이터 형식을 확인하세요.');
                stop.food.forEach(food => { for (const k of ['name','query','menu','budget','kind','hours','parking','source']) if (typeof food[k] !== 'string' || food[k].length > 10000) throw new Error('식당 항목 형식을 확인하세요.'); });
                stop.done = !!stop.done;
            });
        });
        if (typeof value.notes !== 'string' || value.notes.length > 10000) throw new Error('메모를 확인하세요.');
        return value;
    }
    try {
        const stored = localStorage.getItem(KEY);
        if (stored) trip = validateTrip(JSON.parse(stored));
        const rev = localStorage.getItem(SESSION_REV); if (rev) base = JSON.parse(rev);
    } catch (error) {
        localBlocked = true;
        toast('저장된 데이터를 읽지 못했습니다. 기존 데이터는 보존했습니다. 백업 불러오기 또는 초기화로 복구하세요.');
    }
    function saveLocal() {
        if (localBlocked || externalChange) { $('#save-status').textContent = '자동 저장 중지'; toast('기존 저장을 보호하기 위해 저장을 멈췄습니다. 현재 내용을 백업한 뒤 새로고침하거나 백업을 다시 불러오세요.'); return false; }
        try {
            trip.updatedAt = new Date().toISOString();
            localStorage.setItem(KEY, JSON.stringify(trip));
            $('#save-status').textContent = '기기에 저장됨 ✓'; return true;
        } catch { $('#save-status').textContent = '저장 공간 확인'; toast('기기 저장에 실패했습니다. JSON 백업으로 저장해 주세요.'); return false; }
    }
    function day() { return trip.days.find(d => d.id === selectedDay); }
    function stopById(id) { return day().stops.find(s => s.id === id); }
    function sourceLink(url, label = '공식·참고 원문 ↗') { const u = safeURL(url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>` : ''; }
    function navLink(stop) { return `<a class="navlink" href="${esc(gmaps(stop.query, true, stop.mode))}" target="_blank" rel="noopener noreferrer">구글지도 길찾기 ↗</a>`; }
    function render() {
        const d = day();
        $('#trip-title').textContent = trip.title;
        $('#trip-note').textContent = trip.notes;
        $('#travelers').value = trip.travelers;
        $('#days').innerHTML = trip.days.map(x => `<button class="daytab ${x.id === selectedDay ? 'active' : ''}" data-day="${x.id}" aria-current="${x.id === selectedDay ? 'date' : 'false'}"><span class="date">${esc(x.date)}<small>${esc(x.weekday)}</small></span><span class="day-label">DAY 0${x.id}<small>${esc(x.subtitle.split('·')[0])}</small></span></button>`).join('');
        $('#day-subtitle').textContent = `${d.subtitle} · ${d.hotel}`;
        $('#day-title').textContent = d.title;
        $('#day-alert').textContent = `${d.pace} · ${d.warning}`;
        $('#day-alert').classList.toggle('fast', d.id === 3);
        const total = d.stops.reduce((sum, s) => sum + s.amount * (s.unit === 'adult' ? trip.travelers : 1), 0) + (d.stops.some(s => s.id === 'sengan') ? 500 : 0);
        $('.summary small').textContent = `성인 ${trip.travelers}명 기준 · 입장·정액 교통·호텔 주차`;
        $('#day-cost').textContent = '약 ¥' + total.toLocaleString('ko-KR');
        $('#cost-note').textContent = '식비·숙박·렌트·유류·톨비·쇼핑·변동 주차 제외' + (d.id === 3 ? ' / 페리 차3~4m 기준·차4~5m은 왕복 ¥1,300 추가' : '');
        $('#view-route').classList.toggle('active', view === 'route');
        $('#view-food').classList.toggle('active', view === 'food');
        renderList(); renderMap();
    }
    function foodHTML(f, context = '') {
        return `<article class="food-card"><div class="food-kind">${esc(f.kind)}${context ? ' · ' + esc(context) : ''}</div><h3>${esc(f.name)}</h3><p>${esc(f.menu)}</p><p><strong>${esc(f.budget)}</strong></p><small>영업 · ${esc(f.hours)}</small><p><small>주차 · ${esc(f.parking)}</small></p><div class="food-linkrow"><a class="navlink" href="${esc(gmaps(f.query, true))}" target="_blank" rel="noopener noreferrer">식당 길찾기 ↗</a><a href="${esc(gmaps(f.query,true,'walking'))}" target="_blank" rel="noopener noreferrer">도보 ↗</a>${sourceLink(f.source,'정보 원문 ↗')}</div></article>`;
    }
    function renderList() {
        const term = $('#search').value.trim().toLowerCase();
        const stops = day().stops;
        if (view === 'food') {
            const seen = new Set();
            const foods = stops.flatMap(s => s.food.map(f => ({ f, context:s.title })) ).filter(({f}) => {
                if (seen.has(f.query)) return false; seen.add(f.query);
                return !term || JSON.stringify(f).toLowerCase().includes(term);
            });
            $('#stop-list').innerHTML = foods.length ? `<p class="sources">식당은 방문 후보입니다. 예산은 추정·휴무 및 대기시간 확인. 일정의 ‘편집’에서 후보를 수정할 수 있습니다.</p>` + foods.map(({f,context}) => foodHTML(f,context)).join('') : '<div class="empty">검색된 식당이 없습니다. 장소 편집에서 후보를 추가하세요.</div>';
            return;
        }
        const list = stops.filter(s => !term || JSON.stringify(s).toLowerCase().includes(term));
        $('#stop-list').innerHTML = list.length ? list.map(s => {
            const number = stops.indexOf(s) + 1;
            return `<article class="stop ${s.done ? 'completed' : ''} ${s.id === selectedStop ? 'selected' : ''}" id="stop-${esc(s.id)}"><div class="stop-top"><button class="stop-number" data-focus="${esc(s.id)}" aria-label="${number}번 지도 보기">${number}</button><div class="stop-main"><div class="stop-meta"><span class="time">${esc(s.time)}</span><span>· ${esc(s.duration)}</span><span class="tag">${esc(s.kind)}</span></div><h3 class="stop-name">${esc(s.title)}</h3></div><input type="checkbox" class="donecheck" data-done="${esc(s.id)}" ${s.done ? 'checked' : ''} aria-label="${esc(s.title)} 방문 완료"></div><p class="stop-desc">${esc(s.note)}</p><div class="facts"><div class="fact"><span class="key">비용</span><span>${esc(s.fee)}</span></div><div class="fact"><span class="key">주차</span><span>${esc(s.parking)}</span></div></div><div class="stop-actions">${navLink(s)}<button class="detailbtn" data-detail="${esc(s.id)}">자세히${s.food.length ? ' · 맛집 '+s.food.length : ''}</button><button class="editbtn" data-edit="${esc(s.id)}">편집</button></div>${s.food.length ? `<div class="foodhint">추천 · ${s.food.slice(0,3).map(f => esc(f.name)).join(' / ')}${s.food.length > 3 ? ' 외' : ''}</div>` : ''}</article>`;
        }).join('') : '<div class="empty">검색 결과가 없습니다.</div>';
    }
    function initMap() {
        if (!window.L) { $('#map-fallback').hidden = false; $('#map').style.height = '100px'; return; }
        map = L.map('map', { scrollWheelZoom:false }).setView([31.59,130.56], 12);
        let failed = 0;
        L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', { maxZoom:18, minZoom:5, attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル / 国土地理院</a>' }).on('tileerror', () => { if (++failed >= 3) $('#map-fallback').hidden = false; }).on('tileload', () => { $('#map-fallback').hidden = true; }).addTo(map);
        layers = L.layerGroup().addTo(map);
        setTimeout(() => map.invalidateSize(),100);
    }
    function renderMap() {
        if (!map) return;
        layers.clearLayers(); markers.clear();
        const stops = day().stops;
        const coords = stops.map(s => [s.lat,s.lng]);
        if (coords.length > 1) L.polyline(coords, { color:'#8a9d7a', weight:2, dashArray:'5 7',opacity:.8 }).addTo(layers);
        // Repeated locations get small visual offsets so every visit number stays selectable.
        const counts = new Map();
        stops.forEach((s,i) => {
            const key = s.lat+','+s.lng, n = counts.get(key) || 0; counts.set(key,n+1);
            const pos = [s.lat + n*.00035,s.lng + n*.00035];
            const icon = L.divIcon({className:'number-icon',html:`<span class="pin ${s.id === selectedStop ? 'selected' : ''}">${i+1}</span>`,iconSize:[30,30],iconAnchor:[15,15]});
            const marker = L.marker(pos,{icon, title:(i+1)+'. '+s.title,keyboard:true}).addTo(layers);
            marker.bindPopup(`<strong>${i+1}. ${esc(s.title)}</strong><br>${esc(s.time)} · ${esc(s.duration)}<br><a href="${esc(gmaps(s.query,true,s.mode))}" target="_blank" rel="noopener noreferrer">구글지도 길찾기 ↗</a><br><button class="mini" data-detail="${esc(s.id)}">자세히 · 맛집</button>`);
            marker.on('click', () => { selectedStop = s.id; if(view === 'route') { renderList(); document.getElementById('stop-'+s.id)?.scrollIntoView({block:'nearest',behavior:'smooth'}); } });
            markers.set(s.id,marker);
        });
        fitMap();
    }
    function fitMap() {
        if (!map || !day().stops.length) return;
        map.invalidateSize(); map.fitBounds(L.latLngBounds(day().stops.map(s => [s.lat,s.lng])),{padding:[35,35],maxZoom:14});
    }
    function detail(id) {
        const s = stopById(id); if (!s) return;
        selectedStop = id;
        $('#detail-content').innerHTML = `<div class="dialog-head"><div><p class="eyebrow">${esc(s.time)} · ${esc(s.kind)}</p><h2>${esc(s.title)}</h2></div><button class="close" data-close="detail-dialog" aria-label="닫기">×</button></div><div class="detail-body"><p>${esc(s.note)}</p><div class="facts"><div class="fact"><span class="key">체류</span><span>${esc(s.duration)}</span></div><div class="fact"><span class="key">비용</span><span>${esc(s.fee)}</span></div><div class="fact"><span class="key">주차</span><span>${esc(s.parking)}</span></div><div class="fact"><span class="key">검색</span><span>${esc(s.query)}</span></div></div><div class="row">${navLink(s)}${s.parkingQuery ? `<a class="button outline" href="${esc(gmaps(s.parkingQuery,true))}" target="_blank" rel="noopener noreferrer">주차장 길찾기 ↗</a>` : ''}</div><p class="sources">${sourceLink(s.source)} · 2026.10.30 확인 / 비용·운영은 현장 공지 우선</p>${s.food.length ? '<h3 class="food-group-title">이 포인트의 맛집·카페 후보</h3>'+s.food.map(f => foodHTML(f)).join('') : ''}</div><div class="detail-controls"><button class="outline" data-move="-1" data-id="${esc(id)}">↑ 앞으로</button><button class="outline" data-move="1" data-id="${esc(id)}">↓ 뒤로</button><button class="primary" data-edit="${esc(id)}">편집</button><button class="danger" data-delete="${esc(id)}">삭제</button></div>`;
        $('#detail-dialog').showModal(); renderList();
    }
    const field = (label,name,value,type='text') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${['title','query','time'].includes(name) ? 'required' : ''} ${type==='number' ? 'step="any"' : ''}></label>`;
    const area = (label,name,value) => `<label>${label}<textarea name="${name}" rows="3">${esc(value)}</textarea></label>`;
    function renderFoodEditor() {
        $('#food-editor').innerHTML = editingFood.map((f,i) => `<details class="food-edit" open><summary>후보 ${i+1} · ${esc(f.name || '새 식당')}</summary><div class="food-edit-body">${field('식당 이름','f-name-'+i,f.name)}${field('구글지도 검색어·주소','f-query-'+i,f.query)}<div class="fields2">${field('대표 메뉴','f-menu-'+i,f.menu)}${field('예상 예산','f-budget-'+i,f.budget)}</div>${field('선정 이유·스타일','f-kind-'+i,f.kind)}${field('영업시간·휴무','f-hours-'+i,f.hours)}${field('주차 안내','f-parking-'+i,f.parking)}${field('출처 URL','f-source-'+i,f.source,'url')}<button type="button" class="remove-food" data-remove-food="${i}">이 후보 삭제</button></div></details>`).join('');
    }
    function collectFoods() {
        editingFood = editingFood.map((f,i) => Object.fromEntries(Object.keys(f).map(k => [k,$(`[name="f-${k}-${i}"]`)?.value ?? f[k]])));
    }
    function edit(id = null) {
        $('#detail-dialog').close(); editId = id;
        const s = id ? stopById(id) : {time:'시간 미정',title:'',query:'',lat:31.59,lng:130.56,duration:'30분',fee:'무료 또는 현장 확인',amount:0,unit:'adult',parking:'주차 여부·요금 확인',parkingQuery:'',note:'',source:'',food:[],kind:'관광',mode:'driving'};
        editingFood = clone(s.food);
        $('#edit-heading').textContent = id ? '장소 편집' : '새 장소 추가';
        $('#edit-fields').innerHTML = `<div class="fields2">${field('방문 시간','time',s.time)}${field('체류시간','duration',s.duration)}</div>${field('장소 이름','title',s.title)}${field('구글지도 검색어·일본어 주소','query',s.query)}<p class="sources">새 장소는 아래 좌표도 변경해야 지도 핀이 정확해집니다. 구글지도 우클릭·장소 좌표를 참고하세요.</p><div class="fields2">${field('위도','lat',s.lat,'number')}${field('경도','lng',s.lng,'number')}</div><div class="fields2">${field('종류','kind',s.kind)}<label>길찾기 이동수단<select name="mode"><option value="driving" ${s.mode==='driving'?'selected':''}>자동차</option><option value="walking" ${s.mode==='walking'?'selected':''}>도보</option></select></label></div>${field('비용 설명','fee',s.fee)}<div class="fields2">${field('합계에 더할 기본금액(엔)','amount',s.amount,'number')}<label>기본금액 단위<select name="unit"><option value="adult" ${s.unit==='adult'?'selected':''}>1인당 (인원수 곱하기)</option><option value="vehicle" ${s.unit==='vehicle'?'selected':''}>차량·전체 금액 (1회)</option></select></label></div><p class="sources">식비·불확정 비용은 기본금액을 0으로 두세요. 센간엔 주차 ¥500은 해당 장소가 있는 날 별도 합산합니다.</p>${area('주차장 안내','parking',s.parking)}${field('주차장 구글지도 검색어(선택)','parkingQuery',s.parkingQuery)}${area('설명·메모','note',s.note)}${field('공식·참고 URL','source',s.source,'url')}<div class="edit-section"><h3>식당·카페 후보</h3><button type="button" id="add-food" class="outline">＋ 후보 추가</button></div><div id="food-editor"></div>`;
        renderFoodEditor(); $('#edit-dialog').showModal();
    }
    function commit() { saveLocal(); render(); }
    document.addEventListener('click', event => {
        const close = event.target.closest('[data-close]'); if(close) document.getElementById(close.dataset.close).close();
        const tab = event.target.closest('[data-day]'); if(tab) { selectedDay=Number(tab.dataset.day); try { localStorage.setItem('kagoshima-last-day',String(selectedDay)); } catch {} selectedStop=''; $('#search').value=''; render(); }
        const det = event.target.closest('[data-detail]'); if(det) detail(det.dataset.detail);
        const ed = event.target.closest('[data-edit]'); if(ed) edit(ed.dataset.edit);
        const focus = event.target.closest('[data-focus]'); if(focus) { selectedStop=focus.dataset.focus; markers.get(selectedStop)?.openPopup(); if(map) map.panTo(markers.get(selectedStop).getLatLng()); renderList(); }
        const move = event.target.closest('[data-move]'); if(move) {
            const arr=day().stops, i=arr.findIndex(s=>s.id===move.dataset.id), j=i+Number(move.dataset.move);
            if(j<0||j>=arr.length) return toast('더 이동할 수 없습니다.');
            [arr[i],arr[j]]=[arr[j],arr[i]]; $('#detail-dialog').close(); commit(); toast('순서를 바꿨습니다. 방문 시각은 직접 조정하세요.');
        }
        const del = event.target.closest('[data-delete]'); if(del && confirm('이 장소를 일정에서 삭제할까요?')) { day().stops=day().stops.filter(s=>s.id!==del.dataset.delete);$('#detail-dialog').close();commit(); }
        const removeFood = event.target.closest('[data-remove-food]'); if(removeFood) { collectFoods();editingFood.splice(Number(removeFood.dataset.removeFood),1);renderFoodEditor(); }
        if(event.target.closest('#add-food')) { collectFoods();editingFood.push({name:'',query:'',menu:'',budget:'',kind:'',hours:'',parking:'',source:''});renderFoodEditor(); }
    });
    document.addEventListener('change',event=>{
        const id=event.target.dataset.done;if(id) { stopById(id).done=event.target.checked;saveLocal();renderList(); }
    });
    $('#edit-form').addEventListener('submit',event=>{
        event.preventDefault(); collectFoods();
        const form=new FormData(event.target), fields=['time','duration','title','query','kind','mode','fee','unit','parking','parkingQuery','note','source'];
        const s=editId ? clone(stopById(editId)) : {id:crypto.randomUUID(),done:false};
        fields.forEach(k=>s[k]=String(form.get(k)||'').trim());
        ['lat','lng','amount'].forEach(k=>s[k]=Number(form.get(k))); s.food=clone(editingFood);
        const copy=clone(trip), d=copy.days.find(x=>x.id===selectedDay), i=d.stops.findIndex(x=>x.id===editId);
        if(i>=0) d.stops[i]=s; else d.stops.push(s);
        try { validateTrip(copy);trip=copy;selectedStop=s.id;$('#edit-dialog').close();commit();toast('수정 내용을 기기에 저장했습니다.'); } catch(error) { toast(error.message); }
    });
    $('#add-stop').onclick=()=>edit();
    $('#search').oninput=renderList;
    $('#view-route').onclick=()=>{view='route';renderList();$('#view-route').classList.add('active');$('#view-food').classList.remove('active');};
    $('#view-food').onclick=()=>{view='food';renderList();$('#view-food').classList.add('active');$('#view-route').classList.remove('active');};
    $('#fit-map').onclick=fitMap;
    $('#locate').onclick=()=>{
        if(!map||!navigator.geolocation) return toast('이 환경에서는 위치를 사용할 수 없습니다.');
        navigator.geolocation.getCurrentPosition(pos=>{
            if(geoMarker) map.removeLayer(geoMarker);
            geoMarker=L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:7,color:'#267ac2',fillOpacity:.9}).addTo(map).bindPopup('내 위치');
            map.setView(geoMarker.getLatLng(),14);toast('내 위치를 표시했습니다. 구글지도에서는 현재 위치로 길찾기합니다.');
        },()=>toast('위치 접근이 허용되지 않았습니다. 브라우저 권한을 확인하세요.'),{timeout:12000});
    };
    $('#travelers').onchange=event=>{const n=Number(event.target.value);if(!Number.isInteger(n)||n<1||n>20){event.target.value=trip.travelers;return toast('인원은 1~20명입니다.');}trip.travelers=n;commit();};
    $('#trip-note-btn').onclick=()=>{$('#edit-trip-title').value=trip.title;$('#edit-trip-note').value=trip.notes;$('#note-dialog').showModal();};
    $('#note-form').onsubmit=event=>{event.preventDefault();trip.title=$('#edit-trip-title').value.trim();trip.notes=$('#edit-trip-note').value;$('#note-dialog').close();commit();};
    $('#cloud-btn').onclick=()=>{$('#storage-dialog').showModal();updateCloudUI();};
    function exportTrip() {
        const blob=new Blob([JSON.stringify(trip,null,4)],{type:'application/json'}),a=document.createElement('a');
        a.href=URL.createObjectURL(blob);a.download='kagoshima-trip-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    }
    $('#export').onclick=exportTrip;
    $('#import').onchange=async event=>{
        const file=event.target.files[0];if(!file)return;
        try { if(file.size>3000000)throw new Error('백업 파일은 3MB 이하만 가능합니다.');const candidate=validateTrip(JSON.parse(await file.text()));
            if(!confirm('현재 기기 일정을 백업 파일로 교체할까요? 필요하면 먼저 JSON 백업을 내려받으세요.'))return;
            trip=candidate;localBlocked=false;externalChange=false;selectedStop='';commit();toast('백업을 불러왔습니다. 클라우드 저장은 별도로 실행하세요.');
        } catch(error) {toast('불러오기 실패: '+error.message);}finally{event.target.value='';}
    };
    $('#reset').onclick=()=>{if(confirm('기기 일정을 원래 추천안으로 초기화할까요? 수정 내용은 사라집니다.')){trip=clone(window.TRIP_SEED);localBlocked=false;externalChange=false;commit();toast('원래 추천 일정으로 초기화했습니다.');}};
    window.addEventListener('storage',event=>{if(event.key===KEY){externalChange=true;$('#save-status').textContent='다른 탭 변경 감지';toast('다른 탭에서 일정이 바뀌었습니다. 현재 내용은 백업한 뒤 새로고침하세요.');}});
    function configuration() {try{return JSON.parse(localStorage.getItem('kagoshima-supabase-config'))||window.APP_CONFIG||{};}catch{return window.APP_CONFIG||{};}}
    function updateCloudUI() {
        $('#auth-area').hidden=!cloud||!!cloudUser;$('#signed-area').hidden=!cloudUser;
        $('#cloud-status').textContent=cloudUser ? `로그인됨 · ${cloudUser.email || '내 계정'} / 클라우드는 버튼으로 저장·불러옵니다.` : cloud ? 'Supabase 연결됨. 이메일로 로그인하면 내 일정만 저장됩니다.' : '지금은 기기 저장 모드입니다. Supabase 연결 설정 후 클라우드 저장을 사용할 수 있습니다.';
        const cfg=configuration();$('#supabase-url').value=cfg.url||'';$('#supabase-key').value=cfg.key||'';
    }
    async function initCloud() {
        const cfg=configuration();cloudUser=null;
        authSubscription?.unsubscribe();cloud=null;
        if(cfg.url&&cfg.key&&window.supabase){
            try{
                cloud=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
                authSubscription=cloud.auth.onAuthStateChange((_event,session)=>{cloudUser=session?.user||null;updateCloudUI();}).data.subscription;
                const {data,error}=await cloud.auth.getSession();if(error)throw error;cloudUser=data.session?.user||null;
            }catch(error){toast('Supabase 연결 실패: '+error.message);cloud=null;}
        }
        updateCloudUI();
    }
    $('#config-save').onclick=async()=>{
        const url=$('#supabase-url').value.trim().replace(/\/$/,''),key=$('#supabase-key').value.trim();
        try {const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw new Error();}catch{return toast('https://프로젝트.supabase.co 형식의 URL을 입력하세요.');}
        if(!key||key.startsWith('sb_secret_'))return toast('공개 publishable 또는 anon 키만 입력하세요.');
        if(key.startsWith('eyJ')){try{const claims=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(claims.role!=='anon')return toast('anon 역할의 공개 키만 사용할 수 있습니다.');}catch{return toast('공개 키 형식을 확인하세요.');}}
        else if(!key.startsWith('sb_publishable_'))return toast('publishable 또는 anon 키를 입력하세요.');
        try {await cloud?.auth.signOut();localStorage.setItem('kagoshima-supabase-config',JSON.stringify({url,key}));base=null;localStorage.removeItem(SESSION_REV);await initCloud();toast('연결 설정을 저장했습니다.');}catch(error){toast(error.message);}
    };
    async function busy(button,fn){if(button.disabled)return;button.disabled=true;try{await fn();}catch(error){toast(error.message||'요청에 실패했습니다.');}finally{button.disabled=false;}}
    $('#login').onclick=()=>busy($('#login'),async()=>{
        if(!cloud)throw new Error('Supabase 연결 설정이 필요합니다.');const email=$('#email').value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('이메일 주소를 확인하세요.');
        const {error}=await cloud.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;toast('로그인 이메일을 보냈습니다. 링크 또는 인증 코드를 확인하세요.');
    });
    $('#verify').onclick=()=>busy($('#verify'),async()=>{if(!cloud)throw new Error('연결 설정이 필요합니다.');const {error}=await cloud.auth.verifyOtp({email:$('#email').value.trim(),token:$('#otp').value.trim(),type:'email'});if(error)throw error;toast('로그인했습니다. 클라우드 불러오기 또는 저장을 선택하세요.');});
    $('#logout').onclick=async()=>{await cloud?.auth.signOut();cloudUser=null;updateCloudUI();};
    async function requireUser(){if(!cloud)throw new Error('Supabase 연결이 필요합니다.');const {data,error}=await cloud.auth.getUser();if(error||!data.user)throw new Error('로그인을 먼저 해주세요.');return data.user;}
    $('#cloud-load').onclick=()=>busy($('#cloud-load'),async()=>{
        const user=await requireUser();const {data,error}=await cloud.from('travel_plans').select('payload,revision,updated_at').eq('user_id',user.id).eq('trip_key','kagoshima-2026').maybeSingle();if(error)throw error;
        if(!data)throw new Error('클라우드에 저장된 일정이 없습니다. 현재 일정을 먼저 저장하세요.');
        const candidate=validateTrip(data.payload);if(!confirm('클라우드 일정으로 기기 일정을 교체할까요? 현재 수정안이 필요하면 먼저 JSON 백업을 만드세요.'))return;
        trip=candidate;base={url:configuration().url,user:user.id,revision:data.revision};localStorage.setItem(SESSION_REV,JSON.stringify(base));localBlocked=false;externalChange=false;commit();toast('클라우드 일정을 불러왔습니다.');
    });
    $('#cloud-save').onclick=()=>busy($('#cloud-save'),async()=>{
        const user=await requireUser();validateTrip(trip);
        if(localBlocked||externalChange)throw new Error('먼저 기기 저장 문제를 해결하거나 백업을 불러오세요.');
        const cfg=configuration(), expected=base?.user===user.id&&base?.url===cfg.url ? base.revision : 0;
        const {data,error}=await cloud.rpc('save_travel_plan',{p_trip_key:'kagoshima-2026',p_payload:trip,p_expected_revision:expected});
        if(error){if(error.message.includes('revision_conflict'))throw new Error('다른 기기에 더 새 일정이 있습니다. 현재 내용을 JSON 백업한 뒤 클라우드를 불러오고 다시 수정하세요.');throw error;}
        base={url:cfg.url,user:user.id,revision:data};localStorage.setItem(SESSION_REV,JSON.stringify(base));toast('클라우드에 저장했습니다. 다른 기기에서 같은 이메일로 불러오세요.');
    });
    initMap();render();
    if(!localBlocked)$('#save-status').textContent='기기 자동 저장 ✓';else $('#save-status').textContent='저장 복구 필요';
    initCloud();
    // Exposed only for deterministic data/link checks, no secrets.
    window.TripApp={validateTrip,gmaps,getTrip:()=>clone(trip)};
})();
