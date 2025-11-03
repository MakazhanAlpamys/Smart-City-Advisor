from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from lightgbm import LGBMRegressor
import joblib


def make_features(df: pd.DataFrame) -> pd.DataFrame:
    ts = pd.to_datetime(df["ts"])  # YYYY-MM-DDTHH:MM:SS
    df = df.copy()
    df["dayofweek"] = ts.dt.dayofweek
    df["hour"] = ts.dt.hour
    df["is_peak"] = df["hour"].between(6, 9) | df["hour"].between(17, 20)
    return df[["dayofweek", "hour", "is_peak"]].astype(int)


def train(input_orders_csv: str, out_model_path: str = "models/demand_lgbm.pkl") -> str:
    orders = pd.read_csv(input_orders_csv)
    # Aggregate per node per day (baseline)
    orders["date"] = pd.to_datetime(orders["ts"]).dt.date
    agg = orders.groupby(["origin_id", "date"]).size().reset_index(name="y")
    # Use simple features
    tmp = agg.copy()
    tmp["ts"] = pd.to_datetime(tmp["date"])
    X = make_features(tmp)
    y = tmp["y"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = LGBMRegressor(n_estimators=200, learning_rate=0.05, max_depth=-1)
    model.fit(X_train, y_train)
    Path(out_model_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_model_path)
    return out_model_path


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--orders", required=True)
    p.add_argument("--out", default="models/demand_lgbm.pkl")
    args = p.parse_args()
    path = train(args.orders, args.out)
    print(f"Saved demand model to {path}")

