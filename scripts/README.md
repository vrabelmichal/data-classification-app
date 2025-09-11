# Galaxy Data Loading Scripts

This directory contains Python scripts for loading galaxy data from parquet files into the Convex database.

## Files

- `load_galaxies_from_parquet.py` - Main script for loading galaxy data from parquet files
- `generate_sample_parquet.py` - Utility script for generating sample parquet files for testing
- `requirements.txt` - Python dependencies required for the scripts

## Installation

1. Install Python dependencies:
```bash
pip install -r scripts/requirements.txt
```

2. Set up your environment variables in `.env` file:
```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

## Parquet File Format

The parquet file should contain the following columns:

### Required Columns
- `id` (string): External galaxy identifier (unique)
- `ra` (float): Right ascension in degrees
- `dec` (float): Declination in degrees  
- `reff` (float): Effective radius in arcseconds
- `q` (float): Axis ratio (0.0 to 1.0)
- `pa` (float): Position angle in degrees (0 to 180)
- `nucleus` (boolean): Whether the galaxy has a visible nucleus

### Optional Columns
- `imageUrl` (string): URL to the galaxy image
- `isActive` (boolean): Legacy field for galaxy status
- `redshift_x` (float): X-component redshift
- `redshift_y` (float): Y-component redshift
- `x` (float): X coordinate in image pixels
- `y` (float): Y coordinate in image pixels

## Usage

### Basic Usage

Load galaxies from a parquet file:

```bash
python scripts/load_galaxies_from_parquet.py path/to/galaxies.parquet
```

### Advanced Options

```bash
# Dry run (preview what would be loaded)
python scripts/load_galaxies_from_parquet.py galaxies.parquet --dry-run

# Custom batch size for processing
python scripts/load_galaxies_from_parquet.py galaxies.parquet --batch-size 50

# Override Convex URL
python scripts/load_galaxies_from_parquet.py galaxies.parquet --convex-url https://my-deployment.convex.cloud

# Get help
python scripts/load_galaxies_from_parquet.py --help
```

### Generating Test Data

Create a sample parquet file for testing:

```bash
# Generate 100 sample galaxies
python scripts/generate_sample_parquet.py

# Generate 1000 galaxies with custom filename
python scripts/generate_sample_parquet.py --count 1000 --output test_galaxies.parquet
```

## Features

### Batch Processing
- Processes galaxies in configurable batches for optimal performance
- Default batch size is 100, can be adjusted based on your deployment

### Duplicate Detection
- Automatically skips galaxies that already exist in the database
- Uses the external galaxy ID (`id` field) for duplicate detection

### Error Handling
- Continues processing even if individual records fail
- Provides detailed error reporting and summary statistics
- Validates parquet file structure before processing

### Progress Monitoring
- Shows real-time progress during loading
- Displays batch processing results
- Provides comprehensive summary at completion

## Error Handling

The script handles various error conditions:

- **Missing required columns**: Validates parquet file structure
- **Invalid data types**: Converts data types appropriately
- **Network errors**: Retries with appropriate delays
- **Duplicate galaxies**: Skips existing entries gracefully
- **Database errors**: Reports specific errors for troubleshooting

## Performance Tips

1. **Batch Size**: Start with default batch size (100). Increase for better performance with stable connections, decrease if you encounter timeouts.

2. **Large Files**: For very large parquet files (>100k records), consider splitting them into smaller chunks.

3. **Network**: Ensure stable internet connection. The script includes small delays between batches to avoid overwhelming the API.

4. **Dry Run**: Always test with `--dry-run` first to validate your data format.

## Troubleshooting

### Common Issues

**"VITE_CONVEX_URL not found"**
- Ensure your `.env` file is in the project root
- Or use `--convex-url` argument to specify URL directly

**"Missing required columns"**
- Check your parquet file has all required columns
- Use the sample generator to see the expected format

**"Galaxy already exists"**
- This is normal behavior when re-running the script
- Existing galaxies are automatically skipped

**Network timeouts**
- Try reducing batch size with `--batch-size 50`
- Check your internet connection stability

### Getting Help

1. Run with `--help` for command-line options
2. Use `--dry-run` to preview operations without making changes
3. Check the Convex dashboard for database status
4. Review error messages for specific issues

## Example Workflow

1. **Prepare your data**: Ensure parquet file has required columns
```bash
python scripts/generate_sample_parquet.py --count 50 --output test.parquet
```

2. **Test with dry run**: Preview what will be loaded
```bash
python scripts/load_galaxies_from_parquet.py test.parquet --dry-run
```

3. **Load the data**: Actually insert into database
```bash
python scripts/load_galaxies_from_parquet.py test.parquet
```

4. **Verify**: Check your Convex dashboard or app to confirm data was loaded

## Integration with Convex

The scripts use the following Convex functions:

- `galaxies:getGalaxyByExternalId` - Check for existing galaxies
- `galaxies:insertGalaxy` - Insert single galaxy
- `galaxies:insertGalaxiesBatch` - Insert multiple galaxies efficiently

These functions are automatically available after adding the mutations to your `convex/galaxies.ts` file.
