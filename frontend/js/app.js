const API_BASE = '/api';
const CALGARY_CENTER = [51.0447, -114.0719];
const ZOOM_LEVEL = 11;

const map = L.map('map').setView(CALGARY_CENTER, ZOOM_LEVEL);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const zoneLayer            = L.layerGroup().addTo(map); // added first so it renders below all markers
const stationCoverageLayer = L.layerGroup().addTo(map); // per-click 8km circle
const fireLayer            = L.layerGroup().addTo(map);
const sharedLayer   = L.layerGroup().addTo(map);
const emsLayer      = L.layerGroup().addTo(map);
const hospitalLayer = L.layerGroup().addTo(map);
var   cachedStations = [];

function makeIcon(color, size, glow) {
  var s = size || 14;
  return L.divIcon({
    className: '',
    html: '<div style="background:' + color + ';border:2px solid #fff;border-radius:50%;width:' + s + 'px;height:' + s + 'px;box-shadow:0 0 6px ' + (glow||color) + ';"></div>',
    iconSize: [s,s], iconAnchor: [s/2,s/2]
  });
}
function makeStarIcon(color) {
  return L.divIcon({
    className: '',
    html: '<div style="background:' + color + ';border:2px solid #fff;width:18px;height:18px;transform:rotate(45deg);box-shadow:0 0 8px ' + color + ';"></div>',
    iconSize: [18,18], iconAnchor: [9,9]
  });
}

var emsIcon      = makeIcon('#4da6ff', 14, 'rgba(77,166,255,0.8)');
var fireIcon     = makeIcon('#e63946', 14, 'rgba(230,57,70,0.8)');
var searchPinIcon = makeIcon('#00ff88', 14, 'rgba(0,255,136,0.8)');
var sharedIcon = makeIcon('#c77dff', 16, 'rgba(199,125,255,0.9)');
var hqIcon     = makeStarIcon('#ffd166');

var superstationIcon = L.divIcon({
  className: '',
  html: '<div style="background:#ff9f1c;border:2px solid #fff;width:20px;height:20px;transform:rotate(45deg);box-shadow:0 0 10px rgba(255,159,28,0.9);"></div>',
  iconSize: [20,20], iconAnchor: [10,10]
});

var hospitalIcon = L.divIcon({
  className: '',
  html: '<div style="position:relative;width:16px;height:16px;filter:drop-shadow(0 0 5px rgba(255,255,255,0.9));">'
      + '<div style="position:absolute;top:5px;left:1px;right:1px;height:6px;background:#fff;border-radius:1px;"></div>'
      + '<div style="position:absolute;left:5px;top:1px;bottom:1px;width:6px;background:#fff;border-radius:1px;"></div>'
      + '</div>',
  iconSize: [16, 16], iconAnchor: [8, 8]
});

var hospitals = [
  { name: 'Foothills Medical Centre',    type: 'Acute Care Hospital', address: '1403 29 St NW',    coords: [51.0638, -114.1320], trauma: 'Level 1 Trauma Centre',    helipad: true  },
  { name: 'Peter Lougheed Centre',       type: 'Acute Care Hospital', address: '3500 26 Ave NE',   coords: [51.0723, -113.9735], trauma: null,                        helipad: false },
  { name: 'Rockyview General Hospital',  type: 'Acute Care Hospital', address: '7007 14 St SW',    coords: [50.9783, -114.0789], trauma: null,                        helipad: false },
  { name: 'South Health Campus',         type: 'Acute Care Hospital', address: '4448 Front St SE', coords: [50.8893, -113.9958], trauma: null,                        helipad: true  },
  { name: 'Alberta Children\'s Hospital',type: "Children's Hospital", address: '28 Oki Dr NW',     coords: [51.0787, -114.1845], trauma: 'Pediatric Trauma Centre',   helipad: false }
];

function nearestHospital(coords) {
  var best = null, bestDist = Infinity;
  hospitals.forEach(function(h) {
    var d = turf.distance(turf.point([coords[1], coords[0]]), turf.point([h.coords[1], h.coords[0]]), { units: 'kilometers' });
    if (d < bestDist) { bestDist = d; best = h; }
  });
  return best ? best.name + ' (' + bestDist.toFixed(1) + ' km)' : null;
}

function loadHospitals() {
  hospitalLayer.clearLayers();
  hospitals.forEach(function(h) {
    L.marker(h.coords, { icon: hospitalIcon })
      .bindTooltip(tip('#00838f', h.name, h.type, h.address), { sticky: false, opacity: 0.95 })
      .on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var rows = [{ label: 'Operator', value: 'Alberta Health Services (AHS)' }];
        if (h.trauma) rows.push({ label: 'Trauma Designation', value: h.trauma });
        if (h.helipad) rows.push({ label: 'Helipad', value: 'Yes' });
        rows.push({ label: 'ED Wait Times', value: 'View current wait times', link: 'https://www.albertahealthservices.ca/waittimes/Page14230.aspx' });
        openPanel({ name: h.name, type: h.type, color: '#00838f', address: h.address, rows: rows });
      })
      .addTo(hospitalLayer);
  });
}

var superstations = [
  { name: 'StoneGate EMS Station', type: 'Calgary Zone EMS Headquarters', address: '2626 Country Hills Blvd NE', coords: [51.1558, -113.9978] },
  { name: 'Southgate EMS District Station', type: 'EMS Superstation (District Base)', address: '14911 Bannister Rd SE', coords: [50.9177, -114.0685] }
];

function getCoords(s) {
  if (s.latitude && s.longitude) return [parseFloat(s.latitude), parseFloat(s.longitude)];
  if (s.point) {
    var c = typeof s.point === 'string' ? JSON.parse(s.point) : s.point;
    return [c.coordinates[1], c.coordinates[0]];
  }
  return null;
}

function tip(color, name, type, address) {
  return '<div style="font-family:sans-serif;padding:2px 0;">'
    + '<strong style="color:' + color + ';">' + name + '</strong>'
    + '<br><span style="color:#aaa;font-size:0.8em;">' + type + '</span>'
    + (address ? '<br><span style="color:#888;font-size:0.75em;">' + address + '</span>' : '')
    + '</div>';
}

function openPanel(info) {
  document.getElementById('panel-badge').textContent = info.type;
  document.getElementById('panel-badge').style.color = info.color;
  document.getElementById('panel-name').textContent = info.name;
  document.getElementById('panel-address').textContent = info.address || '';
  var prev = document.getElementById('panel-preview');
  if (info.coords) {
    var lat = info.coords[0], lng = info.coords[1];
    var imgSrc = 'https://maps.googleapis.com/maps/api/streetview?size=248x110&location=' + lat + ',' + lng + '&fov=90&pitch=5&key=AIzaSyD-S4ihy_PLbSubHeQg02kXhD8hMMp4BvU';
    var svHref = 'https://www.google.com/maps/@' + lat + ',' + lng + ',3a,75y/data=!3m6!1e1';
    prev.innerHTML = '<a href="' + svHref + '" target="_blank" rel="noopener">'
      + '<img src="' + imgSrc + '" alt="Map preview" loading="lazy">'
      + '<span class="sv-badge">↗ Street View</span></a>';
  } else {
    prev.innerHTML = '';
  }
  var det = document.getElementById('panel-details');
  det.innerHTML = (info.rows || []).map(function(r) {
    var val = r.link
      ? '<a href="' + r.link + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;">↗ ' + r.value + '</a>'
      : r.value;
    return '<div class="panel-row"><span class="panel-row-label">' + r.label + '</span>'
         + '<span class="panel-row-value">' + val + '</span></div>';
  }).join('');
  stationCoverageLayer.clearLayers();
  if (info.coords) {
    L.circle(info.coords, {
      radius: 8000, color: '#00ff88', fillColor: '#00ff88',
      fillOpacity: 0.10, opacity: 0.6, weight: 1.5
    }).addTo(stationCoverageLayer);
  }
  document.getElementById('station-panel').classList.add('open');
}
function closePanel() {
  document.getElementById('station-panel').classList.remove('open');
  stationCoverageLayer.clearLayers();
  if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
}

// ── ADDRESS SEARCH ────────────────────────────────────────────────────────────
var searchMarker = null;

function nearestEMSStation(coords) {
  var best = null, bestDist = Infinity;
  cachedStations.forEach(function(s) {
    var sc = getCoords(s); if (!sc) return;
    var d = turf.distance(turf.point([coords[1], coords[0]]), turf.point([sc[1], sc[0]]), { units: 'kilometers' });
    if (d < bestDist) { bestDist = d; best = { name: s.name || 'EMS Station', dist: d }; }
  });
  superstations.forEach(function(s) {
    var d = turf.distance(turf.point([coords[1], coords[0]]), turf.point([s.coords[1], s.coords[0]]), { units: 'kilometers' });
    if (d < bestDist) { bestDist = d; best = { name: s.name, dist: d }; }
  });
  return best;
}

async function searchAddress(query) {
  query = query.trim();
  if (!query) return;
  var btn = document.getElementById('search-btn');
  btn.textContent = '…';
  try {
    var url = 'https://nominatim.openstreetmap.org/search?q='
      + encodeURIComponent(query + ', Calgary, Alberta, Canada')
      + '&format=json&limit=1&countrycodes=ca';
    var data = await fetch(url).then(function(r) { return r.json(); });
    if (!data.length) { btn.textContent = '↵'; alert('Address not found. Try a street name or intersection.'); return; }
    var lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
    map.setView([lat, lng], 15);
    if (searchMarker) map.removeLayer(searchMarker);
    searchMarker = L.marker([lat, lng], { icon: searchPinIcon }).addTo(map);
    var nearest = nearestEMSStation([lat, lng]);
    var rows = [];
    if (nearest) rows.push({ label: 'Nearest EMS Station', value: nearest.name + ' (' + nearest.dist.toFixed(1) + ' km)' });
    var label = data[0].display_name.split(',')[0];
    openPanel({ name: label, type: 'Search Result', color: '#00ff88', address: data[0].display_name.split(',').slice(0,3).join(','), rows: rows });
  } catch(e) {
    alert('Search failed. Please try again.');
  }
  btn.textContent = '↵';
}

document.getElementById('search-btn').addEventListener('click', function() {
  searchAddress(document.getElementById('search-input').value);
});
document.getElementById('search-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') searchAddress(this.value);
});

// ── PERMALINK / HASH SYNC ─────────────────────────────────────────────────────
function updateHash() {
  var c = map.getCenter(), z = map.getZoom();
  history.replaceState(null, '', '#' + z + '/' + c.lat.toFixed(5) + '/' + c.lng.toFixed(5));
}
function parseHash() {
  var parts = location.hash.replace('#', '').split('/');
  if (parts.length === 3) {
    var z = parseInt(parts[0]), lat = parseFloat(parts[1]), lng = parseFloat(parts[2]);
    if (!isNaN(z) && !isNaN(lat) && !isNaN(lng)) map.setView([lat, lng], z);
  }
}
map.on('moveend', updateHash);
parseHash();

document.getElementById('btn-share').addEventListener('click', function() {
  updateHash();
  navigator.clipboard.writeText(window.location.href).then(function() {
    var btn = document.getElementById('btn-share');
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = orig; }, 2000);
  });
});
document.getElementById('panel-close').addEventListener('click', closePanel);
map.on('click', closePanel);

function drawZones(stations) {
  zoneLayer.clearLayers();
  var points = [], colors = [];
  stations.forEach(function(s) {
    var coords = getCoords(s); if (!coords) return;
    points.push(turf.point([coords[1], coords[0]]));
    colors.push(s.collocated === true ? '#c77dff' : '#4da6ff');
  });
  superstations.forEach(function(s) {
    points.push(turf.point([s.coords[1], s.coords[0]]));
    colors.push('#ff9f1c');
  });
  if (points.length === 0) return;
  var voronoi = turf.voronoi(turf.featureCollection(points), { bbox: [-114.5, 50.82, -113.75, 51.28] });
  if (!voronoi) return;
  voronoi.features.forEach(function(feature, i) {
    if (!feature) return;
    var color = colors[i] || '#888';
    L.geoJSON(feature, {
      style: { color: color, fillColor: color, fillOpacity: 0.07, opacity: 0.4, weight: 1, dashArray: '4 4' }
    }).addTo(zoneLayer);
  });
}

var chartMonth = null, chartDay = null, chartType = null;

async function loadStations() {
  var res = await fetch(API_BASE + '/stations');
  var stations = await res.json();
  emsLayer.clearLayers(); sharedLayer.clearLayers();
  stations.forEach(function(s) {
    var coords = getCoords(s); if (!coords) return;
    var name = s.name || 'EMS Station';
    var shared = s.collocated === true;
    var color = shared ? '#c77dff' : '#4da6ff';
    var type = shared ? 'EMS + Fire (Shared)' : 'EMS Station';
    L.marker(coords, { icon: shared ? sharedIcon : emsIcon })
      .bindTooltip(tip(color, name, type, s.address), { sticky: false, opacity: 0.95 })
      .on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var nh = nearestHospital(coords);
        var rows = [
          { label: 'Status', value: shared ? 'Co-located with Fire' : 'EMS Only' },
          { label: 'Operator', value: 'Alberta Health Services (AHS)' }
        ];
        if (nh) rows.push({ label: 'Nearest Hospital', value: nh });
        openPanel({ name: name, type: type, color: color, address: s.address, coords: coords, rows: rows });
      })
      .addTo(shared ? sharedLayer : emsLayer);
  });
  // Add superstations after clearLayers so they don't get wiped
  superstations.forEach(function(s) {
    L.marker(s.coords, { icon: superstationIcon })
      .bindTooltip(tip('#ff9f1c', s.name, s.type, s.address), { sticky: false, opacity: 0.95 })
      .on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var nh = nearestHospital(s.coords);
        var rows = [
          { label: 'Classification', value: 'AHS Superstation' },
          { label: 'Operator', value: 'Alberta Health Services (AHS)' }
        ];
        if (nh) rows.push({ label: 'Nearest Hospital', value: nh });
        openPanel({ name: s.name, type: s.type, color: '#ff9f1c', address: s.address, coords: s.coords, rows: rows });
      })
      .addTo(emsLayer);
  });
  document.getElementById('stat-ems').textContent = stations.length;
}

async function loadFireStations() {
  var res = await fetch(API_BASE + '/fire-stations');
  var stations = await res.json();
  fireLayer.clearLayers();
  stations.forEach(function(s) {
    var coords = getCoords(s); if (!coords) return;
    if (s.collocated === true) return;
    var name = s.name || 'Fire Station';
    var isHQ = name.indexOf('HQ') !== -1;
    var color = isHQ ? '#ffd166' : '#e63946';
    var type = isHQ ? 'Fire HQ' : 'Fire Station';
    L.marker(coords, { icon: isHQ ? hqIcon : fireIcon })
      .bindTooltip(tip(color, name, type, s.address), { sticky: false, opacity: 0.95 })
      .on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var rows = [{ label: 'Operator', value: 'City of Calgary Fire Department' }];
        if (isHQ) rows.push({ label: 'Note', value: 'Administrative headquarters for CFD' });
        openPanel({ name: name, type: type, color: color, address: s.address, rows: rows });
      })
      .addTo(fireLayer);
  });
  document.getElementById('stat-fire').textContent = stations.length;
}

var barOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#556', font: { size: 9 } }, grid: { color: '#1a1d2a' } },
    y: { ticks: { color: '#556', font: { size: 9 } }, grid: { color: '#1a1d2a' } }
  }
};

var typeColors = {
  'Medical/Rescue':'#e63946','Fire':'#ff6b35','False Alarm':'#4da6ff',
  'Investigation':'#666','Public Service Assistance':'#c77dff',
  'Hazardous Condition':'#ffd166','Severe Weather':'#06d6a0','Rupture/Explosion':'#ff006e'
};

function renderCharts(stats) {
  if (chartMonth) chartMonth.destroy();
  if (chartDay)   chartDay.destroy();
  if (chartType)  chartType.destroy();

  chartMonth = new Chart(document.getElementById('chart-month'), {
    type: 'bar', options: barOpts,
    data: {
      labels: stats.byMonth.map(function(m){return m.month;}),
      datasets: [{ data: stats.byMonth.map(function(m){return m.count;}), backgroundColor:'#4da6ff44', borderColor:'#4da6ff', borderWidth:1 }]
    }
  });

  chartDay = new Chart(document.getElementById('chart-day'), {
    type: 'bar', options: barOpts,
    data: {
      labels: stats.byDay.map(function(d){return d.day;}),
      datasets: [{ data: stats.byDay.map(function(d){return d.count;}), backgroundColor:'#e6394644', borderColor:'#e63946', borderWidth:1 }]
    }
  });

  var sorted = stats.byType.slice().sort(function(a,b){return a.count - b.count;});
  chartType = new Chart(document.getElementById('chart-type'), {
    type: 'bar',
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#556', font: { size: 9 } }, grid: { color: '#1a1d2a' } },
        y: { ticks: { color: '#ccc', font: { size: 9 } }, grid: { display: false } }
      }
    },
    data: {
      labels: sorted.map(function(t){return t.type;}),
      datasets: [{
        data: sorted.map(function(t){return t.count;}),
        backgroundColor: sorted.map(function(t){return (typeColors[t.type]||'#555')+'99';}),
        borderColor: sorted.map(function(t){return typeColors[t.type]||'#555';}),
        borderWidth: 1
      }]
    }
  });
}

async function loadStats(year) {
  var url = API_BASE + '/stats' + (year ? '?year=' + year : '');
  var res = await fetch(url);
  var stats = await res.json();
  document.getElementById('stat-total').textContent = stats.totalCalls.toLocaleString();
  renderCharts(stats);
}

document.getElementById('year-select').addEventListener('change', function() {
  loadStats(this.value || null);
});
document.getElementById('toggle-ems').addEventListener('change', function(e) {
  if (e.target.checked) emsLayer.addTo(map); else map.removeLayer(emsLayer);
});
document.getElementById('toggle-fire').addEventListener('change', function(e) {
  if (e.target.checked) fireLayer.addTo(map); else map.removeLayer(fireLayer);
});
document.getElementById('toggle-shared').addEventListener('change', function(e) {
  if (e.target.checked) sharedLayer.addTo(map); else map.removeLayer(sharedLayer);
});

// --- Coverage layer (8-min / 10km radius) ---
const coverageLayer = L.layerGroup();

function drawCoverage(stations, fireStations) {
  stations.forEach(function(s) {
    var coords = getCoords(s); if (!coords) return;
    L.circle(coords, { radius: 10000, color: '#00ff88', fillColor: '#00ff88', fillOpacity: 0.04, opacity: 0.25, weight: 1 }).addTo(coverageLayer);
  });
  fireStations.forEach(function(s) {
    var coords = getCoords(s); if (!coords) return;
    L.circle(coords, { radius: 10000, color: '#00ff88', fillColor: '#00ff88', fillOpacity: 0.04, opacity: 0.25, weight: 1 }).addTo(coverageLayer);
  });
}

document.getElementById('toggle-coverage').addEventListener('change', function(e) {
  if (e.target.checked) coverageLayer.addTo(map);
  else map.removeLayer(coverageLayer);
});
document.getElementById('toggle-hospitals').addEventListener('change', function(e) {
  if (e.target.checked) hospitalLayer.addTo(map); else map.removeLayer(hospitalLayer);
});
document.getElementById('toggle-zones').addEventListener('change', function(e) {
  if (e.target.checked) drawZones(cachedStations); else zoneLayer.clearLayers();
});
document.getElementById('btn-charts').addEventListener('click', function() {
  var row = document.getElementById('charts-row');
  row.classList.toggle('charts-visible');
  var open = row.classList.contains('charts-visible');
  document.getElementById('btn-charts-arrow').textContent = open ? '↓' : '↑';
  document.getElementById('year-select').classList.toggle('year-visible', open);
});

async function init() {
  const [stations, fireStations] = await Promise.all([
    fetch(API_BASE + '/stations').then(r => r.json()),
    fetch(API_BASE + '/fire-stations').then(r => r.json())
  ]);
  cachedStations = stations;
  await Promise.all([loadStations(), loadFireStations(), loadStats(null)]);
  loadHospitals();
  drawCoverage(stations, fireStations);
}
init();
