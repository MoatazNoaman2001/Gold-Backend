# إعداد الذكاء الاصطناعي لتوليد أوصاف المنتجات

## المشكلة التي تم حلها
كان النظام يفشل في توليد أوصاف المنتجات تلقائياً باستخدام الذكاء الاصطناعي بسبب عدم وجود مفتاح OpenAI API.

## الحل المطبق

### 1. إضافة مفتاح OpenAI API
تم إضافة المتغير التالي إلى ملف `.env`:
```
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. إصلاح الأخطاء في الكود
- تم إصلاح خطأ في دالة `generateVariations` حيث كان يتم تمرير `productId` بدلاً من بيانات المنتج
- تم إصلاح دالة `regenerateDescription` لاستخدام البيانات الصحيحة للمنتج

## كيفية الحصول على مفتاح OpenAI API

### الخطوات:
1. اذهب إلى [OpenAI Platform](https://platform.openai.com/)
2. قم بإنشاء حساب أو تسجيل الدخول
3. اذهب إلى [API Keys](https://platform.openai.com/api-keys)
4. انقر على "Create new secret key"
5. انسخ المفتاح واحفظه في مكان آمن
6. استبدل `your-openai-api-key-here` في ملف `.env` بالمفتاح الحقيقي

### مثال:
```
OPENAI_API_KEY=sk-proj-abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx
```

## كيفية عمل النظام

### عند إنشاء منتج جديد:
1. إذا تم ترك حقل الوصف فارغاً، سيقوم النظام تلقائياً بتوليد وصف باستخدام AI
2. إذا تم إدخال وصف، سيتم استخدام الوصف المدخل

### الميزات المتاحة:
- **توليد وصف تلقائي**: عند ترك الوصف فارغاً
- **إعادة توليد الوصف**: `/product/regenerate-description/:productId`
- **توليد عدة خيارات**: `/product/generateDescriptionVariations/:productId`

### النماذج المستخدمة:
- **النموذج**: `gpt-4o-mini` (اقتصادي وسريع)
- **اللغة**: يدعم العربية والإنجليزية تلقائياً
- **طول الوصف**: 25-30 كلمة للوصف المختصر، 50-100 كلمة للوصف المفصل

## اختبار النظام

### 1. اختبار التوليد التلقائي:
```bash
# إنشاء منتج بدون وصف
curl -X POST http://localhost:5005/product/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=خاتم ذهبي" \
  -F "price=50000" \
  -F "karat=21K" \
  -F "weight=10" \
  -F "design_type=rings" \
  -F "shop=SHOP_ID"
```

### 2. اختبار إعادة التوليد:
```bash
curl -X GET http://localhost:5005/product/regenerate-description/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## استكشاف الأخطاء

### خطأ: "OPENAI_API_KEY environment variable is missing"
- تأكد من وجود المفتاح في ملف `.env`
- تأكد من إعادة تشغيل الخادم بعد إضافة المفتاح

### خطأ: "Invalid API key"
- تأكد من صحة المفتاح
- تأكد من وجود رصيد في حساب OpenAI

### خطأ: "Rate limit exceeded"
- انتظر قليلاً قبل المحاولة مرة أخرى
- فكر في ترقية خطة OpenAI

## ملاحظات مهمة
- احتفظ بمفتاح API في مكان آمن
- لا تشارك المفتاح مع أحد
- راقب استخدامك لتجنب تجاوز الحدود المسموحة
- يمكن تغيير النموذج المستخدم في ملف `aiProductDescriptionService.js`
