from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class PointNetSemanticSeg(nn.Module):
    """Small PointNet-style semantic segmentation network.

    Input:  [B, C, N] where C=6 => normalized XYZ + face normal XYZ
    Output: [B, K, N]
    """

    def __init__(self, in_channels: int = 6, num_classes: int = 5):
        super().__init__()
        self.conv1 = nn.Conv1d(in_channels, 64, 1)
        self.bn1 = nn.BatchNorm1d(64)
        self.conv2 = nn.Conv1d(64, 128, 1)
        self.bn2 = nn.BatchNorm1d(128)
        self.conv3 = nn.Conv1d(128, 256, 1)
        self.bn3 = nn.BatchNorm1d(256)

        self.seg1 = nn.Conv1d(64 + 256, 256, 1)
        self.sbn1 = nn.BatchNorm1d(256)
        self.seg2 = nn.Conv1d(256, 128, 1)
        self.sbn2 = nn.BatchNorm1d(128)
        self.seg3 = nn.Conv1d(128, 64, 1)
        self.sbn3 = nn.BatchNorm1d(64)
        self.out = nn.Conv1d(64, num_classes, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        local = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(local)))
        x = F.relu(self.bn3(self.conv3(x)))

        global_feature = torch.max(x, dim=2, keepdim=True).values
        global_feature = global_feature.expand(-1, -1, local.shape[2])

        x = torch.cat([local, global_feature], dim=1)
        x = F.relu(self.sbn1(self.seg1(x)))
        x = F.relu(self.sbn2(self.seg2(x)))
        x = F.relu(self.sbn3(self.seg3(x)))
        return self.out(x)
