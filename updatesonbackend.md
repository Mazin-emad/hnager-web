## قائمة التغييرات للفرونت إند

### 1. Endpoints جديدة

| Method | Route                                       | Body                                    | Response                           |
| ------ | ------------------------------------------- | --------------------------------------- | ---------------------------------- |
| GET    | `/api/v1/products/{id}/lines-count-formula` | —                                       | `ProductLinesCountFormulaResponse` |
| PUT    | `/api/v1/products/{id}/lines-count-formula` | `UpsertProductLinesCountFormulaRequest` | `ProductLinesCountFormulaResponse` |

```json
// PUT body
{ "expression": "Length * Width / 250" }

// Response
{ "productId": "guid", "expression": "Length * Width / 250", "version": 1 }
```

- الـ `version` بيزيد مع كل تغيير في الـ expression فقط.
- الـ expression هنا يقبل **متغيرات المنتج فقط** — لو فيه `LinesCount` هيرجع `400`.

### 2. حقول جديدة في الـ Responses الحالية

**`ProductDetailResponse`** (يشمل `GetById` و `GetConfiguration`):

```json
{
  "quantityExpression": "...",
  "quantityFormulaVersion": 1,
  "linesCountExpression": "Length * Width / 250", // NEW (string|null)
  "linesCountFormulaVersion": 1 // NEW (int)
}
```

**`InvoiceProductResponse`** (جوه `InvoiceDetailResponse`):

```json
{
  "productQuantity": 50,
  "productQuantityFormulaSnapshot": "...",
  "productQuantityFormulaVersion": 1,
  "linesCount": 20, // NEW (decimal)
  "linesCountFormulaSnapshot": "Length * Width / 250", // NEW (string)
  "linesCountFormulaVersion": 1 // NEW (int)
}
```

- اعرض `linesCount` فقط — **لا تعرض** الـ formula.
- الـ PDF بقى يعرض: `المنتج — الكمية: 50 — عدد الخطوط: 20`.

### 3. سلوك الـ Item Formulas اتغير

- فورمولات الأصناف تقبل الآن key محجوز جديد: **`LinesCount`** (capital L و C — case-sensitive) بالإضافة لمتغيرات المنتج.
- يعني الـ Formula Builder للأصناف لازم يعرض `LinesCount` كمتغير متاح (derived/calculated).
- الـ Validate/Evaluate endpoints للأصناف يقبلوا `LinesCount` تلقائيًا. في الـ Evaluate ابعت `LinesCount` ضمن `sampleValues` لو الفورمولا بتستخدمه.
- فورمولا **الكمية** وفورمولا **عدد الخطوط** يرفضوا `LinesCount` (لمنع circular dependency).

### 4. قيد جديد على إنشاء المتغيرات

- إنشاء variable بـ key = `LinesCount` بالظبط بقى مرفوض (`400 - Variable.ReservedKey`).
- الفاليديشن: `^[a-zA-Z][a-zA-Z0-9_]*$` زي ما هو + منع الاسم المحجوز.
- الفرونت يفضل يمنع المستخدم من كتابته أصلًا في فورم إنشاء المتغيرات.

### 5. ملاحظات على الـ Invoice flow

- `AddProduct` و `Recalculate` بيرجعوا الآن الـ `linesCount` المحسوبة ضمن كل منتج — لا يوجد input يدوي لها من الفرونت.
- لو المنتج مالوش lines-count formula، القيمة الافتراضية `1` والـ version `0`.
- الـ Recalculate بيعيد حساب الكمية ثم عدد الخطوط ثم الأصناف بالترتيب — الفرونت مش محتاج يغير ترتيب النداءات.

### 6. Migration

- فيه migration جديدة (`AddProductLinesCountFormula`) — لازم تطبق على الداتابيز قبل ما الفرونت يجرب الـ endpoints الجديدة.
