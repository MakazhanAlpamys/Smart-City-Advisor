from pathlib import Path
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib


def make_features(edges_csv: str) -> pd.DataFrame:
    edges = pd.read_csv(edges_csv)
    edges["is_air"] = (edges["mode"] == "air").astype(int)
    X = edges[["distance_km", "duration_h", "cost"]]
    y = edges["is_air"]
    return X, y


def train(edges_csv: str, out_model_path: str = "models/transport_rf.pkl") -> str:
    X, y = make_features(edges_csv)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)
    Path(out_model_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_model_path)
    return out_model_path


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--edges", required=True)
    p.add_argument("--out", default="models/transport_rf.pkl")
    args = p.parse_args()
    path = train(args.edges, args.out)
    print(f"Saved transport selector model to {path}")

