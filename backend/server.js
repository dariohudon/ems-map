require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const FOIP_DIR = path.join(__dirname, 'data', 'foip');
const CALGARY_API = process.env.CALGARY_API_BASE;

// ─── Helper: fetch from Calgary Open Data ────────────────────────────────────
async function fetchCalgaryData(datasetId, queryString) {
  var qs = queryString || '';
  var url = CALGARY_API + '/' + datasetId + '.json?$limit=5000' + qs;
  var response = await axios.get(url);
  return response.data;
}

// ─── Helper: cache data to disk ──────────────────────────────────────────────
function cacheData(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data));
}

function loadCache(filename) {
  var filepath = path.join(DATA_DIR, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return null;
}

// ─── Data refresh function ────────────────────────────────────────────────────
async function refreshData() {
  console.log('[' + new Date().toISOString() + '] Refreshing data...');
  try {
    var stations = await fetchCalgaryData('s6f4-ijrf');
    cacheData('stations.json', stations);
    console.log('  EMS Stations: ' + stations.length + ' records');

    var fireStations = await fetchCalgaryData('cqsb-2hhg');
    cacheData('fire_stations.json', fireStations);
    console.log('  Fire Stations: ' + fireStations.length + ' records');

    var calls = await fetchCalgaryData('d6us-rmnf', '&$order=date+DESC');
    cacheData('calls.json', calls);
    console.log('  Response Calls: ' + calls.length + ' records');

    var callsByType = await fetchCalgaryData('bdez-pds9');
    cacheData('calls_by_type.json', callsByType);
    console.log('  Calls by Type: ' + callsByType.length + ' records');

  } catch (err) {
    console.error('Data refresh error:', err.message);
  }
}

// ─── Helper: build stats for a set of call records ───────────────────────────
function buildStats(calls, callsByType, yearFilter) {
  var filtered = yearFilter
    ? calls.filter(function(c) { return new Date(c.date).getFullYear() === yearFilter; })
    : calls.filter(function(c) { return new Date(c.date).getFullYear() <= 2020; });

  var byDay = [0,0,0,0,0,0,0];
  var byMonth = [0,0,0,0,0,0,0,0,0,0,0,0];
  var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  filtered.forEach(function(call) {
    if (call.date) {
      var date = new Date(call.date);
      var count = parseInt(call.incident_count) || 1;
      byDay[date.getDay()] += count;
      byMonth[date.getMonth()] += count;
    }
  });

  // Calls by type (always use full dataset for type breakdown, filtered by year if needed)
  var typeFiltered = yearFilter
    ? callsByType.filter(function(c) { return c.alarm_year === String(yearFilter); })
    : callsByType;

  var typeMap = {};
  typeFiltered.forEach(function(call) {
    var type = call.major_incident_type || 'Unknown';
    var count = parseInt(call.incident_count) || 1;
    typeMap[type] = (typeMap[type] || 0) + count;
  });

  var byType = Object.entries(typeMap)
    .map(function(e) { return { type: e[0], count: e[1] }; })
    .sort(function(a, b) { return b.count - a.count; });

  return {
    totalCalls: filtered.reduce(function(sum, c) { return sum + (parseInt(c.incident_count) || 0); }, 0),
    byDay: byDay.map(function(count, i) { return { day: dayNames[i], count: count }; }),
    byMonth: byMonth.map(function(count, i) { return { month: monthNames[i], count: count }; }),
    byType: byType
  };
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// GET /stations — EMS stations tagged if co-located with fire
app.get('/stations', function(req, res) {
  var ems = loadCache('stations.json');
  var fire = loadCache('fire_stations.json');
  if (!ems) return res.status(503).json({ error: 'Data not yet loaded' });

  var fireAddresses = fire
    ? fire.map(function(f) { return (f.address || '').toUpperCase().replace(/\s+/g, ' ').trim(); })
    : [];

  var tagged = ems.map(function(s) {
    var addr = (s.address || '').toUpperCase().replace(/\s+/g, ' ').trim();
    return Object.assign({}, s, { collocated: fireAddresses.includes(addr) });
  });

  res.json(tagged);
});

// GET /fire-stations — Fire stations tagged if co-located with EMS
app.get('/fire-stations', function(req, res) {
  var ems = loadCache('stations.json');
  var fire = loadCache('fire_stations.json');
  if (!fire) return res.status(503).json({ error: 'Data not yet loaded' });

  var emsAddresses = ems
    ? ems.map(function(e) { return (e.address || '').toUpperCase().replace(/\s+/g, ' ').trim(); })
    : [];

  var tagged = fire.map(function(s) {
    var addr = (s.address || '').toUpperCase().replace(/\s+/g, ' ').trim();
    return Object.assign({}, s, { collocated: emsAddresses.includes(addr) });
  });

  res.json(tagged);
});

// GET /calls — raw call data
app.get('/calls', function(req, res) {
  var data = loadCache('calls.json');
  if (!data) return res.status(503).json({ error: 'Data not yet loaded' });
  res.json(data);
});

// GET /stats?year=2015 — stats for a specific year, or all years if no param
app.get('/stats', function(req, res) {
  var calls = loadCache('calls.json');
  var callsByType = loadCache('calls_by_type.json');
  if (!calls) return res.status(503).json({ error: 'Data not yet loaded' });

  var year = req.query.year ? parseInt(req.query.year) : null;
  var stats = buildStats(calls, callsByType || [], year);

  // Also return available years for the tab UI
  var years = [];
  var seen = {};
  calls.forEach(function(c) {
    var y = new Date(c.date).getFullYear();
    if (y <= 2020 && !seen[y]) { seen[y] = true; years.push(y); }
  });
  years.sort();

  stats.years = years;
  res.json(stats);
});

// ─── FOIP Static Data Routes ──────────────────────────────────────────────────

function loadFoip(filename) {
  var filepath = path.join(FOIP_DIR, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }
  return null;
}

// GET /foip/alert-stats — Red/Orange alert statistics by year
app.get('/foip/alert-stats', function(req, res) {
  var data = loadFoip('alert_stats.json');
  if (!data) return res.status(404).json({ error: 'Data not found' });
  res.json(data);
});

// GET /foip/toc-hours — Transfer of Care hospital offload delay data
app.get('/foip/toc-hours', function(req, res) {
  var data = loadFoip('toc_hours.json');
  if (!data) return res.status(404).json({ error: 'Data not found' });
  res.json(data);
});

// GET /foip/event-volumes — EMS event volumes by fiscal year
app.get('/foip/event-volumes', function(req, res) {
  var data = loadFoip('event_volumes.json');
  if (!data) return res.status(404).json({ error: 'Data not found' });
  res.json(data);
});

// GET /foip/unit-availability — Per-unit availability data by fiscal year
app.get('/foip/unit-availability', function(req, res) {
  var data = loadFoip('unit_availability.json');
  if (!data) return res.status(404).json({ error: 'Data not found' });
  res.json(data);
});

// GET /foip/dispatch-heatmap — GPS coordinates for heatmap layer
app.get('/foip/dispatch-heatmap', function(req, res) {
  var data = loadFoip('dispatch_heatmap.json');
  if (!data) return res.status(404).json({ error: 'Data not found' });
  res.json(data);
});

// GET /foip/workforce — Overtime and sick time data
app.get('/foip/workforce', function(req, res) {
  var data = loadFoip('workforce.json');
  if (!data) return res.status(404).json({ error: 'Data not found' });
  res.json(data);
});

// GET /health
app.get('/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Scheduled refresh (every 6 hours) ───────────────────────────────────────
cron.schedule('0 */6 * * *', refreshData);

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(process.env.PORT, async function() {
  console.log('EMS Map API running on port ' + process.env.PORT);
  await refreshData();
});
