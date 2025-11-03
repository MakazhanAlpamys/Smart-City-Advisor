from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any


class Shipment(BaseModel):
    origin_id: str
    destination_id: str
    weight_kg: float
    volume_m3: float
    cargo_class: Literal["standard", "express", "fragile"]
    required_delivery: Optional[str] = None


class Preferences(BaseModel):
    optimize_for: Literal["cost", "time", "balanced"] = "balanced"
    max_budget: Optional[float] = None
    allow_multimodal: bool = True


class OptimizeRequest(BaseModel):
    shipment: Shipment
    preferences: Preferences


class Segment(BaseModel):
    mode: Literal["road", "air"]
    from_: str = Field(alias="from")
    to: str
    duration_hours: float
    cost: float

    class Config:
        populate_by_name = True


class Recommendation(BaseModel):
    route_id: str
    transport_modes: List[Literal["road", "air"]]
    segments: List[Segment]
    total_cost: float
    total_duration_hours: float
    reliability_score: float
    ml_confidence: float


class Analytics(BaseModel):
    cost_breakdown: Dict[str, float] = {}
    risk_factors: List[str] = []
    alternative_routes: int = 0


class OptimizeResponse(BaseModel):
    recommendations: List[Recommendation]
    analytics: Analytics


class BatchOrdersRequest(BaseModel):
    orders: List[Shipment]
    window_minutes: int = 120


class PredictDemandRequest(BaseModel):
    horizon_days: int = 7
    node_ids: Optional[List[str]] = None


class PredictDemandResponse(BaseModel):
    predictions: Dict[str, List[float]]  # node_id -> daily volumes


class RecalculateRequest(BaseModel):
    route_id: str
    closed_nodes: List[str] = []
    closed_edges: List[List[str]] = []  # [[from, to], ...]
    preferences: Optional[Preferences] = None
    additional_constraints: Optional[Dict[str, Any]] = None

