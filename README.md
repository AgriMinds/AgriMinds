# AgriMinds: AI-DREWS

> **AI-Enabled Drought Early Warning and Climate-Resilient Decision Support System for Smallholder Farming**  
> *A Super-Hybrid Deep Learning Framework over the Choke Mountain Watershed, Amhara, Ethiopia*

---

## Architecture Overview

AgriMinds is an enterprise full-stack agricultural intelligence platform structured around a decoupled microservice architecture orchestrated via **Docker Compose**:

- **Frontend (`frontend/`)**: **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS**, and **Lucide Icons**. Responsive across **all screen devices** (from compact 320px mobile up to 24"+ 4K command centers). Includes an interactive 8×8 Choke Watershed spatial grid map with directional thumb-pad controls, crop vulnerability decision panels for Tef, Wheat, and Maize, Indigenous Ecological Knowledge (IEK) validation, and trilingual support (**English, Amharic / አማርኛ, Afaan Oromoo**).
- **Backend (`backend/`)**: **FastAPI** asynchronous REST API with **Pydantic v2** validation schemas, serving drought hazard maps, cell-level risk probabilities, crop-specific micro-advisories, and ENSO teleconnection outlooks.
- **Mobile (`mobile/`)**: **React Native / Expo** field application for Agricultural Development Agents (DAs) in remote kebeles with offline caching, Safe Area handling, pull-to-refresh, and GPS readiness.
- **ML Engine (`ai_drews/`)**: **PyTorch** deep learning pipelines implementing:
  - **Objective 1**: Conv1D + LSTM Niño 3.4 seasonal climate forecast.
  - **Objective 2**: Super-Hybrid (CNN-2D spatial + LSTM temporal + Fourier seasonal periodicity) drought probability model ($P(\text{SPI-3} \le -1.0)$).
  - **Objective 3**: Rule-based agro-ecological decision trees co-designed with traditional ecological indicators.
- **Cache & Message Broker**: **Redis 7 (Alpine)** for caching heavy geospatial predictions.

---

## Directory Structure

```text
AgriMinds/
├── docker-compose.yml          # Container orchestration (Frontend, Backend, Redis)
├── Makefile                    # Developer lifecycle commands (up, down, logs, test, health)
├── README.md                   # System documentation
│
├── frontend/                   # Next.js 15 + Tailwind CSS Web Application & PWA
│   ├── Dockerfile              # Multi-stage production container
│   ├── package.json            # React 19, Next 15, Tailwind CSS v4, Lucide-React
│   ├── next.config.ts          # Standalone container configuration
│   ├── public/manifest.json    # Progressive Web App (PWA) manifest
│   └── src/
│       ├── app/                # App Router (page.tsx, layout.tsx, globals.css)
│       ├── components/
│       │   ├── layout/         # Navigation bar & trilingual language switcher
│       │   ├── drought/        # 8x8 Watershed grid visualizer with thumb nudges
│       │   ├── advisory/       # Tef/Wheat/Maize crop decision panel & IEK toggles
│       │   ├── enso/           # Niño 3.4 SST anomaly spectrum gauge & 6-mo timeline
│       │   └── stats/          # Executive watershed metrics (scaled for 24"+)
│       ├── lib/                # API client wrapper & translations.ts
│       └── types/              # TypeScript interface contracts
│
├── backend/                    # FastAPI Microservice & Model Server
│   ├── Dockerfile              # Python 3.12-slim production container
│   ├── requirements.txt        # FastAPI, Uvicorn, PyTorch (CPU), Scikit-learn, Pydantic v2
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint & CORS middleware
│   │   ├── core/config.py      # Choke Watershed BBox, grid bounds, settings
│   │   ├── schemas/            # Pydantic v2 contracts (drought, advisory, enso)
│   │   ├── services/           # PyTorch Singleton inference & advisory decision trees
│   │   └── api/v1/             # REST endpoints (/drought, /advisories, /enso, /health)
│   └── tests/
│       └── test_api.py         # Automated API integration tests (6/6 passing)
│
├── mobile/                     # React Native / Expo Field Application
│   ├── App.tsx                 # 3-tab field app (Advisory, Grid, ENSO)
│   ├── app.json                # Expo metadata & permissions
│   ├── package.json            # React Native, Expo 52, Safe Area Context
│   ├── README.md               # Mobile setup & device connection instructions
│   └── src/
│       ├── services/api.ts     # Mobile API client with offline fallback caching
│       └── translations.ts     # Mobile trilingual localization (EN, አማ, ORO)
│
├── ai_drews/                   # ML Pipeline & PyTorch Artifacts
│   ├── app.py                  # Legacy Streamlit app (researcher sandbox)
│   ├── data/                   # Raw & processed data cubes (SPI-3, VCI, anomalies)
│   ├── models/                 # PyTorch weights (drought_model.pt, enso_cnnlstm.pt)
│   ├── outputs/                # Evaluation metrics, latest risk maps
│   └── src/                    # Data preparation, feature engineering & training
│
└── research_archive/           # Legacy experimental scripts (e.g., CNN_LSTM2.m)
```

---

## Quickstart with Docker Compose

Ensure Docker and Docker Compose are running on your machine.

### 1. Start all services
```bash
make up
# or: docker compose up --build -d
```

### 2. Access the Platform
- **Web Application (Responsive: Mobile to 24"+ Screens)**: [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 3. Run Automated Tests
```bash
make test
```

### 4. Health Check
```bash
make health
```

### 5. Stream Container Logs
```bash
make logs
# Or specifically:
make logs-backend
make logs-frontend
```

### 6. Stop Services
```bash
make down
```

---

## Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service and PyTorch artifact health check |
| `GET` | `/api/v1/drought/map?lead_month=1` | 8×8 Drought probability map for leads 1–3 |
| `GET/POST`| `/api/v1/drought/cell` | Query specific cell risk by `row`/`col` or `latitude`/`longitude` |
| `POST` | `/api/v1/advisories/evaluate` | Evaluates crop advisory for Tef, Wheat, Maize with IEK |
| `GET` | `/api/v1/enso/outlook` | Niño 3.4 historical values & 6-month CNN-LSTM forecast |

---

## Mobile Application

For agricultural extension workers (Development Agents) in rural kebeles:
```bash
cd mobile
npm install
npx expo start
```
- Supports offline fallback caching when cellular connectivity drops.
- Supports trilingual switching between English, Amharic, and Afaan Oromoo.
- See [`mobile/README.md`](mobile/README.md) for full details.

---

## Research Attribution
Developed under the **AI-DREWS** initiative in collaboration with **Debre Markos University**, the **AI Institute of Ethiopia**, and agricultural domain specialists for the Choke Mountain Watershed.
