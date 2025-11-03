from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Set, Tuple
import uuid

import networkx as nx
import numpy as np


def load_graph(closed_nodes: Optional[Set[str]] = None, closed_edges: Optional[Set[Tuple[str, str]]] = None) -> nx.Graph:
    # Minimal synthetic graph; replace by loading from persisted dataset if available
    G = nx.Graph()
    for i in range(30):
        G.add_node(f"NODE_{i:03d}")
    for i in range(29):
        G.add_edge(f"NODE_{i:03d}", f"NODE_{i+1:03d}", mode="road", distance_km=50 + 2 * i, duration_h=1 + i * 0.05, cost=200 + 5 * i)
    # some cross links
    G.add_edge("NODE_000", "NODE_010", mode="air", distance_km=800, duration_h=1.3, cost=4000)
    G.add_edge("NODE_015", "NODE_029", mode="air", distance_km=700, duration_h=1.2, cost=3800)

    closed_nodes = closed_nodes or set()
    closed_edges = closed_edges or set()
    for n in list(closed_nodes):
        if n in G:
            G.remove_node(n)
    for (u, v) in list(closed_edges):
        if G.has_edge(u, v):
            G.remove_edge(u, v)
    return G


def _weight(u: str, v: str, attrs: Dict[str, Any], alpha: float, beta: float) -> float:
    # alpha -> time weight, beta -> cost weight
    return alpha * float(attrs.get("duration_h", 1.0)) + beta * float(attrs.get("cost", 1.0)) / 1000.0


def optimize_delivery(
    graph: nx.Graph,
    origin: str,
    destination: str,
    cargo_specs: Dict[str, Any],
    preferences: Dict[str, Any],
    constraints: Optional[Dict[str, Any]] = None,
    k_alternatives: int = 3,
) -> List[Dict[str, Any]]:
    optimize_for = preferences.get("optimize_for", "balanced")
    if optimize_for == "time":
        alpha, beta = 0.7, 0.3
    elif optimize_for == "cost":
        alpha, beta = 0.2, 0.8
    else:
        alpha, beta = 0.5, 0.5

    # k-shortest paths (Yen's algorithm fallback if available)
    try:
        paths = list(nx.shortest_simple_paths(graph, origin, destination, weight=lambda u, v, d: _weight(u, v, d, alpha, beta)))
    except nx.NetworkXNoPath:
        return []

    results: List[Dict[str, Any]] = []
    for path in paths[: k_alternatives * 2]:
        segments: List[Dict[str, Any]] = []
        total_cost = 0.0
        total_duration = 0.0
        modes: List[str] = []
        for u, v in zip(path[:-1], path[1:]):
            d = graph.get_edge_data(u, v)
            mode = d.get("mode", "road")
            modes.append(mode)
            segments.append(
                {
                    "mode": mode,
                    "from": u,
                    "to": v,
                    "duration_hours": float(d.get("duration_h", 1.0)),
                    "cost": float(d.get("cost", 100.0)),
                }
            )
            total_cost += float(d.get("cost", 100.0))
            total_duration += float(d.get("duration_h", 1.0))

        reliability = max(0.5, 1.0 - 0.02 * len(path))
        if constraints and constraints.get("max_budget") and total_cost > constraints["max_budget"]:
            continue

        score = _score(total_duration, total_cost, reliability, optimize_for)
        results.append(
            {
                "id": str(uuid.uuid4()),
                "transport_modes": list(dict.fromkeys(modes)),
                "segments": segments,
                "total_cost": round(total_cost, 2),
                "total_duration_hours": round(total_duration, 2),
                "reliability_score": round(reliability, 2),
                "score": score,
                "ml_confidence": 0.85,
            }
        )

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:k_alternatives]


def _score(total_time: float, total_cost: float, reliability: float, optimize_for: str) -> float:
    # Normalized inverse metrics; weights are dynamic as a simple example
    w_time, w_cost, w_rel = (0.6, 0.3, 0.1) if optimize_for == "time" else (0.3, 0.6, 0.1) if optimize_for == "cost" else (0.4, 0.4, 0.2)
    st = 1.0 / (1.0 + total_time)
    sc = 1.0 / (1.0 + total_cost / 1000.0)
    return w_time * st + w_cost * sc + w_rel * reliability


def batch_orders(orders: Sequence[Dict[str, Any]], window_minutes: int = 120) -> List[List[Dict[str, Any]]]:
    # Simple grouping by (origin, destination) and hour window
    from collections import defaultdict
    groups: Dict[Tuple[str, str, int], List[Dict[str, Any]]] = defaultdict(list)
    for o in orders:
        hour = 0
        if "ts" in o:
            # expect ISO-8601 timestamp
            hour = int(o["ts"][11:13])
        key = (o["origin_id"], o["destination_id"], hour - (hour % max(1, window_minutes // 60)))
        groups[key].append(o)
    return list(groups.values())

