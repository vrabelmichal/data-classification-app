#!/usr/bin/env python3
"""
Script to ingest galaxy data from a parquet file into Convex database
via the /ingest/galaxies HTTP endpoint.

NOTE: The Convex backend now stores photometry & thuruthipilly data in
split tables (galaxies_photometry_*, galaxies_source_extractor,
galaxies_thuruthipilly). This script still sends the original nested
structure (photometry.{g,r,i,y,z} & thuruthipilly). The server-side
ingestion logic (insertGalaxy) performs the splitting transparently.

Priority for configuration:
1. Command line arguments (highest)
2. Dotenv file (default `.env`, or user-supplied path via --dot-env-file)
3. Environment variables (fallback)

Expected variables:
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
from typing import Dict, List, Any, Union

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
# Nested Mapping: Database schema -> (Parquet column, target type)
# --------------------------------------------------------------------------------------

def str_or_int_to_str(val):
    """Special casting: first to int, then to string."""
    try:
        return str(int(val))
    except Exception:
        return str(val)


NESTED_COLUMN_MAPPING: Dict[str, Union[tuple, Dict[str, Any], None]] = {
    # core
    "id": ("coadd_object_id", str_or_int_to_str),
    "ra": ("ra", float),
    "dec": ("dec", float),
    "reff": ("sersic_reff_arcsec__best_available_fit", float),
    "reff_pixels": ("sersic_reff_pixels__best_available_fit", float),
    "q": ("sersic_q__best_available_fit", float),
    "pa": ("sersic_PA__best_available_fit", float),
    "nucleus": ("is_nucleated", bool),

    "isActive": (None, bool),        # optional, may be None
    "redshift_x": (None, float),
    "redshift_y": (None, float),
    "x": ("sersic_x__best_available_fit", float),
    "y": ("sersic_y__best_available_fit", float),

    "photometry": {
        "g": {
            "sersic": {
                "mag": ("sersic_mag__best_available_fit", float),
                "mag_error": ("sersic_mag_error__best_available_fit", float),
                "mag_rel_error": ("sersic_mag_rel_error__best_available_fit", float),
                "mean_mue": ("sersic_mean_mue__best_available_fit", float),
                "mue": ("sersic_mue__best_available_fit", float),
                "x_error": ("sersic_x_error__best_available_fit", float),
                "x_rel_error": ("sersic_x_rel_error__best_available_fit", float),
                "psf": {
                    "mag": ("sersic_psf_mag__best_available_fit", float),
                    "mag_error": ("sersic_psf_mag_error__best_available_fit", float),
                    "mag_rel_error": ("sersic_psf_mag_rel_error__best_available_fit", float),
                    "x": ("sersic_psf_x__best_available_fit", float),
                    "x_error": ("sersic_psf_x_error__best_available_fit", float),
                    "x_rel_error": ("sersic_psf_x_rel_error__best_available_fit", float),
                },
            },
            "source_extractor": {
                "mag_auto": ("mag_auto_g", float),
                "mu_mean_model": ("mu_mean_model_g", float),
                "flux_radius": ("flux_radius_g_arcsec", float),
            },
        },
        "r": {
            "sersic": {
                "mean_mue": ("sersic_mean_mue_r", float),
                "mue": ("sersic_mue_r__best_available_fit", float),
                "mag": ("sersic_mag_r__best_available_fit", float),
                "mag_error": ("sersic_mag_error_r__best_available_fit", float),
                "mag_rel_error": ("sersic_mag_rel_error_r__best_available_fit", float),
                "x_error": ("sersic_x_error_r__best_available_fit", float),
                "x_rel_error": ("sersic_x_rel_error_r__best_available_fit", float),
                "psf": {
                    "mag": ("sersic_psf_mag_r__best_available_fit", float),
                    "mag_error": ("sersic_psf_mag_error_r__best_available_fit", float),
                },
            },
            "source_extractor": {
                "mag_auto": ("mag_auto_r", float),
                "mu_mean_model": ("mu_mean_model_r", float),
                "flux_radius": ("flux_radius_r_arcsec", float),
            },
        },
        "i": {
            "sersic": {
                "mean_mue": ("sersic_mean_mue_i__best_available_fit", float),
                "mue": ("sersic_mue_i__best_available_fit", float),
                "mag": ("sersic_mag_i__best_available_fit", float),
                "mag_error": ("sersic_mag_error_i__best_available_fit", float),
                "mag_rel_error": ("sersic_mag_rel_error_i__best_available_fit", float),
                "x_error": ("sersic_x_error_i__best_available_fit", float),
                "x_rel_error": ("sersic_x_rel_error_i__best_available_fit", float),
                "psf": {
                    "mag": ("sersic_psf_mag_i__best_available_fit", float),
                    "mag_error": ("sersic_psf_mag_error_i__best_available_fit", float),
                },
            },
            "source_extractor": {
                "mag_auto": ("mag_auto_i", float),
                "mu_mean_model": ("mu_mean_model_i", float),
                "flux_radius": ("flux_radius_i_arcsec", float),
            },
        },
        "y": {
            "source_extractor": {
                "mag_auto": ("mag_auto_y", float),
                "mu_mean_model": ("mu_mean_model_y", float),
                "flux_radius": ("flux_radius_y_arcsec", float),
            },
        },
        "z": {
            "source_extractor": {
                "mag_auto": ("mag_auto_z", float),
                "mu_mean_model": ("mu_mean_model_z", float),
                "flux_radius": ("flux_radius_z_arcsec", float),
            },
        },
    },

    "misc": {
        "is_detr": ("is_detr", bool),
        "is_vit": ("is_vit", bool),
        "paper": ("paper", str),
        "dataset": ("dataset", str),
        "tilename": ("tilename", str),
        "thur_cls": ("thur_cls", str),
        "thur_cls_n": ("thur_cls_n", float),
    },

    "thuruthipilly": {
        "n": ("n_thur", float),
        "q": ("q_thur", float),
        "reff_g": ("reff_g_thur", float),
        "reff_i": ("reff_i_thur", float),
        "mag_g_cor": ("mag_g_cor_thur", float),
        "mag_g_gf": ("mag_g_gf_thur", float),
        "mag_i_cor": ("mag_i_cor_thur", float),
        "mag_i_gf": ("mag_i_gf_thur", float),
        "mue_mean_g_gf": ("mue_mean_g_gf_thur", float),
        "mu_mean_g_cor": ("mu_mean_g_cor_thur", float),
        "mue_mean_i_gf": ("mue_mean_i_gf_thur", float),
        "mu_mean_i_cor": ("mu_mean_i_cor_thur", float),
    },
}


# --------------------------------------------------------------------------------------
# Config loading
# --------------------------------------------------------------------------------------
def load_configuration(convex_http_url_arg=None, ingest_token_arg=None, dot_env_file=None):
    source_info = {}
    env_path = None

    if dot_env_file:
        env_path = Path(dot_env_file)
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"✓ Loaded environment from provided dot file: {env_path}")
        else:
            logger.warning(f"⚠ Dot file {env_path} was provided but not found")
    else:
        default_path = Path(".env")
        if default_path.exists():
            env_path = default_path
            load_dotenv(default_path)
            logger.info(f"✓ Loaded environment from default dot file: {default_path}")

    if convex_http_url_arg:
        convex_url = convex_http_url_arg
        source_info["VITE_CONVEX_HTTP_ACTIONS_URL"] = "CLI arg"
    elif os.getenv("VITE_CONVEX_HTTP_ACTIONS_URL"):
        convex_url = os.getenv("VITE_CONVEX_HTTP_ACTIONS_URL")
        source_info["VITE_CONVEX_HTTP_ACTIONS_URL"] = f"dotenv {env_path}" if env_path else "env"
    else:
        convex_url = None

    if ingest_token_arg:
        ingest_token = ingest_token_arg
        source_info["INGEST_TOKEN"] = "CLI arg"
    elif os.getenv("INGEST_TOKEN"):
        ingest_token = os.getenv("INGEST_TOKEN")
        source_info["INGEST_TOKEN"] = f"dotenv {env_path}" if env_path else "env"
    else:
        ingest_token = None

    if not convex_url or not ingest_token:
        raise ValueError("Convex URL or Ingest Token not provided")

    convex_url = convex_url.rstrip("/")
    logger.info("Resolved configuration:")
    logger.info(f"  VITE_CONVEX_HTTP_ACTIONS_URL={convex_url} (source={source_info.get('VITE_CONVEX_HTTP_ACTIONS_URL')})")
    logger.info(f"  INGEST_TOKEN=*** (source={source_info.get('INGEST_TOKEN')})")
    return {"convex_url": convex_url, "ingest_token": ingest_token}


# --------------------------------------------------------------------------------------
# Data preparation helpers
# --------------------------------------------------------------------------------------
# def extract_nested(row: pd.Series, mapping: Dict[str, Any]) -> Dict[str, Any]:
#     """Recursively extract nested values from a row based on mapping."""
#     obj: Dict[str, Any] = {}
#     for key, colmap in mapping.items():
#         if isinstance(colmap, dict):
#             nested_obj = extract_nested(row, colmap)
#             if any(v is not None for v in nested_obj.values()):
#                 obj[key] = nested_obj
#         else:
#             if colmap is None:
#                 continue
#             if colmap in row and pd.notna(row[colmap]):
#                 val = row[colmap]
#                 if isinstance(val, (int, float)):
#                     obj[key] = float(val)
#                 elif isinstance(val, str):
#                     obj[key] = val.strip()
#                 else:
#                     if isinstance(val, (bool,)):
#                         obj[key] = bool(val)
#                     else:
#                         obj[key] = val
#     return obj

def extract_nested(row: pd.Series, mapping: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively extract nested values from a row based on mapping with types."""
    obj: Dict[str, Any] = {}
    for key, colmap in mapping.items():
        if isinstance(colmap, dict):
            nested_obj = extract_nested(row, colmap)
            if any(v is not None for v in nested_obj.values()):
                obj[key] = nested_obj
        elif isinstance(colmap, tuple):
            colname, cast_fn = colmap
            if colname is None:
                continue
            if colname in row and pd.notna(row[colname]):
                try:
                    val = cast_fn(row[colname])
                except Exception:
                    logger.warning(f"⚠ Failed casting {colname} with value {row[colname]}")
                    continue
                obj[key] = val
    return obj


def row_to_galaxy(row: pd.Series) -> Dict[str, Any]:
    """Build split-object representation expected by new ingestion API."""
    nested = extract_nested(row, NESTED_COLUMN_MAPPING)
    # Core galaxy fields
    galaxy_core_keys = [
        'id','ra','dec','reff','reff_pixels','q','pa','nucleus','isActive','redshift_x','redshift_y','x','y','misc'
    ]
    galaxy_core = {k: nested.get(k) for k in galaxy_core_keys if k in nested}
    # Photometry bands
    phot = nested.get('photometry', {})
    g_ser = phot.get('g', {}).get('sersic')
    r_ser = phot.get('r', {}).get('sersic')
    i_ser = phot.get('i', {}).get('sersic')
    photometryBand = {'sersic': g_ser} if g_ser else None
    photometryBandR = {'sersic': r_ser} if r_ser else None
    photometryBandI = {'sersic': i_ser} if i_ser else None
    # Source extractor unified
    def se_band(b):
        return phot.get(b, {}).get('source_extractor', {}) if phot.get(b) else {}
    source_extractor = {
        'g': se_band('g'),
        'r': se_band('r'),
        'i': se_band('i'),
    }
    y_se = se_band('y') if phot.get('y') else None
    z_se = se_band('z') if phot.get('z') else None
    if y_se: source_extractor['y'] = y_se
    if z_se: source_extractor['z'] = z_se
    # Remove empty dict bands
    if not any(v for k,v in source_extractor.items() if isinstance(v, dict) and v):
        source_extractor_out = None
    else:
        source_extractor_out = source_extractor
    # Thuruthipilly
    thuru = nested.get('thuruthipilly') or None
    obj = {
        'galaxy': galaxy_core,
        'photometryBand': photometryBand,
        'photometryBandR': photometryBandR,
        'photometryBandI': photometryBandI,
        'sourceExtractor': source_extractor_out,
        'thuruthipilly': thuru,
    }
    return {k: v for k, v in obj.items() if v is not None}


# --------------------------------------------------------------------------------------
# Ingest HTTP
# --------------------------------------------------------------------------------------
def send_ingest(convex_url, ingest_token, galaxies, timeout_sec=60):
    url = f"{convex_url}/ingest/galaxies"
    headers = {
        "Authorization": f"Bearer {ingest_token}",
        "Content-Type": "application/json",
    }
    payload = {"galaxies": galaxies}
    logger.info(f"POST {url} with {len(galaxies)} galaxies")
    return requests.post(url, headers=headers, data=json.dumps(payload), timeout=timeout_sec)


# --------------------------------------------------------------------------------------
# Batch process
# --------------------------------------------------------------------------------------
def process_parquet(df, convex_url, ingest_token, batch_size=100, dry_run=False, continue_on_error=False, global_offset=0):
    """
    Process parquet dataframe and ingest galaxies in batches.
    
    FAIL-FAST: By default, stops immediately on any error.
    The server-side mutation is atomic - on failure, the entire batch is rolled back.
    
    Args:
        df: DataFrame with galaxy data
        convex_url: Convex HTTP actions URL
        ingest_token: Authentication token
        batch_size: Number of galaxies per batch
        dry_run: If True, don't actually send to server
        continue_on_error: If True, continue with next batch on error (not recommended)
        global_offset: The offset in the original file (for error reporting)
    """
    stats = {
        "total": len(df), 
        "inserted": 0, 
        "skipped": 0,
        "errors": 0,
        "failed_at": None,  # Will contain info about failure point
    }
    batch = []
    batch_start_idx = 0  # Track the starting index of current batch
    
    for i, (_, row) in enumerate(df.iterrows()):
        try:
            galaxy = row_to_galaxy(row)
            if len(batch) == 0:
                batch_start_idx = i  # Remember where this batch starts
            batch.append(galaxy)

            if len(batch) >= batch_size or i == len(df) - 1:
                batch_num = i // batch_size + 1
                
                if not dry_run:
                    resp = send_ingest(convex_url, ingest_token, batch)
                    
                    try:
                        result_json = resp.json()
                    except Exception:
                        result_json = {}
                    
                    if resp.status_code == 200 and result_json.get("success", True):
                        # Success - batch was committed
                        actual_inserted = result_json.get("inserted", len(batch))
                        actual_skipped = result_json.get("skipped", 0)
                        
                        stats["inserted"] += actual_inserted
                        stats["skipped"] += actual_skipped
                        logger.info(f"✓ Batch {batch_num}: inserted={actual_inserted}, skipped={actual_skipped}")
                    else:
                        # Failure - batch was rolled back
                        stats["errors"] += len(batch)
                        
                        # Extract detailed error info
                        error_msg = result_json.get("error", f"HTTP {resp.status_code}")
                        error_detail = result_json.get("detail", resp.text[:500] if resp.text else "No details")
                        was_rolled_back = result_json.get("rollback", False)
                        
                        # Calculate exact failure position
                        global_batch_start = global_offset + batch_start_idx
                        global_batch_end = global_offset + i
                        
                        stats["failed_at"] = {
                            "batch_num": batch_num,
                            "batch_size": len(batch),
                            "local_row_range": (batch_start_idx, i),
                            "global_row_range": (global_batch_start, global_batch_end),
                            "error": error_msg,
                            "detail": error_detail,
                            "rolled_back": was_rolled_back,
                        }
                        
                        logger.error(f"")
                        logger.error(f"{'='*60}")
                        logger.error(f"❌ BATCH {batch_num} FAILED")
                        logger.error(f"{'='*60}")
                        logger.error(f"Batch size: {len(batch)} galaxies")
                        logger.error(f"Local row range: {batch_start_idx} - {i}")
                        logger.error(f"Global row range (with offset): {global_batch_start} - {global_batch_end}")
                        logger.error(f"Error: {error_msg}")
                        logger.error(f"Detail: {error_detail}")
                        if was_rolled_back:
                            logger.error(f"Status: Batch was ROLLED BACK (no data committed)")
                        logger.error(f"{'='*60}")
                        logger.error(f"")
                        
                        if not continue_on_error:
                            raise RuntimeError(
                                f"Batch {batch_num} failed at global rows {global_batch_start}-{global_batch_end}: {error_msg}"
                            )
                else:
                    logger.info(f"🔍 DRY RUN batch {batch_num}: would insert {len(batch)} galaxies")
                    stats["inserted"] += len(batch)
                
                batch = []
                progress = (i + 1) / stats["total"] * 100
                logger.info(f"Progress: {i+1}/{stats['total']} ({progress:.1f}%)")
                
                if not dry_run:
                    time.sleep(0.1)
                    
        except RuntimeError:
            # Re-raise RuntimeError (our controlled failure)
            raise
        except Exception as e:
            # Unexpected error during row processing
            stats["errors"] += 1
            global_row = global_offset + i
            stats["failed_at"] = {
                "batch_num": i // batch_size + 1,
                "local_row": i,
                "global_row": global_row,
                "error": "Row processing error",
                "detail": str(e),
            }
            logger.error(f"❌ Error processing row {i} (global row {global_row}): {e}")
            if not continue_on_error:
                raise
    
    return stats


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Ingest galaxies (split schema objects) from parquet")
    parser.add_argument("--parquet-file", required=True, help="Parquet file path")
    parser.add_argument("--convex-http-actions-url", help="Convex ingestion URL")
    parser.add_argument("--ingest-token", help="Ingest API token")
    parser.add_argument("--dot-env-file", help="Dotenv file (default .env)")
    parser.add_argument("--batch-size", type=int, default=200, help="Batch size for ingestion (default: 200)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--offset", type=int, default=0, help="Row offset to start processing (default: 0)")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of rows to process (default: all)")
    parser.add_argument("--continue-on-error", action="store_true", help="Continue with next batch on error (default: stop immediately)")
    args = parser.parse_args()

    try:
        config = load_configuration(args.convex_http_actions_url, args.ingest_token, args.dot_env_file)
        parquet_file = Path(args.parquet_file)
        if not parquet_file.exists():
            raise FileNotFoundError(f"File not found: {parquet_file}")
        df = pd.read_parquet(parquet_file)
        total_rows = len(df)
        offset = args.offset if args.offset >= 0 else 0
        limit = args.limit if args.limit is not None and args.limit > 0 else None
        if limit is not None:
            df = df.iloc[offset:offset+limit]
        else:
            df = df.iloc[offset:]
        logger.info(f"✓ Loaded {len(df)} rows from {parquet_file} (offset={offset}, limit={limit})")
        # logger.info("📋 Sample:\n" + df.head().to_string())

        if not args.dry_run:
            resp = input(f"❓ Proceed ingesting {len(df)} galaxies? (y/N): ")
            if resp.lower() != "y":
                logger.info("❌ Cancelled")
                return
        
        # Pass the global offset so error messages show correct row numbers in original file
        stats = process_parquet(
            df, 
            config["convex_url"], 
            config["ingest_token"], 
            args.batch_size, 
            args.dry_run, 
            args.continue_on_error,
            global_offset=offset
        )
        
        # Print summary
        logger.info("")
        logger.info("=" * 60)
        logger.info("INGESTION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total rows processed: {stats['total']}")
        logger.info(f"Successfully inserted: {stats['inserted']}")
        logger.info(f"Skipped (already exist): {stats['skipped']}")
        logger.info(f"Errors: {stats['errors']}")
        
        if stats.get("failed_at"):
            logger.error("")
            logger.error("FAILURE DETAILS:")
            for key, value in stats["failed_at"].items():
                logger.error(f"  {key}: {value}")
            logger.error("")
            logger.error("To resume, use:")
            if "global_row_range" in stats["failed_at"]:
                resume_offset = stats["failed_at"]["global_row_range"][0]
            elif "global_row" in stats["failed_at"]:
                resume_offset = stats["failed_at"]["global_row"]
            else:
                resume_offset = offset
            logger.error(f"  --offset {resume_offset}")
        
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        print(f"\n❌ Exception detail:\n{traceback.format_exc()}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
