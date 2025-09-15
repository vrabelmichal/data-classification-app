# ingest_client.py
import os
import json
import time
import uuid
import random
from typing import List, Dict, Any, Optional

import requests


def get_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def make_mock_galaxies(n: int = 2, seed: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Generate n unique mock galaxies.
    Fields match your Convex schema and can be swapped for real data later.
    """
    if seed is not None:
        random.seed(seed)

    galaxies: List[Dict[str, Any]] = []
    now_suffix = int(time.time())

    for i in range(n):
        # Create a unique, deterministic-ish external ID
        gid = f"mock-{now_suffix}-{i}-{uuid.uuid4().hex[:8]}"

        ra = random.uniform(0.0, 360.0)  # degrees
        dec = random.uniform(-90.0, 90.0)  # degrees
        reff = round(random.uniform(0.1, 10.0), 3)
        q = round(random.uniform(0.1, 1.0), 3)  # axis ratio
        pa = round(random.uniform(0.0, 180.0), 2)  # degrees
        nucleus = random.choice([True, False])

        galaxy = {
            "id": gid,
            "ra": ra,
            "dec": dec,
            "reff": reff,
            "q": q,
            "pa": pa,
            "nucleus": nucleus,
            # Optional fields (include some to exercise validation)
            # "imageUrl": f"https://images.example/galaxies/{gid}.png",
            # Leave others out by default; add as needed
            # "isActive": True,
            # "redshift_x": 0.023,
            # "redshift_y": 0.024,
            # "x": 123.4,
            # "y": 567.8,
        }

        galaxies.append(galaxy)

    return galaxies


def build_payload(galaxies: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"galaxies": galaxies}


def send_ingest(
    convex_url: str,
    ingest_token: str,
    payload: Dict[str, Any],
    timeout_sec: int = 60,
) -> requests.Response:
    url = f"{convex_url.rstrip('/')}/ingest/galaxies"
    headers = {
        "Authorization": f"Bearer {ingest_token}",
        "Content-Type": "application/json",
    }

    print(f"POST {url} ...")

    return requests.post(
        url, headers=headers, data=json.dumps(payload), timeout=timeout_sec
    )


def main() -> None:
    convex_url = get_env("VITE_CONVEX_HTTP_ACTIONS_URL")
    ingest_token = get_env("INGEST_TOKEN")

    # Generate mock data (change n as needed)
    galaxies = make_mock_galaxies(n=5)
    payload = build_payload(galaxies)

    print(f"Sending {len(galaxies)} galaxies to {convex_url}/ingest/galaxies ...")
    resp = send_ingest(convex_url, ingest_token, payload)
    print(f"Status: {resp.status_code}")
    try:
        print("Response:", json.dumps(resp.json(), indent=2))
    except Exception:
        print("Raw response:", resp.text)


if __name__ == "__main__":
    main()
