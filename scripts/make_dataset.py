import argparse
from pathlib import Path
import sys

# Ensure project root is on sys.path when running as a script
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd

from data_generator.generate_data import DataGenerator, to_dataframes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=40)
    parser.add_argument("--days", type=int, default=120)
    parser.add_argument("--out", type=str, default="data/")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    gen = DataGenerator(seed=42)
    G = gen.generate_network(nodes=args.nodes)
    nodes_df, edges_df = to_dataframes(G)
    orders = gen.simulate_orders(days=args.days, pattern="seasonal")
    orders = gen.add_noise_and_anomalies(orders)

    nodes_df.to_csv(out_dir / "nodes.csv", index=False)
    edges_df.to_csv(out_dir / "edges.csv", index=False)
    orders.to_csv(out_dir / "orders.csv", index=False)

    print(f"Saved dataset to {out_dir.resolve()}\n- nodes.csv ({len(nodes_df)})\n- edges.csv ({len(edges_df)})\n- orders.csv ({len(orders)})")


if __name__ == "__main__":
    main()

