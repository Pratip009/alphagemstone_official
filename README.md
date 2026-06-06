# 💎 GemStone Shop

A production-grade full-stack eCommerce platform for diamonds and gemstones. Built with Next.js 14 (App Router), MongoDB + Mongoose, JWT auth, and PayPal Checkout. **Engineered for 100k+ products with sub-100ms filter queries.**

---

## Tech Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Framework   | Next.js 14 (App Router, fullstack)|
| Styling     | Tailwind CSS                      |
| Database    | MongoDB via Mongoose (no Prisma)  |
| Auth        | JWT (jsonwebtoken + bcryptjs)     |
| Payment     | PayPal REST API v2                |
| File Import | csv-parser + xlsx                 |
| Validation  | Zod                               |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login / Signup pages
│   ├── (shop)/              # User-facing shop pages
│   │   ├── products/        # Browse + detail
│   │   ├── cart/
│   │   ├── checkout/        # PayPal integration
│   │   └── orders/
│   ├── admin/               # Admin UI pages
│   │   ├── products/        # Product management
│   │   ├── upload/          # CSV/Excel bulk import
│   │   ├── categories/      # Category management
│   │   └── orders/          # Order management
│   └── api/                 # API routes
│       ├── auth/            # login, signup, me
│       ├── products/        # public product API
│       ├── categories/      # public categories
│       ├── cart/            # authenticated cart
│       ├── orders/          # authenticated orders
│       ├── payment/         # PayPal create + capture
│       └── admin/           # admin-only APIs
│
├── components/
│   ├── ui/                  # Navbar, Pagination
│   ├── products/            # ProductCard, SortBar
│   ├── filters/             # FilterSidebar
│   └── cart/                # AddToCartButton
│
├── models/                  # Mongoose schemas + indexes
│   ├── User.ts
│   ├── Product.ts           ← Core model with 12 indexes
│   ├── Category.ts
│   ├── Subcategory.ts
│   ├── Cart.ts
│   └── Order.ts
│
├── services/                # Business logic layer
│   ├── productFilter.service.ts  ← Core filter engine
│   ├── product.service.ts
│   ├── auth.service.ts
│   ├── cart.service.ts
│   ├── order.service.ts
│   ├── paypal.service.ts
│   ├── category.service.ts
│   └── fileParser.service.ts
│
├── middleware/
│   └── auth.middleware.ts   # withAuth, withAdmin HOFs
│
├── hooks/
│   ├── useAuth.tsx          # JWT context + localStorage
│   └── useApi.ts            # Authenticated fetch helper
│
└── lib/
    ├── db.ts                # MongoDB singleton connection
    ├── jwt.ts               # sign/verify helpers
    └── api-response.ts      # Typed response helpers
```

---

## Filtering Strategy (Critical Design)

### Problem
With 100k+ products and ~8 simultaneous filter dimensions, naive queries produce full collection scans. This destroys response time at scale.

### Solution: Three-layer approach

#### 1. Dynamic Query Building (`productFilter.service.ts`)
Only clauses for active filter params are added to the query. An empty filter generates `{ isActive: true }` — uses the `isActive` index, not a collection scan.

```typescript
// Multi-select → $in (single index scan across values)
if (shapes.length) filter.shape = { $in: shapes };

// Range → $gte / $lte (uses B-tree range scan)
if (priceMin || priceMax) filter.price = { $gte: priceMin, $lte: priceMax };
```

#### 2. Strategic Index Coverage
```typescript
// Single-field (for individual filter use)
ProductSchema.index({ shape: 1 });
ProductSchema.index({ color: 1 });
ProductSchema.index({ clarity: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ size: 1 });

// Compound (for the most common query patterns)
ProductSchema.index({ category: 1, subcategory: 1 });   // nav drill-down
ProductSchema.index({ shape: 1, color: 1, clarity: 1 }); // 3C combo
ProductSchema.index({ category: 1, price: 1 });          // browse + budget
ProductSchema.index({ shape: 1, size: 1 });              // shape + carat

// Full filter coverage
ProductSchema.index({ category: 1, shape: 1, color: 1, clarity: 1, price: 1 });
```

**MongoDB's index intersection** handles cases where no single compound index matches all active filters — it merges results from multiple single-field indexes.

#### 3. Query Execution Optimization

```typescript
Product.find(query)
  .sort(sort)
  .skip(skip)
  .limit(limit)
  .populate('category', 'name slug')  // only fetch needed fields
  .lean()                             // ~3x faster — plain JS objects, no Mongoose overhead
```

**`.lean()` is critical:** Mongoose documents carry method overhead, change tracking, and prototype chains. For large result sets `.lean()` returns raw POJO objects — significantly faster for read-only operations.

#### 4. Parallel Execution
```typescript
const [{ products, total }, facets] = await Promise.all([
  listProducts(params),             // main query
  getProductFacets(params),         // aggregation for facet counts
]);
```
Count, data, and facets all run concurrently — no sequential waterfall.

#### 5. Facet Aggregation
The `$facet` pipeline runs a single aggregation pass across the base collection to produce all filter counts simultaneously:
```js
{
  $facet: {
    shapes: [{ $group: { _id: "$shape", count: { $sum: 1 } } }],
    colors: [{ $group: { _id: "$color", count: { $sum: 1 } } }],
    priceRange: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
    // ...
  }
}
```
This replaces 6 separate count queries with one.

---

## MongoDB Index Analysis

Run this in MongoDB shell to verify index usage on a real query:
```js
db.products.find({
  isActive: true,
  shape: { $in: ["round", "oval"] },
  color: { $in: ["D", "E", "F"] },
  clarity: { $in: ["VS1", "VS2"] },
  price: { $gte: 2000, $lte: 8000 }
}).explain("executionStats")
```
Expected: `IXSCAN` on compound index, `totalDocsExamined` ≈ result set size.

---

## Authentication Flow

```
Client                          Server
  |                               |
  |─ POST /api/auth/login ───────►|
  |                               |─ bcrypt.compare(password, hash)
  |                               |─ jwt.sign({ userId, email, role })
  |◄── { token, user } ──────────|
  |                               |
  |─ GET /api/cart ──────────────►|  Authorization: Bearer <token>
  | (with Bearer token)           |─ verifyToken(token) → JWTPayload
  |                               |─ req.user = { userId, role }
  |◄── cart data ─────────────────|
```

JWT payload contains `userId`, `email`, and `role`. The `withAdmin()` HOF wraps `withAuth()` and adds a role check.

---

## PayPal Integration Flow

```
1. User fills shipping → POST /api/orders → orderId returned
2. POST /api/payment/paypal/create { orderId }
   → Calls PayPal v2/checkout/orders (CAPTURE intent)
   → Returns approvalUrl
3. Frontend redirects user to PayPal approvalUrl
4. User pays on PayPal, redirected back
5. POST /api/payment/paypal/capture { paypalOrderId }
   → Calls PayPal v2/checkout/orders/:id/capture
   → Decrements product stock
   → Marks order as paid
   → Clears cart
```

---

## Bulk Upload Strategy

### Pipeline
```
File Upload (multipart)
  → Buffer extraction
  → Auto-detect CSV vs Excel by extension
  → Row-by-row normalize + validate
  → Category/Subcategory slug → ObjectId resolution (bulk lookup, not N+1)
  → Chunk into 500-row batches
  → Product.insertMany({ ordered: false }) per chunk
     (ordered:false continues on partial failure)
  → Collect per-row errors
  → Return summary: inserted, failed, errors[]
```

### CSV Format
```csv
name,category,subcategory,price,shape,size,color,clarity,certification,stock,images,description
Round Diamond 1ct,diamonds,loose-diamonds,4500,round,1.0,D,VS1,GIA,5,https://img1.jpg|https://img2.jpg,Excellent cut
```

Images are pipe-separated `|`. Category/subcategory use slugs.

---

## Setup

### 1. Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 2. Install
```bash
git clone <repo>
cd gemstone-shop
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local with your MongoDB URI, JWT secret, PayPal credentials
```

### 4. Seed database
```bash
npm run seed
# Creates: admin@gemstone.com / admin123
#          user@gemstone.com  / user123
# + 2 categories, 4 subcategories, 50 products
```

### 5. Run
```bash
npm run dev   # http://localhost:3000
```

---

## Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/gemstone-shop
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
```

Get PayPal sandbox credentials at: https://developer.paypal.com

---

## Role-Based Access Matrix

| Route Pattern              | Public | User | Admin |
|----------------------------|:------:|:----:|:-----:|
| GET /api/products          | ✅     | ✅   | ✅    |
| GET /api/products/:id      | ✅     | ✅   | ✅    |
| GET /api/categories        | ✅     | ✅   | ✅    |
| GET/POST /api/cart         | ❌     | ✅   | ✅    |
| POST /api/orders           | ❌     | ✅   | ✅    |
| GET /api/orders            | ❌     | ✅   | ✅    |
| POST /api/payment/paypal/* | ❌     | ✅   | ✅    |
| /api/admin/*               | ❌     | ❌   | ✅    |

---

## Performance Targets

| Operation               | Target    | Strategy                              |
|-------------------------|-----------|---------------------------------------|
| Product list (filtered) | < 50ms    | Compound indexes + `.lean()`          |
| Facet aggregation       | < 100ms   | `$facet` pipeline + index coverage    |
| Product detail          | < 20ms    | Single document lookup by `_id`       |
| Bulk insert (1000 rows) | < 2s      | `insertMany` in 500-row chunks        |
| Cart operations         | < 30ms    | `findOneAndUpdate` + `$push`/`$pull`  |
