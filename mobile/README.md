# AgriMinds AI-DREWS Mobile (React Native / Expo)

> **Farmer & Field Development Agent (DA) Mobile App**  
> Tailored for agricultural extension workers and smallholder farmers across the Choke Mountain Watershed, Amhara, Ethiopia.

---

## Architecture & Best Practices

1. **Safe Area & Edge-to-Edge Design:**
   - Full support for iPhone Dynamic Island, notches, and Android navigation bars using `react-native-safe-area-context`.
2. **Offline-First Resilience:**
   - Designed for rural Ethiopian highland areas with intermittent Ethio Telecom 3G/4G connectivity.
   - Automatically detects server unavailability, loads local offline cached advisories and raster risk estimates, and switches the indicator to **"Offline Cache Active"**.
3. **Three Segmented Tactical Tabs:**
   - **🌾 Advisory (ምክረ ሃሳብ):** Crop vulnerability analysis for Tef, Wheat, Maize; IEK traditional ecological indicators toggle; 4 clear agronomic action directives.
   - **🗺️ Drought Grid (የድርቅ ካርታ):** Interactive $8 \times 8$ Choke Watershed spatial grid with cell coordinates, probabilities, and one-handed thumb directional nudges (`◀ ▲ ▼ ▶`).
   - **🌡️ Climate ENSO (የአየር ንብረት):** Equatorial Pacific Niño 3.4 anomaly gauge, regional teleconnection impact note, and 6-month outlook timeline.
4. **Trilingual Localization:**
   - One-tap language switcher in the header between **English (EN)**, **Amharic (አማ)**, and **Afaan Oromoo (ORO)**.
5. **Pull-to-Refresh:**
   - Native `RefreshControl` allows DAs to pull down and sync with the latest satellite telemetry from the FastAPI ML Engine.

---

## Running the Mobile App

### Prerequisites
- Node.js 18+ or 20+ installed on your host machine.
- Expo Go installed on your iOS or Android device (from App Store or Google Play).

### Quickstart
1. Navigate to the `mobile/` directory:
   ```bash
   cd mobile
   npm install
   ```
2. Start the Expo development server:
   ```bash
   npx expo start
   ```
3. **Connect to FastAPI Backend:**
   - Android Emulator: Uses `http://10.0.2.2:8000/api/v1` automatically.
   - iOS Simulator: Uses `http://localhost:8000/api/v1` automatically.
   - Physical Phone (via Expo Go on same Wi-Fi): Update `API_BASE_URL` in `src/services/api.ts` to your machine's local IP address (e.g. `http://192.168.1.15:8000/api/v1`).
4. Scan the QR code with your camera (iOS) or the Expo Go app (Android).

---

## Alternative: Zero-Install PWA
The Next.js frontend (`http://localhost:3000`) is configured with an offline-ready Progressive Web App manifest (`public/manifest.json`).
On any mobile browser, tap **Share** / **Menu** $\rightarrow$ **"Add to Home Screen"** or **"Install App"** to run it as a standalone native-like mobile app.
