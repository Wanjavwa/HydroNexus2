# HydroNexus

Monitor. Predict. Prevent. HydroNexus transforms water infrastructure management with real-time data and smart insights.

**Live demo:** [hydro-nexus-ten.vercel.app](https://hydro-nexus-ten.vercel.app/)

---

## 1. Overview

HydroNexus is an intelligent water management system that integrates hardware (flow and pH sensors) with a web-based platform to monitor real-time conditions, analyze system behavior, predict potential failures, and help prevent infrastructure issues across a campus or facility.

The goal is to give operators a clear, live picture of what is happening in their water network, and turn raw sensor readings into actionable insights.

---

## 2. Features

- **Real-time monitoring**
  - Live readings for **water flow** and **pH** from physical sensors
  - Continuous polling from the backend for up-to-date information

- **Interactive dashboard**
  - Clean, modern UI built with React
  - Live charts and historical graphs for flow and pH
  - Status cards, alerts, and node-level views of the pipeline

- **Predictive analysis**
  - Pipe health scoring based on flow stability and pH deviation from neutral
  - Degradation trends and estimated time to failure
  - Visual breakdown of drivers (flow variability, water quality, etc.)

- **Alerts for abnormal conditions**
  - Detection of:
    - Sudden drops in flow (possible leaks)
    - Unusual flow fluctuations
    - Extreme pH values outside a safe band
  - Alerts surfaced via API and shown on the frontend

- **Preventative recommendations & actions**
  - Recommendations derived from current sensor state and alerts
  - Suggested actions (e.g. adjust dosing, inspect valves, schedule maintenance)
  - Prevent page focused on **immediate response**, **recommendations**, and **maintenance tasks**

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
- Arduino (e.g. Uno / compatible board)
- Flow sensor (connected to digital pin, e.g. pin 2)
- pH sensor (analog input with signal conditioning board)

---

## 4. How It Works

1. **Arduino collects sensor data**
   - Flow sensor pulses are converted into flow rate and total volume.
   - pH sensor voltage is converted into a calibrated pH value.

2. **Data is sent over serial USB**
   - Arduino prints readings (flow, total, pH) in a structured format.

3. **Node.js backend listens on the serial port**
   - Uses `serialport` to open the correct COM port (e.g. `COM5` on Windows).
   - Parses the incoming lines and normalizes them into a consistent JSON shape.
   - Stores the latest reading and a rolling history in memory.

4. **Backend exposes REST APIs**
   - `GET /api/sensors` – latest reading `{ flow, total, pH, timestamp }`
   - `GET /api/history` – recent history `[ { flow, pH, timestamp }, ... ]`
   - `GET /api/alerts` – derived alerts based on current conditions
   - `GET /api/recommendations` – suggested actions based on alerts/conditions

5. **React frontend visualizes the data**
   - Monitor page: real-time metrics, trend charts, alerts, pipeline map.
   - Predict page: health scores, degradation trends, and predictive insights.
   - Prevent page: immediate actions, recommendations, and maintenance planning.

---

## 5. Setup Instructions

### A. Clone the repository

```bash
git clone https://github.com/Wanjavwa/HydroNexus.git
cd HydroNexus
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

1. Open your Arduino sketch that:
   - Reads the **flow sensor** on the configured digital pin.
   - Reads the **pH sensor** on the appropriate analog pin.
   - Prints structured data for:
     - Flow rate (mL/s)
     - Total volume (mL)
     - pH value
2. Upload the sketch to the board from the Arduino IDE.
3. **Close** the Arduino Serial Monitor before running the Node backend (only one process can own the COM port).

### E. Configure and start the backend server

1. Ensure the COM port matches your Arduino (e.g. `COM5` on Windows).
2. Set the serial port environment variable (PowerShell example):

```bash
cd backend
$env:SERIAL_PORT = "COM5"   # adjust to your actual port
```

3. Start the backend:

```bash
npm start
```

By default, the backend:
- Listens on **port 3001** for HTTP.
- Connects to the configured `SERIAL_PORT` at 9600 baud.

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
   - When the Arduino is sending data, the Monitor, Predict, and Prevent pages will update live.

---

## 7. Notes / Limitations

- Requires an **Arduino connected locally via USB**; the system is currently designed for on-premise, local use.
- Backend stores data in **memory only** (no database), so readings reset when the server restarts.
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
  - Pressure sensors
  - Acoustic / vibration sensors
  - Ultrasonic thickness sensors
  - Temperature and conductivity probes

These additions would extend HydroNexus into a more complete digital twin for water infrastructure, improving early detection and decision-making for operators and engineers.

