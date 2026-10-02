# Gaza 3D GIS Lab — V2

مختبر ويب عربي لمعالجة وعرض نموذج **Gaza Strip 2014** ثلاثي الأبعاد، مع Spatial Pre-Segmentation هندسي تمهيدًا لإضافة AI Segmentation وGIS لاحقًا.

## الحالة الحالية

- عارض 3D باستخدام Three.js.
- دعم GLB/GLTF.
- حساب عدد الـMeshes والمثلثات وأبعاد النموذج.
- تقسيم النموذج إلى شبكات 4×3 / 6×5 / 8×6 / 12×8.
- تحديد كل منطقة بشكل مستقل.
- تلوين المناطق وWireframe.
- تصدير Metadata للمنطقة المحددة بصيغة JSON.
- واجهة عربية RTL ومتجاوبة.

## نموذج Gaza Strip 2014

الملف الأصلي المستخدم أثناء التطوير:

`models/gaza_strip_2014.glb`

حجمه يقارب **26 MB**. الكود يعمل أيضًا إذا لم يكن الملف موجودًا داخل المستودع: افتح الموقع واستخدم زر **تحميل GLB آخر** لاختيار الملف من جهازك.

للتشغيل التلقائي للنموذج، ضع الملف باسم:

`models/gaza_strip_2014.glb`

## التشغيل

شغّل Static HTTP Server من مجلد المشروع، مثل:

`python -m http.server 8080`

ثم افتح:

`http://127.0.0.1:8080`

## بيانات النموذج

- Title: Gaza Strip 2014
- Author: Assaf Bezalel (Bez)
- License: CC BY 4.0
- Triangles: 472,965
- OBJ source vertices: 237,316
- Coordinate system: Local / ungeoreferenced
- Source: https://sketchfab.com/3d-models/gaza-strip-2014-248951f05c38426aa4a0aa0ca3402bfe

يجب الحفاظ على نسبة العمل لصاحبه عند إعادة استخدام النموذج أو نشره.

## المرحلة التالية

Semantic AI Segmentation → Georeferencing → GIS Export.
