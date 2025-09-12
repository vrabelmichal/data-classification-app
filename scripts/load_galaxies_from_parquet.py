#!/usr/bin/env python3
"""
Script to load galaxy data from a parquet file into the Convex database.
(Updated with proper parquet-to-database column mapping)
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any
import json

try:
    import pandas as pd
    import requests
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Missing required dependencies: {e}")
    print("Please install required packages:")
    print("pip install pandas pyarrow requests python-dotenv")
    sys.exit(1)


class ConvexClient:
    """Client for interacting with Convex HTTP API."""

    def __init__(self, convex_url: str):
        self.convex_url = convex_url.rstrip("/")
        self.session = requests.Session()

    def call_function(self, function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.convex_url}/api/functions/{function_name}"
        payload = {"args": args, "format": "json"}
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        if "error" in result:
            raise Exception(f"Convex function error: {result['error']}")
        return result.get("value", {})

    def call_mutation(self, mutation_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.convex_url}/api/mutations/{mutation_name}"
        payload = {"args": args, "format": "json"}
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        if "error" in result:
            raise Exception(f"Convex mutation error: {result['error']}")
        return result.get("value", {})


class GalaxyDataLoader:
    """Loads galaxy data from parquet files into Convex database."""

    # Mapping database schema -> parquet columns
    COLUMN_MAPPING: Dict[str, str] = {
        "id": "coadd_object_id",
        "ra": "ra",
        "dec": "dec",
        "reff": "sersic_reff_arcsec__best_available_fit",
        "q": "sersic_q__best_available_fit",
        "pa": "sersic_PA__best_available_fit",
        "nucleus": "is_nucleated",
        "imageUrl": None,
        "isActive": None,
        "redshift_x": None,
        "redshift_y": None,
        "x": "sersic_x__best_available_fit",
        "y": "sersic_y__best_available_fit",
    }

    def __init__(self, convex_client: ConvexClient, fallback_is_active: bool = True):
        self.client = convex_client
        self.fallback_is_active = fallback_is_active

    def validate_parquet_columns(self, df: pd.DataFrame) -> None:
        """Validate required parquet columns are present."""
        missing = []
        for db_field, parquet_field in self.COLUMN_MAPPING.items():
            # Only validate fields that come from parquet
            if parquet_field is not None and parquet_field not in df.columns:
                missing.append((db_field, parquet_field))

        if missing:
            raise ValueError(
                "Missing required parquet columns: "
                + ", ".join([f"{db}->{pq}" for db, pq in missing])
            )

        used = {pq for pq in self.COLUMN_MAPPING.values() if pq is not None}
        print(f"✓ All required parquet columns are present: {used}")

    def prepare_galaxy_record(self, row: pd.Series) -> Dict[str, Any]:
        """Convert parquet row to Convex-compatible galaxy record."""
        record: Dict[str, Any] = {}

        for db_field, parquet_field in self.COLUMN_MAPPING.items():
            if parquet_field is None:
                # optional not present
                continue

            if pd.isna(row[parquet_field]):
                continue

            val = row[parquet_field]

            if db_field in ["id", "imageUrl"]:
                record[db_field] = str(val).strip()
            elif db_field in ["nucleus", "isActive"]:
                record[db_field] = bool(val)
            else:
                record[db_field] = float(val)

        # Ensure isActive has a fallback when missing from parquet
        if "isActive" not in record:
            record["isActive"] = bool(self.fallback_is_active)

        return record

    # --- (rest stays unchanged) ---
    def check_existing_galaxy(self, galaxy_id: str) -> bool:
        try:
            result = self.client.call_function(
                "galaxies:getGalaxyByExternalId", {"externalId": galaxy_id}
            )
            return result is not None
        except Exception as e:
            print(f"Warning: Could not check existing galaxy {galaxy_id}: {e}")
            return False

    def insert_galaxy(self, galaxy_record: Dict[str, Any]) -> bool:
        try:
            result = self.client.call_mutation("galaxies:insertGalaxy", galaxy_record)
            return result.get("success", False)
        except Exception as e:
            print(f"Error inserting galaxy {galaxy_record.get('id', 'unknown')}: {e}")
            return False

    def insert_galaxies_batch(
        self, galaxy_records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        try:
            result = self.client.call_mutation(
                "galaxies:insertGalaxiesBatch", {"galaxies": galaxy_records}
            )
            return result
        except Exception as e:
            print(f"Error inserting batch: {e}")
            return {"inserted": 0, "skipped": 0, "errors": [str(e)]}

    def load_galaxies(
        self,
        df: pd.DataFrame,
        batch_size: int = 100,
        skip_existing: bool = True,
        dry_run: bool = False,
    ) -> Dict[str, int]:
        stats = {"total": len(df), "inserted": 0, "skipped": 0, "errors": 0}
        print(f"Starting to process {stats['total']} galaxies...")
        if dry_run:
            print("🔍 DRY RUN MODE - No data will be inserted")

        batch_records = []
        for i, (_, row) in enumerate(df.iterrows()):
            try:
                record = self.prepare_galaxy_record(row)
                batch_records.append(record)

                if len(batch_records) >= batch_size or i == len(df) - 1:
                    if not dry_run:
                        batch_result = self.insert_galaxies_batch(batch_records)
                        stats["inserted"] += batch_result.get("inserted", 0)
                        stats["skipped"] += batch_result.get("skipped", 0)
                        errs = batch_result.get("errors", [])
                        if errs:
                            stats["errors"] += len(errs)
                            for e in errs:
                                print(f"❌ Batch error: {e}")
                        print(
                            f"✓ Processed batch: {batch_result.get('inserted', 0)} inserted, "
                            f"{batch_result.get('skipped', 0)} skipped"
                        )
                    else:
                        print(f"🔍 Would insert batch of {len(batch_records)} galaxies")
                        stats["inserted"] += len(batch_records)

                    batch_records = []
                    progress = (i + 1) / stats["total"] * 100
                    print(f"Progress: {i+1}/{stats['total']} ({progress:.1f}%)")

                    if not dry_run:
                        time.sleep(0.1)

            except Exception as e:
                print(f"❌ Error processing row {i}: {e}")
                stats["errors"] += 1
                continue

        return stats

    def print_summary(self, stats: Dict[str, int]) -> None:
        print("\n" + "=" * 50)
        print("GALAXY LOADING SUMMARY")
        print("=" * 50)
        print(f"Total galaxies processed: {stats['total']}")
        print(f"Successfully inserted:   {stats['inserted']}")
        print(f"Skipped (existing):      {stats['skipped']}")
        print(f"Errors:                  {stats['errors']}")
        print("=" * 50)


def load_environment() -> str:
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✓ Loaded environment from {env_path}")

    convex_url = os.getenv("VITE_CONVEX_URL")
    if not convex_url:
        raise ValueError(
            "VITE_CONVEX_URL not found in environment variables. "
            "Please set it in your .env file or pass --convex-url argument."
        )
    return convex_url


def main():
    parser = argparse.ArgumentParser(
        description="Load galaxy data from parquet file to Convex database"
    )
    parser.add_argument("parquet_file", help="Path to the parquet file containing galaxy data")
    parser.add_argument("--convex-url", help="Convex deployment URL (overrides environment variable)")
    parser.add_argument(
        "--batch-size", type=int, default=100, help="Batch size for processing (default: 100)"
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip galaxies that already exist (default: True)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be loaded without actually inserting data",
    )
    # Fallback isActive flag (default True)
    if hasattr(argparse, "BooleanOptionalAction"):
        parser.add_argument(
            "--is-active",
            dest="is_active",
            action=argparse.BooleanOptionalAction,
            default=True,
            help="Fallback value for isActive when parquet doesn't provide it (default: True)",
        )
    else:
        parser.add_argument(
            "--is-active",
            dest="is_active",
            type=lambda s: s.lower() in ("1", "true", "yes", "y", "t"),
            default=True,
            help="Fallback value for isActive when parquet doesn't provide it (default: True)",
        )

    args = parser.parse_args()

    try:
        convex_url = args.convex_url if args.convex_url else load_environment()
        print(f"Using Convex URL: {convex_url}")

        parquet_path = Path(args.parquet_file)
        if not parquet_path.exists():
            raise FileNotFoundError(f"Parquet file not found: {parquet_path}")

        print(f"Loading data from: {parquet_path}")
        print("📖 Reading parquet file...")
        df = pd.read_parquet(parquet_path)
        print(f"✓ Loaded {len(df)} records from parquet file")

        convex_client = ConvexClient(convex_url)
        loader = GalaxyDataLoader(convex_client, fallback_is_active=bool(args.is_active))

        loader.validate_parquet_columns(df)

        print("\n📋 Sample of data to be loaded:")
        print(df.head().to_string())

        if args.dry_run:
            print(f"\n🔍 DRY RUN: Would process {len(df)} galaxies")
        else:
            response = input(f"\n❓ Proceed with loading {len(df)} galaxies? (y/N): ")
            if response.lower() != "y":
                print("❌ Operation cancelled")
                return

        stats = loader.load_galaxies(
            df,
            batch_size=args.batch_size,
            skip_existing=args.skip_existing,
            dry_run=args.dry_run,
        )

        loader.print_summary(stats)

        if stats["errors"] > 0:
            print(f"\n⚠ Completed with {stats['errors']} errors")
            sys.exit(1)
        else:
            print(f"\n✅ Successfully completed!")

    except KeyboardInterrupt:
        print("\n❌ Operation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
