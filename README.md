<div align="center">

# 🛰️ Sivas Smart Logistics Command Center
### `Team-078` · Anadolu Hackathon 2026

> **"Challenging Sivas winters with the precision of Predictive AI."**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](#)
[![Status](https://img.shields.io/badge/STATUS-LIVE_ON_VM-00ff88?style=for-the-badge)](#)

**Multilingual Support (TR/EN/RU)** · **R² = 0.897** · **MAE = 44.38 min** · **79 Learned Speed Combinations**

</div>

---

## 🏔️ 1. The Vision: Why Sivas?
In the Sivas region, static logistics planning is bound to fail. A plan made at 08:00 AM does not account for the fact that at 02:23 PM, when the courier reaches a mountain pass, visibility will drop to 2km and icing will occur.

Our solution is a **3-Layer Digital Twin** that recomputes the entire reality for every single stop at the exact moment of arrival.

## 🧠 2. The Engine: 3-Layer Architecture

### Layer 1: The Predictive AI (The Brain)
We trained a **Random Forest Regressor** on historical Sivas logistics data. 
- **Features:** 29 distinct features including precipitation, visibility, wind speed, road type, and "Circuity Factors".
- **Performance:** Achieved an **R² of 0.897**, reducing Mean Absolute Error (MAE) from 102 minutes to **44.38 minutes**.

### Layer 2: Dynamic Optimizer (The Captain)
Unlike competitors, our optimizer uses a **Temporal Cascade (Ripple Effect)** logic:
1. **Order changes time:** Moving a stop forward changes its ETA.
2. **Time changes conditions:** A different ETA means different weather/traffic lookup (`weather_observations.csv`).
3. **Conditions change the score:** New conditions result in a new AI-predicted delay, which cascades to all subsequent stops.

### Layer 3: Command Center UI (The Dashboard)
A high-fidelity **Glassmorphism UI** designed for dispatchers:
- **Spherical HUD:** A 3D tactical globe projection for strategic oversight.
- **Real-time Toggles:** Switch between Satellite/Flat maps and Spherical/Normal projections.
- **Efficiency Widget:** Instant visualization of "Time Gained" through optimization.

---

## 🛠️ 3. Key Technical Differentiators

| Feature | Our Approach | Industry Standard |
|---|---|---|
| **Weather Lookup** | Per-stop arrival time (Dynamic) | Global daily forecast (Static) |
| **Road Geometry** | **Mountain Circuity Factor (1.65)** | Flat Euclidean Distance |
| **Dependency** | **Zero External API** (Air-gapped ready) | Requires Google/HERE Maps |
| **Logic** | Temporal Delay Cascading | Simple Point-to-Point ETA |

---

## 🚀 4. Deployment & Quick Start

The system is currently live on the **Anadolu Hackathon VM (Team-078)**.

### Local Installation
```bash
# Clone the repository
git clone [https://github.com/team-078/sivas-logistics-command.git](https://github.com/team-078/sivas-logistics-command.git)
cd sivas-logistics-command

# Setup Virtual Environment
python3 -m venv venv
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt

# Run Production Server
python -m uvicorn app:app --port 8000 --host 0.0.0.0