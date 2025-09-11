#!/usr/bin/env python3
"""
Generate a sample parquet file with galaxy data for testing the data loader.

This script creates a sample parquet file with mock galaxy data that matches
the expected schema for the galaxy classification application.

Usage:
    python scripts/generate_sample_parquet.py [--output OUTPUT_FILE] [--count NUM_GALAXIES]
"""

import argparse
import random
import pandas as pd
import numpy as np
from pathlib import Path


def generate_sample_galaxies(count: int) -> pd.DataFrame:
    """Generate sample galaxy data."""
    
    galaxies = []
    
    for i in range(count):
        galaxy = {
            'id': f'GALAXY_{i+1:06d}',
            'ra': random.uniform(0, 360),  # Right ascension in degrees
            'dec': random.uniform(-90, 90),  # Declination in degrees  
            'reff': random.uniform(0.5, 10.0),  # Effective radius in arcsec
            'q': random.uniform(0.2, 1.0),  # Axis ratio (0.2 to 1.0)
            'pa': random.uniform(0, 180),  # Position angle in degrees
            'nucleus': random.choice([True, False]),  # Has nucleus
            'imageUrl': f'https://example.com/galaxy_images/GALAXY_{i+1:06d}.fits',
            # Optional legacy fields
            'isActive': random.choice([True, False]),
            'redshift_x': random.uniform(-0.1, 0.1) if random.random() > 0.5 else None,
            'redshift_y': random.uniform(-0.1, 0.1) if random.random() > 0.5 else None,
            'x': random.uniform(0, 4096) if random.random() > 0.7 else None,
            'y': random.uniform(0, 4096) if random.random() > 0.7 else None,
        }
        galaxies.append(galaxy)
    
    return pd.DataFrame(galaxies)


def main():
    parser = argparse.ArgumentParser(description='Generate sample parquet file with galaxy data')
    parser.add_argument('--output', '-o', default='sample_galaxies.parquet', 
                       help='Output parquet file path (default: sample_galaxies.parquet)')
    parser.add_argument('--count', '-c', type=int, default=100,
                       help='Number of galaxies to generate (default: 100)')
    
    args = parser.parse_args()
    
    print(f"Generating {args.count} sample galaxies...")
    
    # Generate sample data
    df = generate_sample_galaxies(args.count)
    
    # Save to parquet
    output_path = Path(args.output)
    df.to_parquet(output_path, index=False)
    
    print(f"✓ Generated {len(df)} galaxies")
    print(f"✓ Saved to: {output_path}")
    print(f"✓ File size: {output_path.stat().st_size / 1024:.1f} KB")
    
    # Show sample of the data
    print("\n📋 Sample of generated data:")
    print(df.head().to_string())
    
    print(f"\n📊 Data summary:")
    print(f"Columns: {list(df.columns)}")
    print(f"Data types:\n{df.dtypes}")
    
    print(f"\n✅ Sample parquet file ready!")
    print(f"You can now test the loader with:")
    print(f"python scripts/load_galaxies_from_parquet.py {output_path} --dry-run")


if __name__ == "__main__":
    main()
