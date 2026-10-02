# Gaza 3D AI — PointNet Semantic Segmentation

هذه المرحلة هي أول مسار **Neural Network فعلي** داخل المشروع.

## المسار

```
Gaza GLB
  ↓
Triangle centroids + normals
  ↓
V4 bootstrap labels
  ↓
PointNet Semantic Segmentation (PyTorch)
  ↓
Full-scene inference
  ↓
Web point-cloud result + full per-face labels
```

الفئات الحالية:

- roof
- wall
- ground
- debris
- other

## مهم

النموذج العصبي في أول تشغيل يتعلم من Bootstrap Labels الخاصة بـV4. هذا يثبت خط التدريب والاستدلال الحقيقي، لكنه **لا يجعل النتيجة أفضل تلقائيًا من V4**. المرحلة التي تجعل النموذج يتفوق على القواعد الهندسية هي إدخال التصحيحات اليدوية الموثوقة كـGround Truth وإعادة التدريب عليها.

## التشغيل محليًا

```bash
pip install -r ai/requirements.txt
python ai/prepare_dataset.py --mesh models/gaza_strip_2014.glb --out ai/work/gaza_dataset.npz --meta ai/work/gaza_dataset_meta.json
python ai/train.py --data ai/work/gaza_dataset.npz --out ai/output/pointnet_gaza.pt --report ai/output/training_report.json
python ai/infer.py --data ai/work/gaza_dataset.npz --checkpoint ai/output/pointnet_gaza.pt --out-dir ai/output
```

GitHub Actions يقوم بنفس العملية تلقائيًا عند تحديث ملفات مسار AI.
