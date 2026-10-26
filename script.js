const $ = (id) => document.getElementById(id);
const els = {
  input: $('cityInput'), searchBtn: $('searchBtn'), geoBtn: $('geoBtn'),
  suggestions: $('suggestions'), status: $('statusLine'),
  content: $('content'), emptyState: $('emptyState'),
  skyband: $('skyband'), skysvg: $('skysvg'), skyCaption: $('skyCaption'), skyReading: $('skyReading'),
  unitC: $('unitC'), unitF: $('unitF'), favorites: $('favorites'),
  themeToggle: $('themeToggle'), themeIcon: $('themeIcon'), themeLabel: $('themeLabel')
};

let unit = 'C'; // C or F
let lastData = null; // cache last fetched full payload for unit toggling
let favList = []; // in-memory favorites (session only)

// ---------------- Theme ----------------
function initTheme(){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
}
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  els.themeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
  els.themeToggle.setAttribute('aria-pressed', theme === 'dark');
  // Re-render sky contrast text if a reading is already showing
  if(lastData) render(lastData);
}
els.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ---------------- Weather code -> description / icon / palette ----------------
function codeInfo(code, isDay){
  const day = isDay !== 0;
  const table = {
    0:  {label:'Clear sky', icon:'sun', sky:['#7fb3d5','#eef1f6']},
    1:  {label:'Mostly clear', icon:'sun-cloud', sky:['#87b8d6','#eef1f6']},
    2:  {label:'Partly cloudy', icon:'sun-cloud', sky:['#93b6cf','#e6ebf1']},
    3:  {label:'Overcast', icon:'cloud', sky:['#8b97a8','#d9dee6']},
    45: {label:'Fog', icon:'fog', sky:['#a9b2bd','#dde1e6']},
    48: {label:'Depositing rime fog', icon:'fog', sky:['#a9b2bd','#dde1e6']},
    51: {label:'Light drizzle', icon:'rain', sky:['#6f8ba6','#c7d3de']},
    53: {label:'Drizzle', icon:'rain', sky:['#6684a1','#c1cedb']},
    55: {label:'Dense drizzle', icon:'rain', sky:['#5c7c9a','#b9c8d6']},
    61: {label:'Slight rain', icon:'rain', sky:['#5c7c9a','#b9c8d6']},
    63: {label:'Rain', icon:'rain', sky:['#4f6f8e','#adbecd']},
    65: {label:'Heavy rain', icon:'rain', sky:['#3f5e7c','#9fb2c3']},
    66: {label:'Freezing rain', icon:'rain', sky:['#5c7c9a','#b9c8d6']},
    67: {label:'Heavy freezing rain', icon:'rain', sky:['#4f6f8e','#adbecd']},
    71: {label:'Slight snow', icon:'snow', sky:['#c4d3e0','#f3f6f9']},
    73: {label:'Snow', icon:'snow', sky:['#b7c8d8','#eef2f6']},
    75: {label:'Heavy snow', icon:'snow', sky:['#aabed1','#e9eef3']},
    77: {label:'Snow grains', icon:'snow', sky:['#c4d3e0','#f3f6f9']},
    80: {label:'Slight showers', icon:'rain', sky:['#5c7c9a','#b9c8d6']},
    81: {label:'Showers', icon:'rain', sky:['#4f6f8e','#adbecd']},
    82: {label:'Violent showers', icon:'storm', sky:['#33465c','#7c8fa3']},
    85: {label:'Slight snow showers', icon:'snow', sky:['#c4d3e0','#f3f6f9']},
    86: {label:'Heavy snow showers', icon:'snow', sky:['#b7c8d8','#eef2f6']},
    95: {label:'Thunderstorm', icon:'storm', sky:['#2b3a4d','#6c7d92']},
    96: {label:'Thunderstorm, hail', icon:'storm', sky:['#2b3a4d','#6c7d92']},
    99: {label:'Thunderstorm, heavy hail', icon:'storm', sky:['#241f2e','#5a6a80']},
  };
  let info = table[code] || {label:'Unsettled', icon:'cloud', sky:['#8b97a8','#d9dee6']};
  if(!day){
    info = Object.assign({}, info, {sky:['#1a2740','#3d4d68']});
  }
  return info;
}

function iconSVG(kind, size=34, color='#1a2332'){
  const s = size;
  switch(kind){
    case 'sun':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6"><circle cx="12" cy="12" r="4.2"/><g stroke-linecap="round">
        <line x1="12" y1="1.5" x2="12" y2="4.2"/><line x1="12" y1="19.8" x2="12" y2="22.5"/>
        <line x1="1.5" y1="12" x2="4.2" y2="12"/><line x1="19.8" y1="12" x2="22.5" y2="12"/>
        <line x1="4.4" y1="4.4" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.6" y2="19.6"/>
        <line x1="4.4" y1="19.6" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.6" y2="4.4"/>
      </g></svg>`;
    case 'sun-cloud':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6"><circle cx="8.5" cy="8.5" r="3.4"/><path d="M4 18.5a3.6 3.6 0 0 1 .6-7.15 4.6 4.6 0 0 1 8.9-1.2 3.9 3.9 0 0 1 4.5 3.85 3.5 3.5 0 0 1-.3 4.5H4Z"/></svg>`;
    case 'cloud':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6"><path d="M6.5 18.5a4 4 0 0 1 .3-8 5.1 5.1 0 0 1 9.9-1.3A4.3 4.3 0 0 1 20 13a4 4 0 0 1-.5 5.5H6.5Z"/></svg>`;
    case 'fog':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="13" x2="20" y2="13"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`;
    case 'rain':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6"><path d="M6.5 14.5a4 4 0 0 1 .3-8 5.1 5.1 0 0 1 9.9-1.3A4.3 4.3 0 0 1 20 9a4 4 0 0 1-.5 5.5H6.5Z"/><g stroke-linecap="round"><line x1="8" y1="17.5" x2="7" y2="20.5"/><line x1="12" y1="17.5" x2="11" y2="20.5"/><line x1="16" y1="17.5" x2="15" y2="20.5"/></g></svg>`;
    case 'snow':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6"><path d="M6.5 14.5a4 4 0 0 1 .3-8 5.1 5.1 0 0 1 9.9-1.3A4.3 4.3 0 0 1 20 9a4 4 0 0 1-.5 5.5H6.5Z"/><g stroke-linecap="round"><line x1="8" y1="17" x2="8" y2="21"/><line x1="6.2" y1="18.3" x2="9.8" y2="19.7"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="10.2" y1="18.3" x2="13.8" y2="19.7"/><line x1="16" y1="17" x2="16" y2="21"/><line x1="14.2" y1="18.3" x2="17.8" y2="19.7"/></g></svg>`;
    case 'storm':
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${color}" stroke-width="1.6"><path d="M6.5 13.5a4 4 0 0 1 .3-8 5.1 5.1 0 0 1 9.9-1.3A4.3 4.3 0 0 1 20 8a4 4 0 0 1-.5 5.5H6.5Z"/><path d="M12.5 15.5 10 19h3l-1.5 3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"></svg>`;
  }
}

function windDial(deg){
  const rad = (deg||0);
  return `<svg viewBox="0 0 44 44" width="40" height="40">
    <circle cx="22" cy="22" r="19" fill="none" stroke="var(--line)" stroke-width="1.4"/>
    <g transform="rotate(${rad} 22 22)">
      <line x1="22" y1="22" x2="22" y2="7" stroke="var(--storm)" stroke-width="2" stroke-linecap="round"/>
      <polygon points="22,4 18,10 26,10" fill="var(--storm)"/>
    </g>
    <circle cx="22" cy="22" r="2" fill="var(--ink)"/>
  </svg>`;
}

function skySVGContent(colorA, colorB, kind){
  let extra = '';
  if(kind==='rain' || kind==='storm'){
    let drops = '';
    for(let i=0;i<14;i++){
      const x = (i*67)%900 + (i%3)*20;
      const y = 20 + (i*13)%120;
      drops += `<line x1="${x}" y1="${y}" x2="${x-8}" y2="${y+22}" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round"/>`;
    }
    extra = drops;
  } else if(kind==='snow'){
    let flakes = '';
    for(let i=0;i<18;i++){
      const x = (i*53)%900;
      const y = 15 + (i*17)%140;
      flakes += `<circle cx="${x}" cy="${y}" r="2.4" fill="rgba(255,255,255,0.7)"/>`;
    }
    extra = flakes;
  } else if(kind==='sun' || kind==='sun-cloud'){
    extra = `<circle cx="770" cy="55" r="30" fill="rgba(255,255,255,0.55)"/>`;
  } else if(kind==='cloud' || kind==='fog'){
    extra = `<ellipse cx="200" cy="60" rx="90" ry="22" fill="rgba(255,255,255,0.25)"/><ellipse cx="600" cy="90" rx="120" ry="26" fill="rgba(255,255,255,0.18)"/>`;
  }
  return `
    <defs>
      <linearGradient id="skygrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${colorA}"/>
        <stop offset="100%" stop-color="${colorB}"/>
      </linearGradient>
    </defs>
    <rect width="900" height="180" fill="url(#skygrad)"/>
    ${extra}
    <path d="M0,150 Q225,120 450,145 T900,140 V180 H0 Z" fill="rgba(26,35,50,0.10)"/>
  `;
}

function updateSky(info){
  els.skyband.style.background = `linear-gradient(180deg, ${info.sky[0]}, ${info.sky[1]})`;
  els.skysvg.innerHTML = skySVGContent(info.sky[0], info.sky[1], info.icon);
  const dark = isColorDark(info.sky[1]);
  els.skyCaption.style.color = dark ? '#eef1f6' : '#1a2332';
  els.skyReading.style.color = dark ? '#eef1f6' : '#1a2332';
}

function isColorDark(hex){
  const c = hex.replace('#','');
  const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  const lum = 0.299*r + 0.587*g + 0.114*b;
  return lum < 150;
}

function cToF(c){ return c*9/5+32; }
function fmtTemp(c){ return unit==='C' ? Math.round(c)+'°C' : Math.round(cToF(c))+'°F'; }

// ---------------- Geocoding & fetch ----------------
let debounceTimer = null;
els.input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = els.input.value.trim();
  if(q.length < 2){ els.suggestions.classList.remove('show'); return; }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 350);
});

document.addEventListener('click', (e) => {
  if(!els.suggestions.contains(e.target) && e.target !== els.input){
    els.suggestions.classList.remove('show');
  }
});

async function fetchSuggestions(q){
  try{
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
    const data = await res.json();
    if(!data.results || data.results.length===0){
      els.suggestions.classList.remove('show');
      return;
    }
    els.suggestions.innerHTML = data.results.map(r => {
      const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
      return `<button type="button" data-lat="${r.latitude}" data-lon="${r.longitude}" data-label="${label.replace(/"/g,'&quot;')}">${label}</button>`;
    }).join('');
    els.suggestions.classList.add('show');
    els.suggestions.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        els.input.value = btn.dataset.label;
        els.suggestions.classList.remove('show');
        loadWeather(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon), btn.dataset.label);
      });
    });
  }catch(e){
    els.suggestions.classList.remove('show');
  }
}

els.searchBtn.addEventListener('click', async () => {
  const q = els.input.value.trim();
  if(!q){ setStatus('Enter a city name first.', true); return; }
  setStatus('Searching…');
  try{
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
    const data = await res.json();
    if(!data.results || data.results.length===0){
      setStatus('City not found. Try a different spelling.', true);
      return;
    }
    const r = data.results[0];
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    loadWeather(r.latitude, r.longitude, label);
  }catch(e){
    setStatus('Could not reach the geocoder. Check your connection.', true);
  }
});

els.input.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){ els.searchBtn.click(); }
});

els.geoBtn.addEventListener('click', () => {
  if(!navigator.geolocation){
    setStatus('Geolocation is not available in this browser.', true);
    return;
  }
  setStatus('Locating…');
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude, 'Current location'),
    () => setStatus('Could not get your location. Search a city instead.', true)
  );
});

els.unitC.addEventListener('click', () => { unit='C'; setActiveUnit(); if(lastData) render(lastData); });
els.unitF.addEventListener('click', () => { unit='F'; setActiveUnit(); if(lastData) render(lastData); });
function setActiveUnit(){
  els.unitC.classList.toggle('active', unit==='C');
  els.unitF.classList.toggle('active', unit==='F');
}

function setStatus(msg, isError=false){
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}

async function loadWeather(lat, lon, label){
  setStatus('Fetching live sky data…');
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
      `&timezone=auto`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('bad response');
    const data = await res.json();
    lastData = { data, label, lat, lon };
    render(lastData);
    setStatus('');
    addToFavorites(label, lat, lon);
  }catch(e){
    setStatus('Could not fetch weather right now. Try again shortly.', true);
  }
}

function addToFavorites(label, lat, lon){
  if(favList.find(f => f.label===label)) return;
  favList.unshift({label, lat, lon});
  favList = favList.slice(0,6);
  renderFavorites();
}

function renderFavorites(){
  if(favList.length===0){ els.favorites.innerHTML=''; return; }
  els.favorites.innerHTML = favList.map(f =>
    `<button class="fav-chip" data-lat="${f.lat}" data-lon="${f.lon}" data-label="${f.label.replace(/"/g,'&quot;')}"><span class="star">★</span> ${f.label}</button>`
  ).join('');
  els.favorites.querySelectorAll('.fav-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      loadWeather(parseFloat(chip.dataset.lat), parseFloat(chip.dataset.lon), chip.dataset.label);
    });
  });
}

function render({data, label}){
  els.emptyState.style.display = 'none';
  const cur = data.current;
  const info = codeInfo(cur.weather_code, cur.is_day);
  updateSky(info);

  els.skyCaption.textContent = `${label} — ${info.label.toLowerCase()}`;
  els.skyReading.textContent = fmtTemp(cur.temperature_2m);

  const tz = data.timezone_abbreviation || data.timezone || '';
  const localTime = new Date().toLocaleString('en-US', { timeZone: data.timezone, hour:'2-digit', minute:'2-digit', weekday:'short', month:'short', day:'numeric' });

  const daily = data.daily;
  let forecastHTML = '';
  for(let i=0;i<Math.min(5, daily.time.length);i++){
    const d = new Date(daily.time[i] + 'T00:00:00');
    const dayLabel = i===0 ? 'Today' : d.toLocaleDateString('en-US',{weekday:'short'});
    const dinfo = codeInfo(daily.weather_code[i], 1);
    forecastHTML += `
      <div class="fcard">
        <div class="day">${dayLabel}</div>
        ${iconSVG(dinfo.icon, 32)}
        <div class="hi">${fmtTemp(daily.temperature_2m_max[i])}</div>
        <div class="lo">${fmtTemp(daily.temperature_2m_min[i])}</div>
      </div>`;
  }

  const sunrise = new Date(daily.sunrise[0]).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  const sunset = new Date(daily.sunset[0]).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

  els.content.innerHTML = `
    <div class="panel">
      <div class="panel-top">
        <div>
          <div class="place-name">${label}</div>
          <div class="place-meta">${localTime}${tz ? ' · ' + tz : ''}</div>
        </div>
        <div class="temp-big">${fmtTemp(cur.temperature_2m)}<span class="cond">${info.label}</span></div>
      </div>
      <div class="readouts">
        <div class="readout">
          <div class="label">Humidity</div>
          <div class="value">${cur.relative_humidity_2m}%</div>
        </div>
        <div class="readout">
          <div class="label">Wind</div>
          <div class="dial-wrap">
            ${windDial(cur.wind_direction_10m)}
            <div class="value">${Math.round(cur.wind_speed_10m)} km/h</div>
          </div>
        </div>
        <div class="readout">
          <div class="label">Condition</div>
          <div class="value">${info.label}</div>
        </div>
      </div>
    </div>

    <div class="section-label">5-Day Forecast</div>
    <div class="forecast-strip">${forecastHTML}</div>

    <div class="sun-strip">
      <div><span class="label">Sunrise</span>${sunrise}</div>
      <div><span class="label">Sunset</span>${sunset}</div>
    </div>
  `;
}

setActiveUnit();
initTheme();