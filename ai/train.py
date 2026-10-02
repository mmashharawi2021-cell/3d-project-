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
    labels = d["labels"].astype(np.int64)
    n_classes = int(labels.max()) + 1

    counts = np.bincount(labels, minlength=n_classes).astype(np.float64)
    class_weights = counts.sum() / np.maximum(counts, 1)
    class_weights = class_weights / class_weights.mean()
    sampling_weights = class_weights[labels]
    sampling_weights = sampling_weights / sampling_weights.sum()

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
                idx = np.random.choice(
                    len(labels),
                    size=args.block_size,
                    replace=True,
                    p=sampling_weights,
                )
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

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "in_channels": features.shape[1],
            "num_classes": n_classes,
            "class_counts": counts.astype(int).tolist(),
            "history": history,
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
    }
    Path(args.report).write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
