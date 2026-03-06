# Calgary EMS Dashboard
An interactive web dashboard visualizing Calgary EMS activity, built as a personal research project. Live at https://ems.brightening.ca

## What It Does

### Interactive Map
The core of the dashboard is a dark-themed Leaflet.js map of Calgary displaying multiple overlapping layers of emergency services infrastructure:

- **EMS Stations** — All Calgary Zone EMS stations sourced from the Calgary Open Data portal. Stations co-located with fire halls are shown in purple; EMS-only stations in blue.
- **Fire Stations** — Calgary Fire Department stations in red. Station 16 (Fire HQ) is marked with a yellow diamond icon.
- **EMS Superstations** — Two major AHS facilities not in the city dataset: StoneGate EMS Station (Calgary Zone HQ) and Southgate EMS District Station, marked with orange diamonds.
- **Hospitals** — The five AHS acute care hospitals in Calgary: Foothills Medical Centre (Level 1 Trauma), Peter Lougheed Centre, Rockyview General Hospital, South Health Campus, and Alberta Children's Hospital.
- **Coverage Circles** — Optional 10 km radius rings around every EMS station, approximating an 8-minute response window.
- **EMS Response Zones** — Optional Voronoi diagram (Turf.js) dividing Calgary into approximate response territories based on nearest EMS station.
- **Dispatch Heatmap** — A heat layer showing ambulance positions at the moment of dispatch, derived from FOIP request 2021-G-017 (approximately 1,800 dispatch events from Cochrane area calls, calendar year 2020). Rendered via Leaflet.heat.

All layers are toggleable via the interactive legend panel on the map. Active layers appear at full opacity; inactive layers fade to indicate they are off. Hovering a layer label shows a brief description. Clicking any marker opens a detail panel with station name, type, address, operator, nearest hospital, and a street-level map preview.

### City Data Charts
The "City Data" panel shows three Chart.js charts sourced from the City of Calgary Open Data portal, covering approximately 570,000 calls from 2010–2020:

- **Calls by Month** — Seasonal distribution
- **Calls by Day of Week** — Weekly demand pattern
- **Calls by Incident Type** — Breakdown across 8 categories (Medical/Rescue, Fire, False Alarm, Investigation, Public Service Assistance, Hazardous Condition, Severe Weather, Rupture/Explosion)

A year filter lets you isolate any year from 2010–2020 or view all years combined.

### AHS System Data Charts
The "AHS Data" panel shows three additional charts sourced from FOIP requests to Alberta Health Services:

- **Red/Orange Alerts by Year** — Calendar year counts of Red Alert (0 units available in Calgary Metro) and Orange Alert (1–3 units) events from 2018–2020. Orange Alert tracking began June 28, 2017.
- **TOC Lost Hours by Fiscal Year** — Ambulance hours lost to hospital offload delays (Transfer of Care) from FY2015/16 to FY2020/21, representing time crews spent waiting at hospital before patient handoff.
- **EMS Event Volume by Fiscal Year** — Breakdown of emergency, non-emergency 911, and interfacility transfer (IFT) call volumes by fiscal year.

### Cross-Reference / Correlate
The "Correlate" panel lets you plot any two AHS metrics on a dual-axis line chart to visually explore relationships in the data. Available series:

- TOC Lost Hours (FY)
- EMS Total Events (FY)
- Calgary Metro Available % (FY)
- Red Alerts (CY)
- Orange Alerts (CY)
- Sick Hours (CY)

Series A appears on the left Y-axis (solid line); Series B on the right Y-axis (dashed line). When both metrics share the same time axis (both FY or both CY), the chart shows direct correlation. Mixed FY/CY pairs display with their respective label sets. Data is cached client-side to avoid redundant fetches.

### Address Search & Permalink
A geocoded address search (Nominatim) lets you locate any Calgary address on the map, with the nearest EMS station and distance shown in the detail panel. The URL hash updates with map position for shareable links.

## Data Sources

### City of Calgary Open Data
Live operational data is fetched from the [City of Calgary Open Data portal](https://data.calgary.ca) and cached locally, refreshed every 6 hours.

| Dataset | Dataset ID | Notes |
|---|---|---|
| EMS Stations | s6f4-ijrf | 25 stations, coordinates + co-location status |
| Fire Stations | cqsb-2hhg | 43 stations |
| EMS Call Volume | d6us-rmnf | Daily incident counts 2010–2020 |
| Calls by Type | bdez-pds9 | Incident type breakdown by year |

### Alberta Health Services FOIP Requests
Historical AHS operational data was obtained through the Alberta Freedom of Information and Protection of Privacy (FOIP) Act. Records were accessed via the [AHS PAL Application Reading Room](https://foip.albertahealthservices.ca/app/ReadingRoom.aspx), which publishes completed FOIP disclosures for public access.

| Dataset | FOIP Request(s) | Notes |
|---|---|---|
| Red/Orange Alerts | 2020-G-053, 2021-G-121, 2021-G-238 | Calgary Metro Dispatch Group, 2018–2021 |
| TOC Lost Hours | 2020-G-172 | Calgary Zone, FY2015/16–FY2020/21 |
| EMS Event Volumes | 2020-G-180, 2020-G-172 | Calgary Zone, FY2015/16–FY2020/21 |
| Unit Availability | 2020-G-173 | Calgary Zone per-community, FY2015/16–FY2020/21 |
| Workforce (OT/Sick) | 2020-G-053, 2021-G-121 | Calgary Zone, 2018–2020 |
| Dispatch Heatmap GPS | 2021-G-017 | Cochrane area dispatch events with GPS, CY2020 |

FOIP data is stored as static JSON in the backend and served via `/foip/*` endpoints. No personal information is included — all records are aggregate operational statistics or anonymized dispatch metadata.

### Hardcoded Reference Data
| Dataset | Source |
|---|---|
| AHS Superstations | AHS public records (not in city dataset) |
| Hospitals | AHS facility directory — 5 acute care facilities |

## Stack
- **Frontend:** Vanilla JS, Leaflet.js, Leaflet.heat, Chart.js, Turf.js
- **Backend:** Node.js / Express
- **Map tiles:** CARTO Dark Matter
- **Infrastructure:** Ubuntu VPS, PM2, Nginx, Cloudflare
