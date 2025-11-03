from pathlib import Path
import joblib
from typing import Any, Dict


def load_model(path: str):
    p = Path(path)
    if not p.exists():
        return None
    return joblib.load(p)


def predict_demand(model, features) -> Any:
    return model.predict(features) if model is not None else None


def predict_transport(model, features) -> Any:
    return model.predict(features) if model is not None else None


def predict_eta_cost(model_time, model_cost, features_time, features_cost) -> Dict[str, float]:
    pred_t = model_time.predict(features_time)[0] if model_time is not None else 1.0
    pred_c = model_cost.predict(features_cost)[0] if model_cost is not None else 1000.0
    return {"duration_hours": float(pred_t), "cost": float(pred_c)}

