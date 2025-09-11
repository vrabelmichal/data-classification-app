#!/usr/bin/env python3
"""
Quick test script to demonstrate the galaxy data loading functionality.
This creates a small test dataset and shows how to use the loader.
"""

import pandas as pd
import tempfile
import sys
from pathlib import Path

# Add the scripts directory to the path so we can import our modules
sys.path.append(str(Path(__file__).parent))

def create_test_data():
    """Create a small test dataset."""
    test_galaxies = [
        {
            'id': 'TEST_GALAXY_001',
            'ra': 150.1234,
            'dec': 2.1234,
            'reff': 3.45,
            'q': 0.7,
            'pa': 45.0,
            'nucleus': True,
            'imageUrl': 'https://example.com/test_galaxy_001.fits'
        },
        {
            'id': 'TEST_GALAXY_002', 
            'ra': 200.5678,
            'dec': -10.5678,
            'reff': 2.1,
            'q': 0.8,
            'pa': 90.0,
            'nucleus': False,
            'imageUrl': 'https://example.com/test_galaxy_002.fits'
        },
        {
            'id': 'TEST_GALAXY_003',
            'ra': 75.9012,
            'dec': 45.9012,
            'reff': 5.67,
            'q': 0.6,
            'pa': 120.0,
            'nucleus': True,
            'imageUrl': 'https://example.com/test_galaxy_003.fits'
        }
    ]
    
    return pd.DataFrame(test_galaxies)

def main():
    print("🧪 Galaxy Data Loader Test")
    print("=" * 40)
    
    # Create test data
    print("📊 Creating test dataset...")
    df = create_test_data()
    
    # Save to temporary parquet file
    with tempfile.NamedTemporaryFile(suffix='.parquet', delete=False) as tmp:
        temp_file = tmp.name
        
    df.to_parquet(temp_file, index=False)
    print(f"✓ Created test parquet file: {temp_file}")
    
    # Show the data
    print("\n📋 Test data:")
    print(df.to_string(index=False))
    
    # Show how to use the loader
    print(f"\n🚀 To load this data into your Convex database, run:")
    print(f"python scripts/load_galaxies_from_parquet.py {temp_file} --dry-run")
    print(f"\nOr to actually insert the data:")
    print(f"python scripts/load_galaxies_from_parquet.py {temp_file}")
    
    print(f"\n📝 Test file location: {temp_file}")
    print("Don't forget to delete the test file when done!")

if __name__ == "__main__":
    main()
