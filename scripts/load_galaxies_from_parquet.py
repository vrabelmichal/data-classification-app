#!/usr/bin/env python3
"""
Script to load galaxy data from a parquet file into the Convex database.

This script reads galaxy data from a parquet file and uploads it to the Convex backend
using the HTTP API. The parquet file should contain columns matching the galaxy schema:
- id (string): External galaxy ID
- ra (float): Right ascension
- dec (float): Declination
- reff (float): Effective radius
- q (float): Axis ratio
- pa (float): Position angle
- nucleus (boolean): Has nucleus
- imageUrl (string, optional): URL to galaxy image

Usage:
    python scripts/load_galaxies_from_parquet.py <parquet_file_path> [--convex-url CONVEX_URL] [--batch-size BATCH_SIZE]

Requirements:
    pip install pandas pyarrow requests python-dotenv
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
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
        self.convex_url = convex_url.rstrip('/')
        self.session = requests.Session()
        
    def call_function(self, function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Call a Convex function via HTTP API."""
        url = f"{self.convex_url}/api/functions/{function_name}"
        
        payload = {
            "args": args,
            "format": "json"
        }
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        if "error" in result:
            raise Exception(f"Convex function error: {result['error']}")
            
        return result.get("value", {})
    
    def call_mutation(self, mutation_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Call a Convex mutation via HTTP API."""
        url = f"{self.convex_url}/api/mutations/{mutation_name}"
        
        payload = {
            "args": args,
            "format": "json"
        }
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        if "error" in result:
            raise Exception(f"Convex mutation error: {result['error']}")
            
        return result.get("value", {})


class GalaxyDataLoader:
    """Loads galaxy data from parquet files into Convex database."""
    
    def __init__(self, convex_client: ConvexClient):
        self.client = convex_client
        
    def validate_parquet_columns(self, df: pd.DataFrame) -> None:
        """Validate that the parquet file has required columns."""
        required_columns = {'id', 'ra', 'dec', 'reff', 'q', 'pa', 'nucleus'}
        optional_columns = {'imageUrl', 'isActive', 'redshift_x', 'redshift_y', 'x', 'y'}
        
        available_columns = set(df.columns)
        missing_columns = required_columns - available_columns
        
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
            
        print(f"✓ Found all required columns: {required_columns}")
        
        # Check for optional columns
        optional_found = available_columns & optional_columns
        if optional_found:
            print(f"✓ Found optional columns: {optional_found}")
            
        # Warn about unknown columns
        unknown_columns = available_columns - required_columns - optional_columns
        if unknown_columns:
            print(f"⚠ Unknown columns (will be ignored): {unknown_columns}")
    
    def prepare_galaxy_record(self, row: pd.Series) -> Dict[str, Any]:
        """Convert a pandas row to a galaxy record suitable for Convex."""
        record = {
            'id': str(row['id']).strip(),
            'ra': float(row['ra']),
            'dec': float(row['dec']),
            'reff': float(row['reff']),
            'q': float(row['q']),
            'pa': float(row['pa']),
            'nucleus': bool(row['nucleus']),
        }
        
        # Add optional fields if present
        if 'imageUrl' in row and pd.notna(row['imageUrl']):
            record['imageUrl'] = str(row['imageUrl']).strip()
            
        if 'isActive' in row and pd.notna(row['isActive']):
            record['isActive'] = bool(row['isActive'])
            
        if 'redshift_x' in row and pd.notna(row['redshift_x']):
            record['redshift_x'] = float(row['redshift_x'])
            
        if 'redshift_y' in row and pd.notna(row['redshift_y']):
            record['redshift_y'] = float(row['redshift_y'])
            
        if 'x' in row and pd.notna(row['x']):
            record['x'] = float(row['x'])
            
        if 'y' in row and pd.notna(row['y']):
            record['y'] = float(row['y'])
        
        return record
    
    def check_existing_galaxy(self, galaxy_id: str) -> bool:
        """Check if a galaxy with the given ID already exists."""
        try:
            result = self.client.call_function("galaxies:getGalaxyByExternalId", {
                "externalId": galaxy_id
            })
            return result is not None
        except Exception as e:
            print(f"Warning: Could not check existing galaxy {galaxy_id}: {e}")
            return False
    
    def insert_galaxy(self, galaxy_record: Dict[str, Any]) -> bool:
        """Insert a single galaxy record into the database."""
        try:
            result = self.client.call_mutation("galaxies:insertGalaxy", galaxy_record)
            return result.get('success', False)
        except Exception as e:
            print(f"Error inserting galaxy {galaxy_record.get('id', 'unknown')}: {e}")
            return False
    
    def insert_galaxies_batch(self, galaxy_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Insert a batch of galaxy records into the database."""
        try:
            result = self.client.call_mutation("galaxies:insertGalaxiesBatch", {
                "galaxies": galaxy_records
            })
            return result
        except Exception as e:
            print(f"Error inserting batch: {e}")
            return {"inserted": 0, "skipped": 0, "errors": [str(e)]}
    
    def load_galaxies(self, df: pd.DataFrame, batch_size: int = 100, 
                     skip_existing: bool = True, dry_run: bool = False) -> Dict[str, int]:
        """Load galaxies from dataframe into the database."""
        stats = {
            'total': len(df),
            'inserted': 0,
            'skipped': 0,
            'errors': 0
        }
        
        print(f"Starting to process {stats['total']} galaxies...")
        
        if dry_run:
            print("🔍 DRY RUN MODE - No data will be inserted")
        
        # Process in batches for better performance
        batch_records = []
        
        for i, (_, row) in enumerate(df.iterrows()):
            try:
                galaxy_record = self.prepare_galaxy_record(row)
                galaxy_id = galaxy_record['id']
                
                # In batch mode, we let the server handle duplicate checking
                batch_records.append(galaxy_record)
                
                # Process batch when it's full or at the end
                if len(batch_records) >= batch_size or i == len(df) - 1:
                    if not dry_run:
                        batch_result = self.insert_galaxies_batch(batch_records)
                        stats['inserted'] += batch_result.get('inserted', 0)
                        stats['skipped'] += batch_result.get('skipped', 0)
                        
                        # Handle batch errors
                        batch_errors = batch_result.get('errors', [])
                        if batch_errors:
                            stats['errors'] += len(batch_errors)
                            for error in batch_errors:
                                print(f"❌ Batch error: {error}")
                        
                        print(f"✓ Processed batch: {batch_result.get('inserted', 0)} inserted, {batch_result.get('skipped', 0)} skipped")
                    else:
                        print(f"🔍 Would insert batch of {len(batch_records)} galaxies")
                        stats['inserted'] += len(batch_records)
                    
                    # Clear batch and show progress
                    batch_records = []
                    progress = (i + 1) / stats['total'] * 100
                    print(f"Progress: {i + 1}/{stats['total']} ({progress:.1f}%)")
                    
                    if not dry_run:
                        time.sleep(0.1)  # Small delay to avoid overwhelming the API
                    
            except Exception as e:
                print(f"❌ Error processing row {i}: {e}")
                stats['errors'] += 1
                continue
        
        return stats
    
    def print_summary(self, stats: Dict[str, int]) -> None:
        """Print a summary of the loading operation."""
        print("\n" + "="*50)
        print("GALAXY LOADING SUMMARY")
        print("="*50)
        print(f"Total galaxies processed: {stats['total']}")
        print(f"Successfully inserted:   {stats['inserted']}")
        print(f"Skipped (existing):      {stats['skipped']}")
        print(f"Errors:                  {stats['errors']}")
        print("="*50)


def load_environment() -> str:
    """Load environment variables and return Convex URL."""
    # Try to load .env file from project root
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✓ Loaded environment from {env_path}")
    
    # Get Convex URL from environment
    convex_url = os.getenv('VITE_CONVEX_URL')
    if not convex_url:
        raise ValueError(
            "VITE_CONVEX_URL not found in environment variables. "
            "Please set it in your .env file or pass --convex-url argument."
        )
    
    return convex_url


def main():
    parser = argparse.ArgumentParser(description='Load galaxy data from parquet file to Convex database')
    parser.add_argument('parquet_file', help='Path to the parquet file containing galaxy data')
    parser.add_argument('--convex-url', help='Convex deployment URL (overrides environment variable)')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size for processing (default: 100)')
    parser.add_argument('--skip-existing', action='store_true', default=True, help='Skip galaxies that already exist (default: True)')
    parser.add_argument('--dry-run', action='store_true', help='Preview what would be loaded without actually inserting data')
    
    args = parser.parse_args()
    
    try:
        # Load environment and get Convex URL
        if args.convex_url:
            convex_url = args.convex_url
        else:
            convex_url = load_environment()
        
        print(f"Using Convex URL: {convex_url}")
        
        # Validate parquet file exists
        parquet_path = Path(args.parquet_file)
        if not parquet_path.exists():
            raise FileNotFoundError(f"Parquet file not found: {parquet_path}")
        
        print(f"Loading data from: {parquet_path}")
        
        # Read parquet file
        print("📖 Reading parquet file...")
        df = pd.read_parquet(parquet_path)
        print(f"✓ Loaded {len(df)} records from parquet file")
        
        # Initialize clients
        convex_client = ConvexClient(convex_url)
        loader = GalaxyDataLoader(convex_client)
        
        # Validate columns
        loader.validate_parquet_columns(df)
        
        # Show sample data
        print("\n📋 Sample of data to be loaded:")
        print(df.head().to_string())
        
        if args.dry_run:
            print(f"\n🔍 DRY RUN: Would process {len(df)} galaxies")
        else:
            # Confirm before proceeding
            response = input(f"\n❓ Proceed with loading {len(df)} galaxies? (y/N): ")
            if response.lower() != 'y':
                print("❌ Operation cancelled")
                return
        
        # Load galaxies
        stats = loader.load_galaxies(
            df, 
            batch_size=args.batch_size,
            skip_existing=args.skip_existing,
            dry_run=args.dry_run
        )
        
        # Print summary
        loader.print_summary(stats)
        
        if stats['errors'] > 0:
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
