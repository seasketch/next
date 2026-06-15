GEOMETRY_TYPE_PREFIX_QUALIFIERS = ("3D", "Measured")
GEOMETRY_TYPE_SUFFIX_QUALIFIERS = ("Z", "M", "ZM")


def normalize_geometry_type(geometry_type):
    """Return the base OGC geometry type, dropping Z/M schema qualifiers."""
    if isinstance(geometry_type, dict):
        geometry_type = geometry_type.get("type")
    if not isinstance(geometry_type, str):
        return geometry_type
    parts = geometry_type.split()
    while parts and parts[0] in GEOMETRY_TYPE_PREFIX_QUALIFIERS:
        parts = parts[1:]
    while parts and parts[-1] in GEOMETRY_TYPE_SUFFIX_QUALIFIERS:
        parts = parts[:-1]
    return " ".join(parts) if parts else geometry_type


def geometry_type_has_extra_dimensions(geometry_type):
    """True if the schema geometry type advertises Z/M coordinates."""
    if isinstance(geometry_type, dict):
        geometry_type = geometry_type.get("type")
    if not isinstance(geometry_type, str):
        return False
    parts = geometry_type.split()
    return bool(
        parts
        and (
            parts[0] in GEOMETRY_TYPE_PREFIX_QUALIFIERS
            or parts[-1] in GEOMETRY_TYPE_SUFFIX_QUALIFIERS
        )
    )


def _strip_coordinate_dimensions(coords):
    if not isinstance(coords, (list, tuple)):
        return coords
    if len(coords) >= 2 and all(isinstance(value, (int, float)) for value in coords[:2]):
        return [coords[0], coords[1]]
    return [_strip_coordinate_dimensions(part) for part in coords]


def strip_extra_dimensions(geometry):
    """Return a GeoJSON-like geometry with coordinate Z/M dimensions removed."""
    if geometry is None:
        return None

    geom = dict(geometry)
    geom_type = normalize_geometry_type(geom.get("type"))
    geom["type"] = geom_type

    if geom_type == "GeometryCollection":
        geom["geometries"] = [
            strip_extra_dimensions(part) for part in geom.get("geometries", [])
        ]
    elif "coordinates" in geom:
        geom["coordinates"] = _strip_coordinate_dimensions(geom.get("coordinates"))

    return geom
