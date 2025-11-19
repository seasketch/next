import rasterio
from rasterio.enums import Resampling
from rasterio.warp import calculate_default_transform, reproject, Resampling as WarpResampling
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
from typing import Optional, Callable
import os
import time
import threading


def process_raster(input_file: str, output_file: str, progress_callback: Optional[Callable] = None):
    """
    Reproject a GeoTIFF to EPSG:6933 and convert it to a Cloud‑Optimized GeoTIFF.

    Args:
        input_file: Path to input GeoTIFF file.
        output_file: Path where the COG will be written.
        progress_callback: Optional callback (phase, current, total) for progress updates.
    """
    # Target CRS: EPSG:6933 (World Mollweide, equal‑area)
    target_crs = 'EPSG:6933'
    
    # Base COG profile (tiled, compressed) from rio-cogeo
    cog_profile = cog_profiles.get("deflate")
    
    # Disable disk space check to avoid issues with large reprojections
    with rasterio.Env(CHECK_DISK_FREE_SPACE=False):
        temp_output = output_file + ".tmp"
        print(f"[raster] Starting processing. input={input_file}, temp_output={temp_output}")

        with rasterio.open(input_file) as src:
            # Check if reprojection is needed
            src_crs_str = str(src.crs) if src.crs else None
            needs_reprojection = src_crs_str != target_crs
            
            num_bands = src.count
            width = src.width
            height = src.height

            print(
                f"[raster] Source CRS={src.crs}, target CRS={target_crs}, "
                f"size={src.width}x{src.height}, bands={num_bands}"
            )
            # Source pixel size in source CRS units (e.g., metres for EPSG:3857)
            try:
                src_xres, src_yres = src.res
                src_xres = abs(src_xres)
                src_yres = abs(src_yres)
                print(f"[raster] Source pixel size ~ {src_xres:.3f} x {src_yres:.3f}")
            except Exception:
                src_xres, src_yres = None, None

            # Report scanning progress
            if progress_callback is not None:
                try:
                    progress_callback('scanning', 0, 1)
                except Exception:
                    pass
            
            if needs_reprojection:
                print(f"[raster] Reprojecting from {src.crs} to {target_crs} ...")

                # Ask GDAL/PROJ for the default target grid. This can oversample heavily
                # for some projections, so we may need to adjust it.
                transform_nominal, w_nominal, h_nominal = calculate_default_transform(
                    src.crs, target_crs, src.width, src.height, *src.bounds
                )
                nominal_xres = abs(transform_nominal.a)
                nominal_yres = abs(transform_nominal.e)
                nominal_extent_x = nominal_xres * w_nominal
                nominal_extent_y = nominal_yres * h_nominal
                nominal_pixels = w_nominal * h_nominal
                input_pixels = src.width * src.height
                oversampling = (
                    float(nominal_pixels) / float(input_pixels)
                    if input_pixels > 0
                    else float("inf")
                )
                # Decide whether to trust the default grid or adjust it. If the default
                # grid has a reasonable number of pixels (e.g. up to 8x the source),
                # we keep it as‑is; otherwise we derive a coarser grid to keep the
                # dataset size manageable.
                SAFE_OVERSAMPLING_FACTOR = 8.0

                if oversampling <= SAFE_OVERSAMPLING_FACTOR:
                    # Use the nominal grid unchanged.
                    transform, width, height = transform_nominal, w_nominal, h_nominal
                    print(
                        "[raster] Using GDAL default target grid: "
                        f"size={width}x{height}, pixel size ~ {nominal_xres:.3f} m, "
                        f"oversampling ~{oversampling:.1f}x"
                    )
                else:
                    # Derive a square‑pixel grid that keeps width close to the source
                    # and scales height by the warped extent.
                    if src_xres is not None and src_yres is not None:
                        res = nominal_extent_x / src.width
                        print(
                            f"[raster] GDAL default grid size={w_nominal}x{h_nominal} "
                            f"(oversampling ~{oversampling:.1f}x); "
                            f"deriving adjusted grid with pixel size ~ {res:.3f} m"
                        )

                        width = src.width
                        height = int(round(nominal_extent_y / res))
                        print(f"[raster] CLI-like target grid size: {width}x{height}")

                        # Refine the transform for the requested output size.
                        transform, width, height = calculate_default_transform(
                            src.crs,
                            target_crs,
                            src.width,
                            src.height,
                            *src.bounds,
                            dst_width=width,
                            dst_height=height,
                        )
                    else:
                        # Fallback: if we can't inspect source resolution, keep the
                        # nominal grid even if it oversamples.
                        transform, width, height = transform_nominal, w_nominal, h_nominal
                        print(
                            "[raster] Could not inspect source resolution; falling back "
                            "to nominal GDAL grid despite high oversampling."
                        )

                pixel_width = transform.a
                pixel_height = -transform.e if transform.e < 0 else transform.e
                total_pixels = width * height
                print(
                    f"[raster] Target grid: {width}x{height} "
                    f"(~{total_pixels} pixels), pixel size ~ {pixel_width:.3f} x {pixel_height:.3f}"
                )

                # Prepare metadata for the reprojected temp file
                kwargs = src.meta.copy()
                kwargs.update(
                    {
                        "crs": target_crs,
                        "transform": transform,
                        "width": width,
                        "height": height,
                    }
                )

                # Signal the start of the processing phase (reprojection + COG creation).
                if progress_callback is not None:
                    try:
                        progress_callback("processing_start", 0, height)
                    except Exception:
                        pass

                # Reproject to a temporary file using multi‑band, multi‑threaded reproject.
                threads = os.cpu_count() or 1

                reprojected_temp = output_file + ".reprojected.tmp"
                print(f"[raster] Writing reprojected temp file to {reprojected_temp}")

                # Heartbeat thread: sends progress updates during a long reproject
                # call based on elapsed time (we do not have a true per‑pixel signal).
                stop_heartbeat = threading.Event()
                ASSUMED_REPROJECT_SECONDS = 30.0
                HEARTBEAT_INTERVAL_SECONDS = 3.0

                def _heartbeat(start_time: float):
                    last_progress_value: Optional[int] = None
                    while not stop_heartbeat.wait(HEARTBEAT_INTERVAL_SECONDS):
                        if progress_callback is None:
                            continue
                        try:
                            elapsed = time.time() - start_time
                            if ASSUMED_REPROJECT_SECONDS > 0:
                                frac = min(max(elapsed / ASSUMED_REPROJECT_SECONDS, 0.0), 1.0)
                            else:
                                frac = 1.0
                            # Map elapsed time into [0 .. height*0.5] so reprojection
                            # occupies the lower half of the processing band.
                            target_current = int(frac * (height * 0.5))
                            # Ensure we never go backwards.
                            if last_progress_value is not None:
                                target_current = max(target_current, last_progress_value)
                            last_progress_value = target_current

                            progress_callback("processing", target_current, height)
                        except Exception:
                            break

                hb_thread: Optional[threading.Thread] = None
                start_reproject = time.time()
                if progress_callback is not None:
                    hb_thread = threading.Thread(
                        target=_heartbeat, args=(start_reproject,), daemon=True
                    )
                    hb_thread.start()

                try:
                    with rasterio.open(reprojected_temp, "w", **kwargs) as dst:
                        reproject(
                            source=rasterio.band(src, list(range(1, num_bands + 1))),
                            destination=rasterio.band(dst, list(range(1, num_bands + 1))),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform,
                            dst_crs=target_crs,
                            resampling=WarpResampling.nearest,
                            num_threads=threads,
                        )

                        # Copy metadata
                        dst.update_tags(**src.tags())
                        for band_idx in range(1, num_bands + 1):
                            dst.update_tags(band_idx, **src.tags(band_idx))
                finally:
                    # Stop heartbeat thread.
                    if hb_thread is not None:
                        stop_heartbeat.set()
                        hb_thread.join(timeout=1.0)

                total_reproject_elapsed = time.time() - start_reproject
                try:
                    temp_size = os.path.getsize(reprojected_temp)
                    print(f"[raster] Reprojection complete in {total_reproject_elapsed:.2f}s (temp size={temp_size} bytes)")
                except Exception:
                    print(f"[raster] Reprojection complete in {total_reproject_elapsed:.2f}s")

                # Use reprojected file as input for COG creation
                cog_input = reprojected_temp
            else:
                # No reprojection needed; use the source file directly for COG creation.
                cog_input = input_file
                print("[raster] Skipping reprojection; using source file as-is for COG creation")
                
                # Report processing start
                if progress_callback is not None:
                    try:
                        progress_callback('processing_start', 0, height)
                    except Exception:
                        pass
            
            # Create COG from the (possibly reprojected) input.
            print("[raster] Creating COG with rio-cogeo...")
            
            # Report that we're starting COG creation
            if progress_callback is not None:
                try:
                    if needs_reprojection:
                        # We've done reprojection (50% of work), now doing COG creation
                        progress_callback('processing', int(height * 0.5), height)
                    else:
                        progress_callback('processing', 0, height)
                except Exception:
                    pass
            
            # rio-cogeo's API does not expose a progress callback, so we approximate
            # COG progress with a time‑based heartbeat similar to reprojection.
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
                        if ASSUMED_COG_SECONDS > 0:
                            frac = min(
                                max(elapsed / ASSUMED_COG_SECONDS, 0.0),
                                1.0,
                            )
                        else:
                            frac = 1.0

                        if needs_reprojection:
                            base = int(height * 0.5)
                        else:
                            base = 0
                        span = height - base
                        target_current = base + int(frac * span)

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
                    cog_input,
                    temp_output,
                    cog_profile,
                    in_memory=False,
                    quiet=True,  # Suppress rio-cogeo's own progress output
                )
            finally:
                if cog_hb_thread is not None:
                    stop_cog_heartbeat.set()
                    cog_hb_thread.join(timeout=1.0)
            
            # Report COG creation complete
            if progress_callback is not None:
                try:
                    progress_callback('processing', height, height)
                except Exception:
                    pass
            
            # Clean up reprojected temp file if it was created
            if needs_reprojection and os.path.exists(reprojected_temp):
                try:
                    os.remove(reprojected_temp)
                except Exception:
                    pass
    
    # Move temp file to final output
    os.rename(temp_output, output_file)
    
    # Log basic metadata for the resulting COG.
    with rasterio.open(output_file) as final:
        final_width = final.width
        final_height = final.height
        final_crs = str(final.crs) if final.crs else "Unknown"
        overview_levels = final.overviews(1) if final.overviews(1) else []
    
    print(f"Created cloud-optimized GeoTIFF: {output_file}")
    print(f"  CRS: {final_crs}")
    print(f"  Bands: {num_bands}")
    print(f"  Size: {final_width}x{final_height}")
    print(f"  Overview levels: {overview_levels}")
