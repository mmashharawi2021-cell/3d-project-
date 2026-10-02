from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from model import PointNetSemanticSeg

CLASS_NAMES = ["roof", "wall", "ground", "debris", "other"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--chunk-size", type=int, default=8192)
    ap.add_argument("--display-points", type=int, default=220000)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    d = np.load(args.data)
    features = d["features"].astype(np.float32)
    pseudo = d["labels"].astype(np.uint8)
    centers = d["centers"].astype(np.float32)

    ckpt = torch.load(args.checkpoint, map_location="cpu")
    model = PointNetSemanticSeg(
        in_channels=int(ckpt["in_channels"]),
        num_classes=int(ckpt["num_classes"]),
    )
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    all_labels = np.empty(len(features), dtype=np.uint8)
    all_conf = np.empty(len(features), dtype=np.float16)

    with torch.no_grad():
        for start in range(0, len(features), args.chunk_size):
            end = min(start + args.chunk_size, len(features))
            x = torch.from_numpy(features[start:end][None]).transpose(1, 2)
            logits = model(x)
            prob = torch.softmax(logits, dim=1)
            conf, pred = prob.max(dim=1)
            all_labels[start:end] = pred.squeeze(0).cpu().numpy().astype(np.uint8)
            all_conf[start:end] = conf.squeeze(0).cpu().numpy().astype(np.float16)
            print(f"inference {end}/{len(features)}")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    all_labels.tofile(out_dir / "gaza_ai_labels.u8")
    all_conf.tofile(out_dir / "gaza_ai_confidence.f16")

    rng = np.random.default_rng(args.seed)
    if len(features) > args.display_points:
        display_idx = np.sort(rng.choice(len(features), size=args.display_points, replace=False))
    else:
        display_idx = np.arange(len(features))

    centers[display_idx].astype(np.float32).tofile(out_dir / "gaza_ai_points.f32")
    all_labels[display_idx].astype(np.uint8).tofile(out_dir / "gaza_ai_points_labels.u8")
    all_conf[display_idx].astype(np.float16).tofile(out_dir / "gaza_ai_points_confidence.f16")

    counts = np.bincount(all_labels, minlength=len(CLASS_NAMES))
    agreement = float(np.mean(all_labels == pseudo))
    mean_conf = float(np.mean(all_conf.astype(np.float32)))

    meta = {
        "schema": "gaza-3d-pointnet-result/v1",
        "model": "PointNetSemanticSeg",
        "framework": "PyTorch",
        "classes": CLASS_NAMES,
        "full_face_count": int(len(all_labels)),
        "display_point_count": int(len(display_idx)),
        "counts": {CLASS_NAMES[i]: int(counts[i]) for i in range(len(CLASS_NAMES))},
        "agreement_with_bootstrap_labels": agreement,
        "mean_confidence": mean_conf,
        "files": {
            "full_labels": "gaza_ai_labels.u8",
            "full_confidence": "gaza_ai_confidence.f16",
            "display_positions": "gaza_ai_points.f32",
            "display_labels": "gaza_ai_points_labels.u8",
            "display_confidence": "gaza_ai_points_confidence.f16",
        },
        "note": "First neural baseline trained from V4 bootstrap labels. Manual labels are required for semantic improvement beyond the bootstrap teacher.",
    }
    (out_dir / "gaza_ai_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
