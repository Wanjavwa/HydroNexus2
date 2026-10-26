# HydroNexus

Monitor. Predict. Prevent. HydroNexus transforms water infrastructure management with real-time data and smart insights.

**Live demo:** [hydro-nexus-ten.vercel.app](https://hydro-nexus-ten.vercel.app/)

---

## 1. Overview

HydroNexus is a water monitoring system that reads available flow, pH, and pressure measurements from an Arduino connected by USB. The backend validates and timestamps incoming readings, then exposes current values, a rolling history, anomaly alerts, and maintenance recommendations.

The goal is to give operators a clear, live picture of what is happening in their water network, and turn raw sensor readings into actionable insights.

---

## 2. Features

- **Real-time monitoring**
  - Readings for **water flow**, **pH**, and **pressure when provided by the connected hardware**
  - Continuous polling of the backend, with explicit Arduino connection and stale-reading status

- **Interactive dashboard**
  - Clean, modern UI built with React
  - Charts contain only measurements received from the backend
  - Missing sensors, data source, timestamp, asset identifiers, and serial status are shown explicitly

- **Anomaly analysis**
  - Detect sudden flow drops, unusual flow changes, out-of-range pH, and pressure changes when pressure data is available
  - Analyze only valid readings and the available in-memory history
  - Does not claim to forecast future failures
- **Digital twin**
  - Configure and persist the real network assets and connections; no physical topology is prefilled
  - Associate readings using the asset ID provided by the Arduino
- **Maintenance and AI assistant**
  - Persist operator maintenance tasks locally in backend JSON files
  - Optional backend-only OpenAI assistant retrieves readings and network information through read-only backend tools
- **Ultrasonic thickness**
  - Accept optional `thicknessMm` measurements and show them without inferring wall loss or future failure

- **Alerts for abnormal conditions**
  - Detection of:
    - Sudden drops in flow (possible leaks)
    - Unusual flow fluctuations
    - Extreme pH values outside a safe band
  - Alerts surfaced via API and shown on the frontend

- **Preventative recommendations & actions**
  - Recommendations derived from current sensor state and alerts
  - Suggested actions (e.g. adjust dosing, inspect valves, schedule maintenance)
  - Maintenance page focused on **immediate response**, **recommendations**, and **maintenance tasks**

---

## 3. Tech Stack

**Frontend**
- React (Vite)
- Recharts (for charts)
- Tailwind CSS + custom styling

**Backend**
- Node.js
- Express
- `serialport` (for Arduino serial communication)

**Hardware**
- Arduino board already configured for the installed sensors
- Sensor types, pins, calibration, and serial output are defined by the deployed sketch and are not included in this repository

---

## 4. How It Works

1. **Arduino collects sensor data**
   - The deployed sketch reads and calibrates whichever sensors are installed.
   - Flow and pH are supported by the existing text protocol; pressure is accepted in JSON when supplied by the hardware.

2. **Data is sent over serial USB**
   - Arduino prints readings over serial using the existing line-delimited JSON or text format described below.

3. **Node.js backend listens on the serial port**
   - Uses `serialport` to open the correct COM port (e.g. `COM5` on Windows).
   - Parses incoming lines, validates any available measurements, adds a receipt timestamp when one is missing, and preserves supplied sensor/asset identifiers.
   - Stores the latest valid reading and up to 60 readings in memory.

4. **Backend exposes REST APIs**
   - `GET /api/sensors` – latest valid reading; unavailable measurements are `null`
   - `GET /api/status` – Arduino connection and latest-reading freshness
   - `GET /api/history` – last 60 received readings
   - `GET /api/alerts` – derived alerts based on current conditions
   - `GET /api/recommendations` – suggested actions based on alerts/conditions

5. **React frontend visualizes the data**
   - Monitor & Predict: real-time readings, charts, alerts, and anomaly detection (not future-failure predictions).
   - Digital Twin: operator-configured assets and connections, persisted by the backend.
   - Maintenance: evidence-based recommendations and persisted maintenance tasks.
   - The optional assistant runs in the backend and uses read-only tools to fetch actual measurements and configured network data.

### Arduino serial connection and message format

No Arduino sketch or hardware pin configuration is included in this repository. Use the sketch, sensors, and wiring already installed; do not assume a board type, pin assignment, or sensor set. The backend preserves the existing 9600-baud default and accepts `SERIAL_BAUD` as an override.

The serial reader currently recognizes these text lines (including their legacy labels):

```text
Flow | Rate: 12.34 mL/s | Total: 1234.00 mL
pH | Voltage: 2.50 V | pH: 7.10
----------------------------
```

Legacy text labels `Flow Sensor 1 | Flow Rate: ...` and `pH Probe | Voltage: ... | pH: ...` are also accepted. The separator completes a partial text frame, so an available flow or pH reading is retained even if another sensor is absent. Text pressure syntax is not defined by the hardware found in this repository; when a pressure sensor is installed, send its reading in the existing JSON line format instead of guessing a text convention:

```json
{"flow":12.34,"total":1234,"pH":7.1,"pressure":42.5,"pressureUnit":"kPa","timestamp":"2026-10-25T20:58:00Z","assetId":"main-supply","sensorIds":{"flow":"flow-1","pH":"ph-1","pressure":"pressure-1"}}
```

JSON messages may contain any available `flow`, `pH`/`ph`, `pressure`, or `thicknessMm` measurement; the other measurements may be omitted. `total`, `timestamp`, `assetId`, `sensorId`, `sensorIds`, and `pressureUnit` are optional. A supplied timestamp may be epoch milliseconds or an ISO date string; the backend uses its receipt time when the timestamp is missing or invalid. Non-numeric measurements are ignored, and messages with no valid flow, pH, pressure, or thickness measurement are discarded. Malformed and unsupported serial messages are logged and do not replace the latest valid reading. Associate a reading with a configured digital-twin asset by setting `assetId` to the asset's ID. Thickness values alone do not establish wall loss; baseline thickness, material, calibration, and inspection conditions are not modeled.

Backend endpoints:

| Endpoint | Response |
|---|---|
| `GET /api/sensors` | Latest valid reading or `null` |
| `GET /api/status` | `{ source, connected, stale, lastReadingAt, ageMs, staleAfterMs, error }` |
| `GET /api/history` | Up to 60 actual valid readings |
| `GET /api/alerts` | Current anomalies derived from the latest valid measurements/history |
| `GET /api/recommendations` | Recommendations derived from detected anomalies |
| `GET /api/network` | Persisted, operator-configured assets and connections |
| `GET /api/maintenance` | Persisted maintenance tasks |
| `GET /api/assistant/status` | Whether backend OpenAI configuration is available |

The history is held in memory and is cleared when the backend restarts; no database/persistent store is configured.

The digital-twin configuration and maintenance tasks are stored separately in `backend/data/network.json` and `backend/data/maintenance.json`, created when first edited and excluded from version control. Assistant requests require a backend `OPENAI_API_KEY`; without it, all monitoring and maintenance features remain available and the assistant reports that setup is needed.

---

## 5. Setup Instructions

### A. Clone the repository

```bash
git clone https://github.com/Wanjavwa/HydroNexus2.git
cd HydroNexus2
```

Make sure you are on the `main` branch:

```bash
git checkout main
```

### B. Install dependencies

#### Frontend (root)

From the project root:

```bash
npm install
```

#### Backend

```bash
cd backend
npm install
cd ..
```

### C. Connect the Arduino

1. Plug the Arduino into your computer via USB.
2. Open the **Arduino IDE**.
3. Select the correct **board** and **port**:
   - Tools → Board → (e.g. Arduino Uno)
   - Tools → Port → (e.g. `COM5` on Windows)

### D. Upload Arduino code

1. Use the Arduino sketch already deployed for your hardware. Its sensor pins and calibration are specific to that installation.
2. Confirm its serial output matches one of the formats documented above.
3. If you need to upload or inspect the sketch, use the correct board/port configuration for the hardware. Close the Arduino Serial Monitor before running the Node backend (only one process can own the COM port).

### E. Configure and start the backend server

1. Identify the serial port assigned to the connected Arduino on this computer.
2. Set the required port and, only if the sketch uses a different baud rate, the baud override (PowerShell example):

```powershell
cd backend
Copy-Item .env.example .env
$env:SERIAL_PORT = "COM5"   # adjust to your actual port
$env:SERIAL_BAUD = "9600"   # existing default; change only to match the sketch
$env:READING_STALE_MS = "10000"  # default freshness threshold
$env:DEMO_MODE = "false"  # never enable alongside real-data operation
```

Optional AI assistant configuration belongs in `backend/.env` (copy `backend/.env.example` first). Set `OPENAI_API_KEY` there if the assistant should be enabled. Keep the key out of frontend environment variables and source control.

3. Start the backend:

```bash
npm start
```

The backend listens on **port 3001** for HTTP. `SERIAL_PORT` must be configured; there is no assumed COM port. `SERIAL_BAUD` defaults to the existing 9600 baud setting. A reading is marked stale after `READING_STALE_MS` (default 10 seconds). If the port is missing or disconnects, the backend reports the offline state and does not substitute generated measurements.

### F. Start the frontend

In a separate terminal, from the project root:

```bash
npm run dev
```

This starts the Vite dev server (typically on `http://localhost:5173`).

---

## 6. Running the App

1. **Backend first**
   - Make sure the Node.js backend is running and connected to the Arduino serial port.
   - Confirm it is listening on `http://localhost:3001`.

2. **Then frontend**
   - Start the React app with `npm run dev`.
   - Open the browser at the URL printed by Vite, usually:
     - `http://localhost:5173/`

3. **Data flow**
   - The frontend polls the backend’s REST API once per second.
   - When the Arduino is sending valid data, Monitor & Predict, Digital Twin, and Maintenance use backend readings and connection status.
   - If hardware is unavailable, the app reports missing/offline data by default.

### Optional demo mode

For a hardware-free demonstration only, set `DEMO_MODE` to `true` in the backend environment before starting it. Demo mode disables serial input, generates clearly labeled sample readings, and never mixes them with Arduino measurements. Leave it unset or set it to `false` for production/hardware operation. The dashboard and other pages show `DEMO SIMULATION` as the active source.

---

## 7. Notes / Limitations

- Requires an **Arduino connected locally via USB** for live readings; the system is currently designed for on-premise, local use.
- Backend stores the latest reading and up to 60 readings in **memory only** (no database), so readings reset when the server restarts.
- Network access is currently **local only**:
  - Frontend expects the backend at `http://localhost:3001`.
  - CORS is configured for local development.

For deployment to other machines or environments, you will need to:
- Expose or host the backend where the frontend can reach it.
- Ensure serial access (or an equivalent data ingestion path) from the new environment.

---

## 8. Future Improvements

- **Cloud integration**
  - Push sensor data and alerts to a cloud backend for long-term storage and analytics.
  - Expose dashboards over the internet for remote monitoring.

- **WiFi-enabled microcontrollers**
  - Migrate from USB serial to WiFi (e.g. ESP32) to reduce wiring constraints.
  - Stream data over MQTT or HTTP directly to the backend/cloud.

- **Additional sensors**
  - Acoustic / vibration sensors
  - Ultrasonic thickness sensors
  - Temperature and conductivity probes

These additions would extend HydroNexus into a more complete digital twin for water infrastructure, improving early detection and decision-making for operators and engineers.
