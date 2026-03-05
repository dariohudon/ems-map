const API_BASE = '/api';
const CALGARY_CENTER = [51.0447, -114.0719];
const ZOOM_LEVEL = 11;

const map = L.map('map').setView(CALGARY_CENTER, ZOOM_LEVEL);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const fireLayer     = L.layerGroup().addTo(map);
const sharedLayer   = L.layerGroup().addTo(map);
const emsLayer      = L.layerGroup().addTo(map);
const hospitalLayer = L.layerGroup().addTo(map);

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

var emsIcon    = makeIcon('#e63946', 14, 'rgba(230,57,70,0.8)');
var fireIcon   = makeIcon('#4da6ff', 14, 'rgba(77,166,255,0.8)');
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
  { name: 'Foothills Medical Centre',    type: 'Acute Care Hospital',   address: '1403 29 St NW',     coords: [51.0638, -114.1320] },
  { name: 'Peter Lougheed Centre',       type: 'Acute Care Hospital',   address: '3500 26 Ave NE',    coords: [51.0723, -113.9735] },
  { name: 'Rockyview General Hospital',  type: 'Acute Care Hospital',   address: '7007 14 St SW',     coords: [50.9783, -114.0789] },
  { name: 'South Health Campus',         type: 'Acute Care Hospital',   address: '4448 Front St SE',  coords: [50.8893, -113.9958] },
  { name: 'Alberta Children\'s Hospital',type: "Children's Hospital",   address: '28 Oki Dr NW',      coords: [51.0787, -114.1845] }
];

function loadHospitals() {
  hospitalLayer.clearLayers();
  hospitals.forEach(function(h) {
    L.marker(h.coords, { icon: hospitalIcon })
      .bindTooltip(tip('#00838f', h.name, h.type, h.address), { sticky: false, opacity: 0.95 })
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

var chartMonth = null, chartDay = null, chartType = null;

async function loadStations() {
  var res = await fetch(API_BASE + '/stations');
  var stations = await res.json();
  emsLayer.clearLayers(); sharedLayer.clearLayers();
  stations.forEach(function(s) {
    var coords = getCoords(s); if (!coords) return;
    var name = s.name || 'EMS Station';
    var shared = s.collocated === true;
    var color = shared ? '#c77dff' : '#e63946';
    var type = shared ? 'EMS + Fire (Shared)' : 'EMS Station';
    L.marker(coords, { icon: shared ? sharedIcon : emsIcon })
      .bindTooltip(tip(color, name, type, s.address), { sticky: false, opacity: 0.95 })
      .addTo(shared ? sharedLayer : emsLayer);
  });
  // Add superstations after clearLayers so they don't get wiped
  superstations.forEach(function(s) {
    L.marker(s.coords, { icon: superstationIcon })
      .bindTooltip(tip('#ff9f1c', s.name, s.type, s.address), { sticky: false, opacity: 0.95 })
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
    var color = isHQ ? '#ffd166' : '#4da6ff';
    var type = isHQ ? 'Fire HQ' : 'Fire Station';
    L.marker(coords, { icon: isHQ ? hqIcon : fireIcon })
      .bindTooltip(tip(color, name, type, s.address), { sticky: false, opacity: 0.95 })
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

async function init() {
  const [stations, fireStations] = await Promise.all([
    fetch(API_BASE + '/stations').then(r => r.json()),
    fetch(API_BASE + '/fire-stations').then(r => r.json())
  ]);
  await Promise.all([loadStations(), loadFireStations(), loadStats(null)]);
  loadHospitals();
  drawCoverage(stations, fireStations);
}
init();
