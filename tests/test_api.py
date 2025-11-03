import pytest
import httpx
from api.main import app


transport = httpx.ASGITransport(app=app)


@pytest.mark.anyio
async def test_health():
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


@pytest.mark.anyio
async def test_optimize_route():
    payload = {
        "shipment": {
            "origin_id": "NODE_000",
            "destination_id": "NODE_005",
            "weight_kg": 1500,
            "volume_m3": 10,
            "cargo_class": "standard",
        },
        "preferences": {"optimize_for": "balanced", "allow_multimodal": True},
    }
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/optimize_route", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "recommendations" in data and len(data["recommendations"]) >= 1

