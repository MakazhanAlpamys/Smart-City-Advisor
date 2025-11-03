from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor
import joblib


def train(edges_csv: str, out_time_model: str = "models/eta_xgb.pkl", out_cost_model: str = "models/cost_xgb.pkl") -> str:
    edges = pd.read_csv(edges_csv)
    X = edges[["distance_km"]]
    y_time = edges["duration_h"]
    y_cost = edges["cost"]

    X_train, X_test, yt_tr, yt_te = train_test_split(X, y_time, test_size=0.2, random_state=42)
    _, _, yc_tr, yc_te = train_test_split(X, y_cost, test_size=0.2, random_state=42)

    m_time = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=6)
    m_time.fit(X_train, yt_tr)
    m_cost = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=6)
    m_cost.fit(X_train, yc_tr)

    Path(out_time_model).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(m_time, out_time_model)
    joblib.dump(m_cost, out_cost_model)
    return out_time_model


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--edges", required=True)
    p.add_argument("--out_time", default="models/eta_xgb.pkl")
    p.add_argument("--out_cost", default="models/cost_xgb.pkl")
    args = p.parse_args()
    path = train(args.edges, args.out_time, args.out_cost)
    print(f"Saved models to {args.out_time}, {args.out_cost}")

