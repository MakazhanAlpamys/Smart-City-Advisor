from optimizer.optimizer import load_graph, optimize_delivery


def test_optimize_delivery_returns_alternatives():
    G = load_graph()
    results = optimize_delivery(
        graph=G,
        origin="NODE_000",
        destination="NODE_010",
        cargo_specs={"weight_kg": 100, "volume_m3": 1, "cargo_class": "standard"},
        preferences={"optimize_for": "balanced"},
        constraints={"max_budget": 100000},
    )
    assert isinstance(results, list) and len(results) >= 1
    first = results[0]
    assert "segments" in first and first["total_cost"] > 0

