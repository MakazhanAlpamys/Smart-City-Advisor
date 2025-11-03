from fastapi import FastAPI
from uuid import uuid4
from typing import Dict

from api.schemas import (
    OptimizeRequest,
    OptimizeResponse,
    Recommendation,
    Segment,
    Analytics,
    BatchOrdersRequest,
    PredictDemandRequest,
    PredictDemandResponse,
    RecalculateRequest,
)

# Lazy imports to speed cold start
def get_optimizer():
    from optimizer.optimizer import optimize_delivery, batch_orders, load_graph

    return optimize_delivery, batch_orders, load_graph


app = FastAPI(title="Biny AI Logistics Optimizer", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/optimize_route", response_model=OptimizeResponse)
def optimize_route(req: OptimizeRequest) -> OptimizeResponse:
    optimize_delivery, _batch_orders, load_graph = get_optimizer()
    graph = load_graph()
    results = optimize_delivery(
        graph=graph,
        origin=req.shipment.origin_id,
        destination=req.shipment.destination_id,
        cargo_specs={
            "weight_kg": req.shipment.weight_kg,
            "volume_m3": req.shipment.volume_m3,
            "cargo_class": req.shipment.cargo_class,
        },
        preferences=req.preferences.model_dump(),
        constraints={"max_budget": req.preferences.max_budget},
    )

    recs = []
    for r in results:
        segs = [
            Segment(
                mode=s["mode"],
                **{"from": s["from"]},
                to=s["to"],
                duration_hours=s["duration_hours"],
                cost=s["cost"],
            )
            for s in r["segments"]
        ]
        recs.append(
            Recommendation(
                route_id=str(uuid4()),
                transport_modes=r["transport_modes"],
                segments=segs,
                total_cost=r["total_cost"],
                total_duration_hours=r["total_duration_hours"],
                reliability_score=r["reliability_score"],
                ml_confidence=r.get("ml_confidence", 0.8),
            )
        )

    return OptimizeResponse(
        recommendations=recs,
        analytics=Analytics(cost_breakdown={}, risk_factors=[], alternative_routes=len(recs)),
    )


@app.post("/batch_orders")
def batch_orders_endpoint(req: BatchOrdersRequest):
    _, batch_orders_fn, _ = get_optimizer()
    batches = batch_orders_fn(req.orders, req.window_minutes)
    return {"num_batches": len(batches), "batches": batches}


@app.post("/predict_demand", response_model=PredictDemandResponse)
def predict_demand(req: PredictDemandRequest) -> PredictDemandResponse:
    # Minimal stub: uniform demand; replaced by trained model later
    nodes = req.node_ids or [f"NODE_{i:03d}" for i in range(30)]
    preds = {n: [20.0] * req.horizon_days for n in nodes}
    return PredictDemandResponse(predictions=preds)


@app.post("/recalculate", response_model=OptimizeResponse)
def recalculate(req: RecalculateRequest) -> OptimizeResponse:
    optimize_delivery, _batch_orders, load_graph = get_optimizer()
    graph = load_graph(closed_nodes=set(req.closed_nodes), closed_edges=set(tuple(e) for e in req.closed_edges))

    # Example only: this would require original shipment context
    dummy = OptimizeRequest(
        shipment={
            "origin_id": "NODE_000",
            "destination_id": "NODE_001",
            "weight_kg": 100.0,
            "volume_m3": 1.0,
            "cargo_class": "standard",
        },
        preferences=(req.preferences or {"optimize_for": "balanced", "allow_multimodal": True}),
    )
    return optimize_route(dummy)  # type: ignore


@app.get("/get_analytics")
def get_analytics():
    return {"status": "ok", "routes_served": 0, "avg_latency_ms": 10}

