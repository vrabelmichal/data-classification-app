#!/usr/bin/env python3
"""
Script to ingest galaxy data from a parquet file into Convex database
via the /ingest/galaxies HTTP endpoint.

Priority for configuration:
1. Command line arguments (highest)
2. Dotenv file (.env)
3. Environment variables (fallback)

Expected environment or dotfile variables:
- VITE_CONVEX_HTTP_ACTIONS_URL
- INGEST_TOKEN
"""

import argparse
import os
import sys
import time
import json
import logging
from pathlib import Path
from typing import Dict, List, Any

try:
    import pandas as pd
    import requests
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Missing required dependency: {e}")
    print("Install with: pip install pandas pyarrow requests python-dotenv")
    sys.exit(1)


# --------------------------------------------------------------------------------------
# Logger setup
# --------------------------------------------------------------------------------------
logger = logging.getLogger("scripts.ingest_galaxies_from_table")
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "%Y-%m-%d %H:%M:%S",
)
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


# --------------------------------------------------------------------------------------
# Mapping: Database schema -> Parquet columns
# Prefer __best_available_fit columns over __best_fit
# --------------------------------------------------------------------------------------
COLUMN_MAPPING: Dict[str, str] = {
    "id": "coadd_object_id",
    "ra": "ra",
    "dec": "dec",
    "reff": "sersic_reff_arcsec__best_available_fit",
    "q": "sersic_q__best_available_fit",
    "pa": "sersic_PA__best_available_fit",
    "nucleus": "is_nucleated",
    # "imageUrl": None,  # removed from the schema
    "isActive": None,
    "redshift_x": None,
    "redshift_y": None,
    "x": "sersic_x__best_available_fit",
    "y": "sersic_y__best_available_fit",
}


# --------------------------------------------------------------------------------------
# Config loading and validation
# --------------------------------------------------------------------------------------
def load_configuration(
    convex_http_url_arg: str = None,
    ingest_token_arg: str = None,
) -> Dict[str, str]:
    """
    Load Convex ingestion configuration with priority:
    CLI args > .env file > environment variables
    """

    # Try loading .env if present
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logger.info(f"✓ Loaded environment from {env_path}")

    # Resolve convex URL
    convex_url = (
        convex_http_url_arg
        or os.getenv("VITE_CONVEX_HTTP_ACTIONS_URL")
    )
    ingest_token = ingest_token_arg or os.getenv("INGEST_TOKEN")

    if not convex_url:
        raise ValueError(
            "Convex HTTP Actions URL not provided. "
            "Set --convex-http-actions-url, or ENV VITE_CONVEX_HTTP_ACTIONS_URL, or in .env"
        )
    if not ingest_token:
        raise ValueError(
            "Ingest token not provided. "
            "Set --ingest-token, or ENV INGEST_TOKEN, or in .env"
        )

    convex_url = convex_url.rstrip("/")

    logger.info(f"Resolved configuration:")
    logger.info(f"  VITE_CONVEX_HTTP_ACTIONS_URL = {convex_url}")
    logger.info(f"  INGEST_TOKEN = {'***' if ingest_token else None}")

    return {"convex_url": convex_url, "ingest_token": ingest_token}


# --------------------------------------------------------------------------------------
# Data preparation
# --------------------------------------------------------------------------------------
def validate_parquet_columns(df: pd.DataFrame) -> None:
    """Ensure required parquet columns exist."""
    missing = []
    for db_field, parquet_field in COLUMN_MAPPING.items():
        if parquet_field and parquet_field not in df.columns:
            missing.append((db_field, parquet_field))

    if missing:
        raise ValueError(
            "Missing required columns: "
            + ", ".join([f"{db}->{pq}" for db, pq in missing])
        )

    used = {pq for pq in COLUMN_MAPPING.values() if pq}
    logger.info(f"✓ All required columns present: {used}")


def row_to_galaxy(row: pd.Series) -> Dict[str, Any]:
    """Convert a dataframe row to galaxy record for Convex."""
    galaxy: Dict[str, Any] = {}

    for db_field, parquet_field in COLUMN_MAPPING.items():
        if not parquet_field:
            continue
        if pd.isna(row[parquet_field]):
            continue

        val = row[parquet_field]

        if db_field in ["id", "imageUrl"]:
            galaxy[db_field] = str(val).strip()
        elif db_field in ["nucleus", "isActive"]:
            galaxy[db_field] = bool(val)
        else:
            galaxy[db_field] = float(val)

    return galaxy


# --------------------------------------------------------------------------------------
# HTTP send
# --------------------------------------------------------------------------------------
def send_ingest(
    convex_url: str,
    ingest_token: str,
    galaxies: List[Dict[str, Any]],
    timeout_sec: int = 60,
) -> requests.Response:
    """Send a batch of galaxies to Convex ingestion API."""
    url = f"{convex_url}/ingest/galaxies"
    headers = {
        "Authorization": f"Bearer {ingest_token}",
        "Content-Type": "application/json",
    }
    payload = {"galaxies": galaxies}

    logger.info(f"POST {url} with {len(galaxies)} galaxies")
    return requests.post(url, headers=headers, data=json.dumps(payload), timeout=timeout_sec)


# --------------------------------------------------------------------------------------
# Processing loop
# --------------------------------------------------------------------------------------
def process_parquet(
    df: pd.DataFrame,
    convex_url: str,
    ingest_token: str,
    batch_size: int = 100,
    dry_run: bool = False,
) -> Dict[str, int]:
    """Upload galaxies in batches."""
    stats = {"total": len(df), "inserted": 0, "errors": 0}
    galaxies_batch: List[Dict[str, Any]] = []

    for i, (_, row) in enumerate(df.iterrows()):
        try:
            galaxy = row_to_galaxy(row)
            galaxies_batch.append(galaxy)

            if len(galaxies_batch) >= batch_size or i == len(df) - 1:
                if not dry_run:
                    resp = send_ingest(convex_url, ingest_token, galaxies_batch)
                    if resp.status_code == 200:
                        stats["inserted"] += len(galaxies_batch)
                        logger.info(f"✓ Batch inserted: {len(galaxies_batch)}")
                    else:
                        stats["errors"] += len(galaxies_batch)
                        logger.error(f"❌ Ingest failed: {resp.status_code} {resp.text}")
                else:
                    logger.info(f"🔍 DRY RUN: Would insert {len(galaxies_batch)} galaxies")
                    stats["inserted"] += len(galaxies_batch)

                galaxies_batch = []
                progress = (i + 1) / stats["total"] * 100
                logger.info(f"Progress: {i+1}/{stats['total']} ({progress:.1f}%)")

                if not dry_run:
                    time.sleep(0.1)

        except Exception as e:
            logger.error(f"❌ Error at row {i}: {e}")
            stats["errors"] += 1

    return stats


# --------------------------------------------------------------------------------------
# Main entry
# --------------------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Ingest galaxies from a parquet file into Convex.")
    parser.add_argument("--parquet-file", required=True, help="Path to the parquet file")
    parser.add_argument(
        "--convex-http-actions-url",
        help="Convex ingestion HTTP API URL (overrides env/dotenv VITE_CONVEX_HTTP_ACTIONS_URL)",
    )
    parser.add_argument(
        "--ingest-token",
        help="Convex ingestion token (overrides env/dotenv INGEST_TOKEN)",
    )
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not actually send data (just log what would happen)",
    )
    args = parser.parse_args()

    try:
        config = load_configuration(args.convex_http_actions_url, args.ingest_token)
        convex_url, ingest_token = config["convex_url"], config["ingest_token"]

        parquet_path = Path(args.parquet_file)
        if not parquet_path.exists():
            raise FileNotFoundError(f"File not found: {parquet_path}")

        logger.info(f"📖 Reading parquet: {parquet_path}")
        df = pd.read_parquet(parquet_path)
        logger.info(f"✓ Loaded {len(df)} rows.")

        validate_parquet_columns(df)

        logger.info("📋 Sample data:\n" + df.head().to_string())

        if args.dry_run:
            logger.info(f"\n🔍 DRY RUN: Would process {len(df)} galaxies.")

        else:
            resp = input(f"\n❓ Proceed with ingesting {len(df)} galaxies? (y/N): ")
            if resp.lower() != "y":
                logger.info("❌ Cancelled.")
                return

        stats = process_parquet(
            df,
            convex_url,
            ingest_token,
            args.batch_size,
            dry_run=args.dry_run,
        )

        logger.info("\n" + "=" * 50)
        logger.info("SUMMARY")
        logger.info("=" * 50)
        logger.info(f"Total galaxies: {stats['total']}")
        logger.info(f"Inserted:       {stats['inserted']}")
        logger.info(f"Errors:         {stats['errors']}")
        logger.info("=" * 50)

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
