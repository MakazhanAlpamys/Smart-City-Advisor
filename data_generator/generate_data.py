import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import networkx as nx
import numpy as np
import pandas as pd
from faker import Faker


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class DataGenerator:
    seed: int = 42

    def __post_init__(self):
        random.seed(self.seed)
        np.random.seed(self.seed)
        self.faker = Faker()
        self.faker.seed_instance(self.seed)

    def generate_network(self, nodes: int = 30) -> nx.Graph:
        G = nx.Graph()
        centers = []
        for i in range(nodes):
            # Synthetic lat/lon around a central area
            lat = 43.0 + np.random.uniform(-2, 2)
            lon = 76.0 + np.random.uniform(-2, 2)
            node_id = f"NODE_{i:03d}"
            hub_type = "air" if i % 7 == 0 else "road"
            G.add_node(node_id, lat=lat, lon=lon, hub_type=hub_type)
            centers.append((lat, lon))

        # Connect k-nearest neighbors
        k = min(5, max(3, nodes // 10 + 2))
        for i in range(nodes):
            for j in range(i + 1, nodes):
                ni, nj = f"NODE_{i:03d}", f"NODE_{j:03d}"
                li, lo = G.nodes[ni]["lat"], G.nodes[ni]["lon"]
                lj, lo2 = G.nodes[nj]["lat"], G.nodes[nj]["lon"]
                d = haversine_km(li, lo, lj, lo2)
                if d < 600:  # sparse but connected
                    # mode availability
                    modes = ["road"]
                    if G.nodes[ni]["hub_type"] == "air" and G.nodes[nj]["hub_type"] == "air" and d > 200:
                        modes.append("air")
                    speed_kmph = {"road": 60.0, "air": 650.0}
                    for mode in modes:
                        duration_h = d / speed_kmph[mode]
                        base_cost = (d * (2.0 if mode == "road" else 5.0))
                        G.add_edge(ni, nj, mode=mode, distance_km=d, duration_h=duration_h, cost=base_cost)

        return G

    def simulate_orders(self, days: int, pattern: str = "seasonal") -> pd.DataFrame:
        start = datetime.utcnow() - timedelta(days=days)
        rows = []
        for day in range(days):
            cur = start + timedelta(days=day)
            weekday = cur.weekday()

            season_factor = 1.0
            if pattern == "seasonal":
                # 3 seasons with multipliers
                if 0 <= day % 90 < 30:
                    season_factor = 0.9
                elif 30 <= day % 90 < 60:
                    season_factor = 1.0
                else:
                    season_factor = 1.2

            base = int(200 * season_factor)
            if weekday >= 5:
                base = int(base * 0.6)  # weekends lower

            # trend +5% per month
            trend = 1.0 + (day / 30) * 0.05
            num_orders = int(base * trend)

            for _ in range(num_orders):
                hour = np.random.choice(list(range(24)), p=self._hourly_probs())
                src = f"NODE_{np.random.randint(0, 30):03d}"
                dst = f"NODE_{np.random.randint(0, 30):03d}"
                if src == dst:
                    continue
                weight = float(np.clip(np.random.normal(500, 400), 50, 5000))
                volume = float(np.clip(np.random.normal(3, 2), 0.1, 20))
                cargo_class = np.random.choice(["standard", "express", "fragile"], p=[0.7, 0.2, 0.1])

                # weather impact and anomalies
                weather = np.random.choice(["clear", "rain", "snow"], p=[0.7, 0.25, 0.05])
                delay_factor = 1.0
                if weather == "rain":
                    delay_factor = 1.3
                elif weather == "snow":
                    delay_factor = 1.6

                is_anomaly = np.random.rand() < 0.08

                rows.append(
                    dict(
                        ts=(cur.replace(hour=hour, minute=0, second=0, microsecond=0)).isoformat(),
                        origin_id=src,
                        destination_id=dst,
                        weight_kg=weight,
                        volume_m3=volume,
                        cargo_class=cargo_class,
                        weather=weather,
                        delay_factor=delay_factor,
                        is_anomaly=is_anomaly,
                    )
                )

        return pd.DataFrame(rows)

    def add_noise_and_anomalies(self, data: pd.DataFrame) -> pd.DataFrame:
        data = data.copy()
        # 5-10% random cancellations / extreme delays
        mask = np.random.rand(len(data)) < 0.07
        data.loc[mask, "is_cancelled"] = True
        data["is_cancelled"].fillna(False, inplace=True)
        return data

    def _hourly_probs(self) -> List[float]:
        probs = np.array([1] * 24, dtype=float)
        probs[6:10] += 2  # morning peak
        probs[17:21] += 2  # evening peak
        probs /= probs.sum()
        return probs.tolist()


def to_dataframes(G: nx.Graph) -> Tuple[pd.DataFrame, pd.DataFrame]:
    nodes = []
    for n, attrs in G.nodes(data=True):
        nodes.append(dict(node_id=n, **attrs))
    edges = []
    for u, v, attrs in G.edges(data=True):
        edges.append(dict(src=u, dst=v, **attrs))
    return pd.DataFrame(nodes), pd.DataFrame(edges)

