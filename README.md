# Calgary EMS Dashboard
An interactive web dashboard visualizing Calgary EMS activity, built as a personal research project. Live at https://ems.brightening.ca

## What It Does
Interactive Map
The core of the dashboard is a dark-themed Leaflet.js map of Calgary displaying multiple overlapping layers of emergency services infrastructure:

- EMS Stations — All 25 City of Calgary EMS stations, sourced from the Calgary Open Data portal. Stations co-located with fire halls are shown separately in purple; EMS-only stations in red.
- Fire Stations — All 43 Calgary Fire Department stations in blue. Station 16 (Fire HQ) is marked with a distinct yellow diamond icon.
- EMS Superstations — Two major AHS facilities not present in the city dataset: StoneGate EMS Station (Calgary Zone HQ) and Southgate EMS District Station (the largest ambulance station in Alberta), marked with orange diamonds.
- Hospitals — The five major AHS acute care hospitals in Calgary: Foothills Medical Centre, Peter Lougheed Centre, Rockyview General Hospital, South Health Campus, and Alberta Children's Hospital — marked with white cross icons.
- Coverage Circles — Optional 10km radius rings around every EMS station, approximating an 8-minute response window.
- EMS Response Zones — Optional Voronoi diagram (computed via Turf.js) dividing the Calgary area into approximate response territories based on nearest EMS station. Colored by station type.
- All layers are independently toggleable via checkboxes in the header. Clicking any marker opens a detail panel that slides in from the left, showing the station name, type, address, operator, and contextual notes.

## Statistics Sidebar
Below the map, three Chart.js charts display aggregate EMS call data from the City of Calgary Open Data portal (dataset d6us-rmnf), covering ~570,000 calls from 2010–2019:

- Calls by Month — seasonal distribution across all years
- Calls by Day of Week — weekly demand pattern
- Calls by Incident Type — breakdown across 8 categories (Medical/Rescue, Fire, False Alarm, Investigation, Public Service Assistance, Hazardous Condition, Severe Weather, Rupture/Explosion)
- A year filter in the header lets you isolate any year from 2010–2019 or view all years combined.

## Mobile Support
On smaller screens, the header controls stack responsively and the charts panel is hidden by default, accessible via a toggle button. The station detail panel adapts to slide up from the bottom.

## Data Sources
- Dataset	Source	Notes
- EMS Stations	City of Calgary Open Data (s6f4-ijrf)	25 stations, coords + colocation status
- Fire Stations	City of Calgary Open Data	43 stations
- EMS Call Volume	City of Calgary Open Data (d6us-rmnf)	Daily incident counts 2010–2019
- AHS Superstations	Hardcoded (AHS/public records)	Not in city dataset — pre-dates it
- Hospitals	Hardcoded (AHS)	5 acute care facilities
Note: The EMS calls dataset ends at the start of 2020. Post-2019 data is held by Alberta Health Services and has not been publicly released. This project is actively pursuing that data via FOIP.

## Stack
Frontend: Vanilla JS, Leaflet.js, Chart.js, Turf.js
Backend: Node.js / Express
Map tiles: CARTO Dark Matter
Infrastructure: Ubuntu VPS, PM2, Nginx, Cloudflare
