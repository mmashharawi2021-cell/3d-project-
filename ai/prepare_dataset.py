from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
import trimesh

CLASS_NAMES = ["roof", "wall", "ground", "debris", "other"]
ROOF, WALL, GROUND, DEBRIS, OTHER = range(5)


def load_world_mesh(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(path, force="scene", process=False)
    if isinstance(loaded, trimesh.Trimesh):
        return loaded

    meshes = []
    for node in loaded.graph.nodes_geometry:
        transform, geom_name = loaded.graph[node]
        geom = loaded.geometry[geom_name].copy()
        geom.apply_transform(transform)
        meshes.append(geom)

    if not meshes:
        raise RuntimeError("No triangle geometry found in GLB")
    return trimesh.util.concatenate(meshes)


def grid_index(points: np.ndarray, bbox_min: np.ndarray, bbox_max: np.ndarray, cols=30, rows=30):
    dx = max(float(bbox_max[0] - bbox_min[0]), 1e-8)
    dz = max(float(bbox_max[2] - bbox_min[2]), 1e-8)
    col = np.floor((points[:, 0] - bbox_min[0]) / dx * cols).astype(np.int32)
    row = np.floor((points[:, 2] - bbox_min[2]) / dz * rows).astype(np.int32)
    col = np.clip(col, 0, cols - 1)
    row = np.clip(row, 0, rows - 1)
    return row * cols + col


def connected_components(mask: np.ndarray, values: np.ndarray, cols: int, rows: int, max_step: float):
    seen = np.zeros(mask.size, dtype=np.uint8)
    comps = []
    for start in range(mask.size):
        if not mask[start] or seen[start]:
            continue
        q = deque([start])
        seen[start] = 1
        cells = []
        border = False
        while q:
            idx = q.popleft()
            cells.append(idx)
            r, c = divmod(idx, cols)
            border |= r == 0 or c == 0 or r == rows - 1 or c == cols - 1
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = r + dr, c + dc
                if rr < 0 or cc < 0 or rr >= rows or cc >= cols:
                    continue
                ni = rr * cols + cc
                if seen[ni] or not mask[ni]:
                    continue
                if np.isfinite(values[idx]) and np.isfinite(values[ni]) and abs(values[idx] - values[ni]) > max_step:
                    continue
                seen[ni] = 1
                q.append(ni)
        comps.append((cells, border))
    comps.sort(key=lambda x: len(x[0]), reverse=True)
    return comps


def pseudo_labels_v4(centers: np.ndarray, normals: np.ndarray, bbox_min: np.ndarray, bbox_max: np.ndarray):
    cols = rows = 30
    n_cells = cols * rows
    idx = grid_index(centers, bbox_min, bbox_max, cols, rows)
    y = centers[:, 1]
    horizontal = np.abs(normals[:, 1])
    model_h = max(float(bbox_max[1] - bbox_min[1]), 1e-8)

    low_y = np.full(n_cells, np.nan, dtype=np.float64)
    rough = np.zeros(n_cells, dtype=np.float32)
    horiz_ratio = np.zeros(n_cells, dtype=np.float32)
    counts = np.zeros(n_cells, dtype=np.int32)

    order = np.argsort(idx, kind="stable")
    sorted_idx = idx[order]
    starts = np.flatnonzero(np.r_[True, sorted_idx[1:] != sorted_idx[:-1]])
    ends = np.r_[starts[1:], len(order)]

    for s, e in zip(starts, ends):
        cell = sorted_idx[s]
        ids = order[s:e]
        counts[cell] = len(ids)
        yy = y[ids]
        k = min(5, len(yy))
        low_y[cell] = float(np.mean(np.partition(yy, k - 1)[:k]))
        rough[cell] = float(np.std(yy) / model_h)
        horiz_ratio[cell] = float(np.mean(horizontal[ids] >= 0.62))

    finite = low_y[np.isfinite(low_y)]
    p35 = float(np.quantile(finite, 0.35))
    p50 = float(np.quantile(finite, 0.50))

    candidate = np.zeros(n_cells, dtype=np.uint8)
    finite_mask = np.isfinite(low_y)
    low_enough = low_y <= p35 + model_h * 0.055
    surface_like = (horiz_ratio >= 0.24) | (rough <= 0.11)
    candidate[finite_mask & low_enough & surface_like] = 1

    comps = connected_components(candidate, low_y, cols, rows, model_h * 0.065)
    ground_mask = np.zeros(n_cells, dtype=np.uint8)
    seeds = []
    for ci, (cells, border) in enumerate(comps):
        keep = border or ci == 0 or len(cells) >= 8
        if keep:
            ground_mask[cells] = 1
            seeds.extend(cells)

    if len(seeds) < 6:
        seeds = np.flatnonzero(np.isfinite(low_y) & (low_y <= p50)).tolist()
        ground_mask[seeds] = 1

    # Plane y = ax + bz + c from seed cell centers.
    sx = (bbox_max[0] - bbox_min[0]) / cols
    sz = (bbox_max[2] - bbox_min[2]) / rows
    A, b = [], []
    for cell in seeds:
        r, c = divmod(cell, cols)
        x = bbox_min[0] + (c + 0.5) * sx
        z = bbox_min[2] + (r + 0.5) * sz
        A.append([x, z, 1.0])
        b.append(low_y[cell])
    if len(A) >= 3:
        plane = np.linalg.lstsq(np.asarray(A), np.asarray(b), rcond=None)[0]
    else:
        plane = np.array([0.0, 0.0, float(bbox_min[1])])

    cell_ground = np.empty(n_cells, dtype=np.float64)
    for cell in range(n_cells):
        r, c = divmod(cell, cols)
        x = bbox_min[0] + (c + 0.5) * sx
        z = bbox_min[2] + (r + 0.5) * sz
        py = plane[0] * x + plane[1] * z + plane[2]
        if ground_mask[cell] and np.isfinite(low_y[cell]):
            cell_ground[cell] = low_y[cell] * 0.68 + py * 0.32
        else:
            cell_ground[cell] = py

    rel_h = y - cell_ground[idx]
    cell_rough = rough[idx]
    is_ground_cell = ground_mask[idx].astype(bool)

    ground_tol = max(model_h * 0.032, 0.18)
    roof_min = max(model_h * 0.085, 0.75)
    wall_min = max(model_h * 0.035, 0.28)
    debris_max = max(model_h * 0.20, 1.6)

    labels = np.full(len(centers), OTHER, dtype=np.uint8)

    m = (rel_h <= ground_tol * 1.45) & (horizontal >= 0.54) & is_ground_cell
    labels[m] = GROUND
    m = (labels == OTHER) & (rel_h <= ground_tol) & (horizontal >= 0.68)
    labels[m] = GROUND
    m = (labels == OTHER) & (rel_h >= roof_min) & (horizontal >= 0.73) & (cell_rough <= 0.20)
    labels[m] = ROOF
    m = (labels == OTHER) & (rel_h >= wall_min) & (horizontal <= 0.36)
    labels[m] = WALL
    m = (
        (labels == OTHER)
        & (rel_h <= debris_max)
        & (rel_h > -ground_tol)
        & ((cell_rough >= 0.045) | ((horizontal > 0.25) & (horizontal < 0.76)))
    )
    labels[m] = DEBRIS
    m = (labels == OTHER) & (rel_h >= roof_min * 0.72) & (horizontal >= 0.62)
    labels[m] = ROOF
    m = (labels == OTHER) & (rel_h >= wall_min) & (horizontal < 0.56)
    labels[m] = WALL
    m = (labels == OTHER) & (rel_h <= ground_tol * 1.6) & (horizontal >= 0.50)
    labels[m] = GROUND

    return labels, {
        "grid": f"{cols}x{rows}",
        "ground_seed_cells": len(seeds),
        "ground_components": len(comps),
        "p35": p35,
        "p50": p50,
        "plane": plane.tolist(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mesh", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--meta", required=True)
    args = ap.parse_args()

    mesh = load_world_mesh(Path(args.mesh))
    centers = np.asarray(mesh.triangles_center, dtype=np.float32)
    normals = np.asarray(mesh.face_normals, dtype=np.float32)

    # Use mesh vertex bounds so centering matches Three.js Box3.setFromObject().
    bbox_min = np.asarray(mesh.bounds[0], dtype=np.float32)
    bbox_max = np.asarray(mesh.bounds[1], dtype=np.float32)
    center = (bbox_min + bbox_max) / 2.0
    scale = float(np.max(bbox_max - bbox_min))
    xyz_norm = (centers - center) / max(scale, 1e-8)

    labels, diagnostics = pseudo_labels_v4(centers, normals, bbox_min, bbox_max)
    features = np.concatenate([xyz_norm, normals], axis=1).astype(np.float32)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out,
        features=features,
        labels=labels,
        centers=(centers - center).astype(np.float32),
        center=center.astype(np.float32),
        scale=np.float32(scale),
    )

    counts = np.bincount(labels, minlength=len(CLASS_NAMES))
    meta = {
        "faces": int(len(labels)),
        "classes": CLASS_NAMES,
        "counts": {CLASS_NAMES[i]: int(counts[i]) for i in range(len(CLASS_NAMES))},
        "normalization_center": center.tolist(),
        "normalization_scale": scale,
        "pseudo_label_method": "v4-local-ground-bootstrap",
        "diagnostics": diagnostics,
    }
    Path(args.meta).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
