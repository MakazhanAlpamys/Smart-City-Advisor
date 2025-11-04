Here's a comprehensive prompt for an AI agent to complete this hackathon task:

---

# AI Agent Instructions: Multi-Modal Logistics Optimization System

## Mission
Build a complete AI-powered logistics optimization system for the GDG Hackaton Astana. You must create everything from scratch: synthetic dataset generation, ML models, optimization algorithms, and a REST API service. This is a hackathon submission that must score 100%.

## Core Requirements Overview

You need to deliver 4 main components:
1. **Data Generator** - Create realistic synthetic logistics data
2. **ML Pipeline** - Train models for demand forecasting and transport selection
3. **Optimization Engine** - Find optimal multi-modal routes
4. **REST API** - Serve predictions with <300ms response time

---

## PART 1: SYNTHETIC DATASET GENERATION

### Network Creation
Generate a logistics network with:
- **Minimum 30 nodes** (cities/hubs) distributed across a region
- Node types: origin points, destination points, transfer hubs, airports
- Use NetworkX to create a realistic graph structure
- Ensure connectivity between all nodes

### Dataset Requirements (Minimum 5000 orders, 90 days history)

**Nodes Dataset** (`nodes.csv`):
```
node_id, node_type, latitude, longitude, has_airport, processing_capacity_daily, operating_hours
```

**Distance Matrix** (`distances.csv`):
```
from_node, to_node, road_distance_km, road_time_hours, air_distance_km, air_time_hours, road_cost_per_kg, air_cost_per_kg
```

**Orders Dataset** (`orders.csv`):
```
order_id, timestamp, origin_id, destination_id, weight_kg, volume_m3, cargo_class, required_delivery_time, actual_delivery_time, transport_mode_used, total_cost, status
```
- cargo_class: standard, express, fragile
- transport_mode: road, air, combined
- status: delivered, delayed, cancelled

**Weather Patterns** (`weather.csv`):
```
date, node_id, condition, temperature, wind_speed, visibility, impact_factor
```
- condition: clear, rain, storm, fog, snow
- impact_factor: 0.7-1.3 (multiplier for delivery time)

**Capacity Data** (`capacity.csv`):
```
date, node_id, transport_type, available_capacity_kg, utilized_capacity_kg, number_of_vehicles
```

### Data Generation Rules

**Temporal Patterns to Simulate:**
- **Peak hours**: 8-10 AM and 5-7 PM (2x normal volume)
- **Weekday vs Weekend**: 70% more orders on weekdays
- **Seasonality**: Gradual 20-30% increase over the 90-day period
- **Random disruptions**: 5-10% of orders should have delays/issues

**Realistic Constraints:**
- Road speed: 60-80 km/h average
- Air speed: 500-700 km/h average
- Road cost: $0.50-$1.50 per kg per 100km
- Air cost: $2.50-$5.00 per kg per 100km
- Weight distribution: 80% orders <500kg, 15% 500-2000kg, 5% >2000kg
- Delivery time requirements: 30% express (<24h), 50% standard (24-72h), 20% economy (>72h)

**Add Noise and Anomalies:**
- 5% of orders have unusual weight/volume ratios
- 3% extreme weather events causing major delays
- 2% capacity shortage situations
- Random traffic incidents affecting specific routes

### Implementation Code Structure

```python
class DataGenerator:
    def __init__(self, num_nodes=30, num_orders=5000, days=90):
        pass
    
    def generate_network(self) -> nx.Graph:
        """Create network topology with realistic distances"""
        pass
    
    def generate_nodes(self) -> pd.DataFrame:
        """Generate node properties"""
        pass
    
    def generate_distance_matrix(self) -> pd.DataFrame:
        """Calculate distances and costs between all node pairs"""
        pass
    
    def simulate_orders(self) -> pd.DataFrame:
        """Generate orders with temporal patterns"""
        pass
    
    def generate_weather_data(self) -> pd.DataFrame:
        """Create weather patterns"""
        pass
    
    def generate_capacity_data(self) -> pd.DataFrame:
        """Simulate transport capacity over time"""
        pass
    
    def add_anomalies(self, df: pd.DataFrame) -> pd.DataFrame:
        """Inject realistic anomalies"""
        pass
    
    def export_all(self, output_dir: str):
        """Save all datasets as CSV files"""
        pass
```

---

## PART 2: ML PIPELINE

### Model 1: Demand Forecasting
**Purpose**: Predict order volume for capacity planning

**Features to engineer:**
- Day of week (one-hot encoded)
- Hour of day
- Week of year
- Moving averages (7-day, 30-day)
- Lag features (1-day, 7-day lag)
- Weather conditions
- Is_holiday (binary)
- Trend component

**Model Options:**
- LightGBM or XGBoost (recommended for speed)
- Prophet for time series
- LSTM/Transformer if using deep learning

**Target**: Number of orders per hour per node

**Required Metrics**: MAPE < 15%

### Model 2: Transport Mode Classifier
**Purpose**: Recommend optimal transport type (road/air/combined)

**Features:**
- Distance between origin-destination
- Weight and volume
- Cargo class
- Required delivery time vs standard delivery time
- Cost difference (air vs road)
- Weather impact factor
- Current capacity utilization
- Time of day

**Model**: Multi-class classification
- Random Forest or XGBoost
- Neural network

**Target**: transport_mode (road=0, air=1, combined=2)

**Required Metrics**: F1-score > 0.85

### Model 3: Delivery Time Predictor
**Purpose**: Estimate actual delivery duration

**Features:**
- Transport mode
- Distance
- Weight
- Weather conditions
- Day of week, hour
- Traffic patterns (peak/off-peak)
- Node congestion levels

**Model**: Regression
- Gradient Boosting
- Neural network

**Target**: delivery_duration_hours

**Required Metrics**: RMSE, MAE, R²

### Model 4: Cost Predictor
**Purpose**: Estimate total delivery cost

**Features:**
- Distance
- Weight and volume
- Transport mode
- Fuel price variations (simulate)
- Demand level (capacity utilization)

**Model**: Regression

**Target**: total_cost

### Implementation Structure

```python
class MLPipeline:
    def __init__(self):
        self.demand_model = None
        self.transport_classifier = None
        self.time_predictor = None
        self.cost_predictor = None
    
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Feature engineering"""
        pass
    
    def train_demand_forecaster(self, train_data):
        """Train demand prediction model"""
        pass
    
    def train_transport_classifier(self, train_data):
        """Train transport mode selector"""
        pass
    
    def train_time_predictor(self, train_data):
        """Train delivery time model"""
        pass
    
    def train_cost_predictor(self, train_data):
        """Train cost estimation model"""
        pass
    
    def evaluate_models(self, test_data) -> dict:
        """Calculate all metrics"""
        pass
    
    def save_models(self, output_dir: str):
        """Serialize trained models"""
        pass
```

---

## PART 3: ROUTE OPTIMIZATION ENGINE

### Multi-Criteria Optimization Function

**Objective**: Find optimal routes considering:
1. **Minimize cost**
2. **Minimize time**
3. **Maximize reliability**
4. **Maximize capacity utilization**

**Algorithm Requirements:**
- Must handle 100+ nodes
- Response time < 300ms
- Support for multi-modal routing (road → air → road)

### Recommended Approach

**Option 1: Modified Dijkstra with ML scoring**
```python
def calculate_edge_score(edge, cargo_specs, preferences):
    """
    Weighted scoring function:
    score = w1 * (1/time_normalized) + 
            w2 * (1/cost_normalized) + 
            w3 * reliability + 
            w4 * capacity_utilization
    
    Use ML models to predict time and cost
    """
    pass
```

**Option 2: OR-Tools VRP Solver**
```python
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

def solve_vrp(distance_matrix, time_matrix, cost_matrix, constraints):
    """Use Google OR-Tools for Vehicle Routing Problem"""
    pass
```

**Option 3: A* Search with ML heuristic**
```python
def a_star_routing(graph, start, end, cargo_specs, ml_models):
    """A* with learned heuristic function"""
    pass
```

### Constraint Handling

Must respect:
- **Time windows**: Delivery by required_delivery_time
- **Capacity constraints**: Vehicle/aircraft capacity limits
- **Budget constraints**: max_budget from request
- **Cargo restrictions**: Fragile cargo needs special handling
- **Transfer limits**: Maximum 2 transfers for combined routes

### Multi-Modal Route Construction

For "combined" transport mode:
1. Find transfer hubs with both road and air access
2. Split route: origin → hub (road) → hub → destination (air)
3. Or: origin → hub (air) → hub → destination (road)
4. Calculate total cost and time including transfer delays (2-4 hours)

### Implementation Structure

```python
class RouteOptimizer:
    def __init__(self, graph, ml_models, distance_matrix):
        self.graph = graph
        self.ml_models = ml_models
        self.distance_matrix = distance_matrix
    
    def optimize_delivery(
        self, 
        origin_id, 
        destination_id, 
        cargo_specs, 
        preferences
    ) -> List[Route]:
        """
        Main optimization function
        Returns top 3 alternative routes sorted by preference
        """
        pass
    
    def find_unimodal_routes(self, origin, dest, mode) -> List[Route]:
        """Find best routes using single transport mode"""
        pass
    
    def find_multimodal_routes(self, origin, dest) -> List[Route]:
        """Find routes combining road and air"""
        pass
    
    def calculate_route_score(self, route, preferences) -> float:
        """Score route based on optimize_for preference"""
        pass
    
    def predict_route_metrics(self, route) -> dict:
        """Use ML models to predict time, cost, reliability"""
        pass
    
    def check_constraints(self, route, constraints) -> bool:
        """Validate route against all constraints"""
        pass
```

---

## PART 4: REST API SERVICE

### API Specification

**Endpoint**: `POST /api/v1/optimize`

**Request Format** (exactly as specified):
```json
{
  "shipment": {
    "origin_id": "NODE_XXX",
    "destination_id": "NODE_YYY",
    "weight_kg": 1500,
    "volume_m3": 10,
    "cargo_class": "standard",
    "required_delivery": "2024-12-20T15:00:00Z"
  },
  "preferences": {
    "optimize_for": "balanced",
    "max_budget": 50000,
    "allow_multimodal": true
  }
}
```

**Response Format** (exactly as specified):
```json
{
  "recommendations": [
    {
      "route_id": "uuid-here",
      "transport_modes": ["road", "air"],
      "segments": [
        {
          "mode": "road",
          "from": "NODE_XXX",
          "to": "TRANSFER_HUB_1",
          "duration_hours": 8,
          "cost": 15000
        },
        {
          "mode": "air",
          "from": "TRANSFER_HUB_1",
          "to": "NODE_YYY",
          "duration_hours": 10,
          "cost": 30000
        }
      ],
      "total_cost": 45000,
      "total_duration_hours": 18,
      "reliability_score": 0.92,
      "ml_confidence": 0.87
    }
  ],
  "analytics": {
    "cost_breakdown": {
      "transport": 42000,
      "handling": 2000,
      "fuel_surcharge": 1000
    },
    "risk_factors": [
      "Weather conditions moderate at destination",
      "Peak hour traffic expected on road segment"
    ],
    "alternative_routes": 3
  }
}
```

### Additional Endpoints

**GET** `/api/v1/health` - Health check
**GET** `/api/v1/metrics` - System metrics (response times, throughput)
**POST** `/api/v1/batch` - Batch order optimization

### Implementation Framework

**Use FastAPI** (recommended) or Flask

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Logistics Optimization API")

class Shipment(BaseModel):
    origin_id: str
    destination_id: str
    weight_kg: float
    volume_m3: float
    cargo_class: str
    required_delivery: str

class Preferences(BaseModel):
    optimize_for: str
    max_budget: float
    allow_multimodal: bool

class OptimizationRequest(BaseModel):
    shipment: Shipment
    preferences: Preferences

@app.post("/api/v1/optimize")
async def optimize_route(request: OptimizationRequest):
    """
    Main optimization endpoint
    Must respond in < 300ms
    """
    pass

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Performance Requirements

- **Response time**: < 300ms for single route optimization
- **Throughput**: Handle 100+ requests per second
- **ML Model Loading**: Load models at startup (not per request)
- **Caching**: Cache distance matrix and network graph in memory

---

## PART 5: DOCKER CONTAINERIZATION

### Dockerfile

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Preload models and data
RUN python -c "from app import load_models; load_models()"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose (optional but recommended)

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MODEL_PATH=/app/models
      - DATA_PATH=/app/data
    volumes:
      - ./models:/app/models
      - ./data:/app/data
```

---

## PART 6: TESTING & VALIDATION

### Unit Tests
- Test data generator functions
- Test ML model predictions
- Test route optimization logic
- Test API endpoints

### Integration Tests
- End-to-end API flow
- Multi-modal routing scenarios
- Edge cases (extreme weights, tight deadlines)

### Performance Tests
```python
def test_response_time():
    """Ensure < 300ms response"""
    import time
    start = time.time()
    response = optimize_route(sample_request)
    duration = time.time() - start
    assert duration < 0.3
```

### Test Coverage
Aim for >70% code coverage

---

## PART 7: DOCUMENTATION

### README.md Structure

```markdown
# Multi-Modal Logistics Optimization System

## Overview
[Brief description]

## Architecture
[Diagram or description of system components]

## Data Generation Approach
[How synthetic data was created, assumptions made]

## ML Models
- Demand Forecasting: [Model type, accuracy metrics]
- Transport Classifier: [Model type, F1-score]
- Time Predictor: [Model type, RMSE]
- Cost Predictor: [Model type, MAE]

## Optimization Algorithm
[Description of routing algorithm, complexity analysis]

## Installation
```bash
git clone [repo]
cd logistics-optimization
pip install -r requirements.txt
```

## Running the System

### Generate Data
```bash
python scripts/generate_data.py --nodes 30 --orders 5000 --days 90
```

### Train Models
```bash
python scripts/train_models.py
```

### Start API
```bash
docker-compose up
# OR
uvicorn app.main:app --reload
```

## API Usage
[Include curl examples and Postman collection]

## Testing
```bash
pytest tests/ -v --cov=app
```

## Performance Metrics
- Average response time: [X]ms
- Model accuracies: [list]
- Optimization quality: [%]

## Team
[Your team info]
```

---

## PART 8: BONUS FEATURES (for extra 20%)

### 1. Real-Time Adaptation
```python
@app.post("/api/v1/reoptimize")
async def reoptimize_route(route_id: str, new_conditions: dict):
    """
    Recalculate route when conditions change:
    - Weather updates
    - Traffic incidents
    - Capacity changes
    """
    pass
```

### 2. Explainable AI
```python
import shap

def explain_route_decision(route, features):
    """
    Use SHAP to explain why this route was chosen
    Return top factors influencing the decision
    """
    explainer = shap.TreeExplainer(transport_classifier)
    shap_values = explainer.shap_values(features)
    return {
        "top_factors": [...],
        "feature_importance": {...}
    }
```

### 3. Reinforcement Learning Router
```python
class RLRouter:
    """
    Use Q-learning or PPO to learn optimal routing policy
    Agent learns from:
    - Successful deliveries (positive reward)
    - Delays (negative reward)
    - Cost efficiency (reward)
    """
    pass
```

### 4. Stress Testing
```python
def simulate_black_friday():
    """Generate 10x normal order volume"""
    pass

def simulate_air_transport_outage(outage_percent=50):
    """Reduce air capacity by 50%"""
    pass

def test_cascading_failures():
    """Simulate hub failures and rerouting"""
    pass
```

---

## CRITICAL SUCCESS FACTORS

### Dataset Quality (25% of score)
✓ 5000+ realistic orders
✓ 30+ nodes with proper connectivity
✓ 90+ days of historical data
✓ Realistic temporal patterns (peaks, seasonality)
✓ 5-10% anomalies and edge cases
✓ Comprehensive feature set

### Optimization Algorithm (35% of score)
✓ Finds near-optimal routes
✓ Handles all constraint types
✓ Scales to 100+ nodes
✓ Responds in < 300ms
✓ Supports multi-modal routing

### ML Models (25% of score)
✓ MAPE < 15% for forecasting
✓ F1 > 0.85 for classification
✓ Good feature engineering
✓ Model interpretability
✓ Proper train/test split and validation

### Engineering Quality (15% of score)
✓ Clean, modular code
✓ Comprehensive documentation
✓ Working Docker container
✓ API matches specification exactly
✓ Test coverage >70%
✓ Postman collection included

---

## PROJECT STRUCTURE

```
logistics-optimization/
├── data/
│   ├── raw/
│   │   ├── nodes.csv
│   │   ├── distances.csv
│   │   ├── orders.csv
│   │   ├── weather.csv
│   │   └── capacity.csv
│   └── processed/
│       └── features.csv
├── models/
│   ├── demand_forecaster.pkl
│   ├── transport_classifier.pkl
│   ├── time_predictor.pkl
│   └── cost_predictor.pkl
├── notebooks/
│   ├── 01_data_generation.ipynb
│   ├── 02_eda.ipynb
│   ├── 03_model_training.ipynb
│   └── 04_optimization_experiments.ipynb
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── optimizer.py
│   └── utils.py
├── scripts/
│   ├── generate_data.py
│   └── train_models.py
├── tests/
│   ├── test_api.py
│   ├── test_optimizer.py
│   └── test_models.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── README.md
└── postman_collection.json
```

---

## REQUIREMENTS.TXT

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pandas==2.1.3
numpy==1.26.2
scikit-learn==1.3.2
xgboost==2.0.2
lightgbm==4.1.0
networkx==3.2.1
ortools==9.8.3296
shap==0.43.0
pytest==7.4.3
pytest-cov==4.1.0
requests==2.31.0
python-dateutil==2.8.2
faker==20.1.0
```

---

## EXECUTION CHECKLIST

### Day 1: Data Generation & EDA
- [ ] Create network topology (30+ nodes)
- [ ] Generate distance matrix with road/air options
- [ ] Simulate 5000+ orders with temporal patterns
- [ ] Add weather and capacity data
- [ ] Inject anomalies (5-10%)
- [ ] Validate data quality
- [ ] Create EDA notebook

### Day 2: ML Pipeline
- [ ] Feature engineering
- [ ] Train demand forecaster (MAPE < 15%)
- [ ] Train transport classifier (F1 > 0.85)
- [ ] Train time/cost predictors
- [ ] Validate models on test set
- [ ] Save trained models

### Day 3: Optimization Engine
- [ ] Implement routing algorithm
- [ ] Add multi-modal support
- [ ] Handle all constraints
- [ ] Optimize for <300ms response
- [ ] Test on 100+ node network

### Day 4: API Development
- [ ] Create FastAPI application
- [ ] Implement /optimize endpoint
- [ ] Match exact API specification
- [ ] Add error handling
- [ ] Create Postman collection
- [ ] Write unit tests

### Day 5: Deployment & Documentation
- [ ] Create Dockerfile
- [ ] Test Docker build and run
- [ ] Write comprehensive README
- [ ] Add code comments
- [ ] Create demo examples
- [ ] Final testing
- [ ] (Optional) Implement bonus features

---

## VALIDATION BEFORE SUBMISSION

Run these checks:

```bash
# 1. Data validation
python scripts/validate_data.py

# 2. Model metrics
python scripts/evaluate_models.py

# 3. API tests
pytest tests/ -v

# 4. Performance test
python tests/test_performance.py

# 5. Docker build
docker build -t logistics-api .
docker run -p 8000:8000 logistics-api

# 6. Manual API test
curl -X POST http://localhost:8000/api/v1/optimize \
  -H "Content-Type: application/json" \
  -d @sample_request.json
```

---

## FINAL DELIVERABLES CHECKLIST

- [ ] **Data Generator**: Python script + documentation
- [ ] **Synthetic Dataset**: All CSV files (nodes, orders, distances, weather, capacity)
- [ ] **Trained Models**: All 4 models saved in /models/
- [ ] **Notebooks**: With experiments and metrics
- [ ] **API Service**: Working FastAPI application
- [ ] **Docker Container**: Builds and runs successfully
- [ ] **Postman Collection**: For API testing
- [ ] **README.md**: Complete documentation
- [ ] **Tests**: >70% coverage
- [ ] **GitHub Repository**: Clean, organized code

---

## SUCCESS CRITERIA

Your submission will score 100% if:

1. **Dataset**: 5000+ orders, 30+ nodes, 90+ days, realistic patterns ✓
2. **ML Models**: MAPE <15%, proper feature engineering ✓
3. **Optimization**: <300ms response, handles constraints, multi-modal support ✓
4. **API**: Matches specification exactly, works in Docker ✓
5. **Code Quality**: Clean, documented, tested ✓
6. **Documentation**: Clear setup and usage instructions ✓

---

Now execute this plan step by step. Start with data generation, validate each component before moving to the next, and ensure all requirements are met. Good luck! 🚀