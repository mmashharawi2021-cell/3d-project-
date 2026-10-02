from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

from model import PointNetSemanticSeg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--ground-truth", default="")
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--steps", type=int, default=70)
    ap.add_argument("--block-size", type=int, default=2048)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))

    d = np.load(args.data)
    features = d["features"].astype(np.float32)
    bootstrap_labels = d["labels"].astype(np.int64)
    labels = bootstrap_labels.copy()
    n_classes = 5

    class_names = ["roof", "wall", "ground", "debris", "other"]
    class_to_idx = {name: i for i, name in enumerate(class_names)}
    manual_truth = {}
    manual_train_idx = np.empty(0, dtype=np.int64)
    manual_val_idx = np.empty(0, dtype=np.int64)
    manual_val_labels = np.empty(0, dtype=np.int64)

    if args.ground_truth and Path(args.ground_truth).exists():
        gt = json.loads(Path(args.ground_truth).read_text(encoding="utf-8"))
        for item in gt.get("corrections", []):
            try:
                face_index = int(item["face_index"])
                label_name = str(item["label"])
            except (KeyError, TypeError, ValueError):
                continue
            if 0 <= face_index < len(labels) and label_name in class_to_idx:
                manual_truth[face_index] = class_to_idx[label_name]

    if manual_truth:
        gt_indices = np.array(sorted(manual_truth.keys()), dtype=np.int64)
        rng = np.random.default_rng(args.seed)
        shuffled = gt_indices.copy()
        rng.shuffle(shuffled)
        val_count = max(1, int(round(len(shuffled) * 0.2))) if len(shuffled) >= 10 else 0
        if val_count:
            manual_val_idx = np.sort(shuffled[:val_count])
            manual_train_idx = np.sort(shuffled[val_count:])
            manual_val_labels = np.array([manual_truth[int(i)] for i in manual_val_idx], dtype=np.int64)
        else:
            manual_train_idx = np.sort(shuffled)

        for i in manual_train_idx:
            labels[i] = manual_truth[int(i)]

    counts = np.bincount(labels, minlength=n_classes).astype(np.float64)
    class_weights = counts.sum() / np.maximum(counts, 1)
    class_weights = class_weights / class_weights.mean()
    train_allowed = np.ones(len(labels), dtype=bool)
    if len(manual_val_idx):
        train_allowed[manual_val_idx] = False
    class_indices = [np.flatnonzero((labels == c) & train_allowed) for c in range(n_classes)]
    manual_train_by_class = [
        manual_train_idx[np.array([manual_truth[int(i)] == c for i in manual_train_idx], dtype=bool)]
        if len(manual_train_idx) else np.empty(0, dtype=np.int64)
        for c in range(n_classes)
    ]

    model = PointNetSemanticSeg(in_channels=features.shape[1], num_classes=n_classes)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    loss_weights = torch.tensor(class_weights, dtype=torch.float32)

    history = []
    model.train()

    for epoch in range(args.epochs):
        epoch_loss = 0.0
        epoch_correct = 0
        epoch_total = 0

        for _ in range(args.steps):
            batches_x, batches_y = [], []
            for _b in range(args.batch_size):
                pieces = []
                base = args.block_size // n_classes
                remainder = args.block_size - base * n_classes
                for cls, pool in enumerate(class_indices):
                    take = base + (1 if cls < remainder else 0)
                    if len(pool):
                        pieces.append(np.random.choice(pool, size=take, replace=len(pool) < take))
                    else:
                        pieces.append(np.random.choice(len(labels), size=take, replace=True))
                idx = np.concatenate(pieces)

                if len(manual_train_idx):
                    manual_take = min(max(args.block_size // 4, 64), len(idx))
                    manual_pieces = []
                    per_class = max(1, manual_take // n_classes)
                    for cls, pool in enumerate(manual_train_by_class):
                        if len(pool):
                            manual_pieces.append(np.random.choice(pool, size=per_class, replace=len(pool) < per_class))
                    if manual_pieces:
                        manual_idx = np.concatenate(manual_pieces)
                        replace_count = min(len(manual_idx), len(idx))
                        idx[:replace_count] = manual_idx[:replace_count]

                np.random.shuffle(idx)
                batches_x.append(features[idx])
                batches_y.append(labels[idx])

            x = torch.from_numpy(np.stack(batches_x)).transpose(1, 2)
            y = torch.from_numpy(np.stack(batches_y))

            optimizer.zero_grad(set_to_none=True)
            logits = model(x)
            loss = F.cross_entropy(logits, y, weight=loss_weights)
            loss.backward()
            optimizer.step()

            epoch_loss += float(loss.item())
            pred = logits.argmax(dim=1)
            epoch_correct += int((pred == y).sum().item())
            epoch_total += int(y.numel())

        acc = epoch_correct / max(epoch_total, 1)
        row = {
            "epoch": epoch + 1,
            "loss": epoch_loss / args.steps,
            "sample_accuracy": acc,
        }
        history.append(row)
        print(json.dumps(row))

    manual_validation = None
    if len(manual_val_idx):
        model.eval()
        with torch.no_grad():
            x = torch.from_numpy(features[manual_val_idx][None]).transpose(1, 2)
            logits = model(x)
            pred = logits.argmax(dim=1).squeeze(0).cpu().numpy()
        acc = float(np.mean(pred == manual_val_labels))
        per_class = {}
        for ci, name in enumerate(class_names):
            mask = manual_val_labels == ci
            per_class[name] = float(np.mean(pred[mask] == manual_val_labels[mask])) if np.any(mask) else None
        manual_validation = {
            "count": int(len(manual_val_idx)),
            "accuracy": acc,
            "per_class_accuracy": per_class,
        }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "in_channels": features.shape[1],
            "num_classes": n_classes,
            "class_counts": counts.astype(int).tolist(),
            "history": history,
            "manual_ground_truth_total": int(len(manual_truth)),
            "manual_ground_truth_train": int(len(manual_train_idx)),
            "manual_ground_truth_validation": manual_validation,
        },
        out,
    )

    report = {
        "model": "PointNetSemanticSeg",
        "framework": "PyTorch",
        "epochs": args.epochs,
        "steps_per_epoch": args.steps,
        "block_size": args.block_size,
        "batch_size": args.batch_size,
        "class_counts": counts.astype(int).tolist(),
        "history": history,
        "manual_ground_truth_total": int(len(manual_truth)),
        "manual_ground_truth_train": int(len(manual_train_idx)),
        "manual_ground_truth_validation": manual_validation,
    }
    Path(args.report).write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
