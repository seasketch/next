import rasterio
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
from typing import Optional, Callable
import os
import time
import threading


def _get_source_epsg(crs) -> int:
    """
    Extract a numeric EPSG code from a rasterio CRS object.

    Raises ValueError if the CRS is missing or cannot be identified as a
    recognised EPSG code.
    """
    if crs is None:
        raise ValueError(
            "The raster has no coordinate reference system (CRS). "
            "Please re-upload with a defined CRS."
        )

    # Try the direct EPSG accessor first (returns int or None).
    epsg = crs.to_epsg()
    if epsg is not None:
        return int(epsg)

    # Fall back to authority-based lookup (e.g. ("EPSG", "4326")).
    authority = crs.to_authority()
    if authority and str(authority[0]).upper() == "EPSG":
        try:
            return int(authority[1])
        except (ValueError, TypeError):
            pass

    raise ValueError(
        f"Could not identify the raster CRS as an EPSG code (CRS: {crs}). "
        "Please re-upload with a recognised EPSG coordinate system (e.g. EPSG:4326)."
    )


def process_raster(
    input_file: str,
    output_file: str,
    progress_callback: Optional[Callable] = None,
) -> int:
    """
    Validate the raster projection and convert it to a Cloud-Optimized GeoTIFF
    in its original projection.  No reprojection is performed.

    Args:
        input_file: Path to the input GeoTIFF file.
        output_file: Path where the COG will be written.
        progress_callback: Optional callback(phase, current, total).

    Returns:
        The source EPSG code as an integer.

    Raises:
        ValueError: If the raster CRS cannot be identified as a supported EPSG code.
    """
    cog_profile = cog_profiles.get("deflate")

    with rasterio.Env(CHECK_DISK_FREE_SPACE=False):
        temp_output = output_file + ".tmp"
        print(f"[raster] Starting processing. input={input_file}, temp_output={temp_output}")

        with rasterio.open(input_file) as src:
            # Validate and extract the source EPSG code.
            source_epsg = _get_source_epsg(src.crs)

            num_bands = src.count
            width = src.width
            height = src.height

            print(
                f"[raster] Source CRS={src.crs} (EPSG:{source_epsg}), "
                f"size={width}x{height}, bands={num_bands}"
            )

            try:
                src_xres, src_yres = src.res
                print(f"[raster] Source pixel size ~ {abs(src_xres):.6f} x {abs(src_yres):.6f}")
            except Exception:
                pass

        # Report scanning complete.
        if progress_callback is not None:
            try:
                progress_callback("scanning", 1, 1)
            except Exception:
                pass

        # Report processing start.
        if progress_callback is not None:
            try:
                progress_callback("processing_start", 0, height)
            except Exception:
                pass

        # Create COG from the source file directly (no reprojection).
        print("[raster] Creating COG with rio-cogeo...")

        # Time-based heartbeat for COG progress (rio-cogeo has no callback).
        stop_cog_heartbeat = threading.Event()
        ASSUMED_COG_SECONDS = 30.0
        COG_HEARTBEAT_INTERVAL_SECONDS = 3.0

        def _cog_heartbeat(start_time: float) -> None:
            last_progress_value: Optional[int] = None
            while not stop_cog_heartbeat.wait(COG_HEARTBEAT_INTERVAL_SECONDS):
                if progress_callback is None:
                    continue
                try:
                    elapsed = time.time() - start_time
                    frac = (
                        min(max(elapsed / ASSUMED_COG_SECONDS, 0.0), 1.0)
                        if ASSUMED_COG_SECONDS > 0
                        else 1.0
                    )
                    target_current = int(frac * height)
                    if last_progress_value is not None:
                        target_current = max(target_current, last_progress_value)
                    last_progress_value = target_current
                    progress_callback("processing", target_current, height)
                except Exception:
                    break

        cog_hb_thread: Optional[threading.Thread] = None
        cog_start = time.time()
        if progress_callback is not None:
            cog_hb_thread = threading.Thread(
                target=_cog_heartbeat, args=(cog_start,), daemon=True
            )
            cog_hb_thread.start()

        try:
            cog_translate(
                input_file,
                temp_output,
                cog_profile,
                in_memory=False,
                quiet=True,
            )
        finally:
            if cog_hb_thread is not None:
                stop_cog_heartbeat.set()
                cog_hb_thread.join(timeout=1.0)

        # Report COG creation complete.
        if progress_callback is not None:
            try:
                progress_callback("processing", height, height)
            except Exception:
                pass

    # Move temp file to final output.
    os.rename(temp_output, output_file)

    # Log basic metadata for the resulting COG.
    with rasterio.open(output_file) as final:
        final_width = final.width
        final_height = final.height
        final_crs = str(final.crs) if final.crs else "Unknown"
        overview_levels = final.overviews(1) if final.overviews(1) else []

    print(f"Created cloud-optimized GeoTIFF: {output_file}")
    print(f"  CRS: {final_crs} (EPSG:{source_epsg})")
    print(f"  Bands: {num_bands}")
    print(f"  Size: {final_width}x{final_height}")
    print(f"  Overview levels: {overview_levels}")

    return source_epsg
