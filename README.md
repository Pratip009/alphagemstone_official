# 💎 GemStone Shop - Official

A **production-grade full-stack eCommerce platform** for diamonds and gemstones. Built with **Next.js 15**, **MongoDB + Mongoose**, **JWT authentication**, and **PayPal Checkout**. **Engineered to scale to 100k+ products** with sophisticated filtering, multi-carrier shipping integration, and comprehensive admin controls.

---

## 🎯 Project Overview

**GemStone Shop** is a complete e-commerce solution designed for luxury gemstone retailers. It combines modern web technologies with advanced database optimization to deliver fast, scalable shopping experiences. Whether you're selling diamonds, gemstones, or fine jewelry, this platform handles complex product filtering, payment processing, order management, and shipping logistics out of the box.

### Key Features

✅ **Full-stack TypeScript** (98.8% of codebase)  
✅ **Advanced product filtering** with 8+ dimensions and faceted search  
✅ **Multi-carrier shipping** (USPS, UPS, FedEx integration)  
✅ **Secure JWT authentication** with role-based access control  
✅ **PayPal Checkout integration** for seamless payments  
✅ **Bulk product import** (CSV & Excel support)  
✅ **Real-time inventory management**  
✅ **Admin dashboard** for product & order management  
✅ **Optimized for 100k+ products** with smart indexing  
✅ **Responsive UI** with Tailwind CSS + Framer Motion animations  

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | Next.js 15 (App Router, fullstack) | Server components, API routes, image optimization |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Database** | MongoDB + Mongoose | NoSQL database with ODM |
| **Authentication** | JWT (jsonwebtoken + bcryptjs) | Stateless auth, role-based access |
| **Payment** | PayPal REST API v2 | Checkout and payment capture |
| **Rich Text Editor** | TipTap (Prosemirror-based) | Product descriptions with formatting |
| **3D Graphics** | Three.js | Product visualization (optional) |
| **File Import** | csv-parser + xlsx | Bulk product uploads |
| **Validation** | Zod | Type-safe runtime validation |
| **Animations** | Framer Motion + GSAP | UI transitions and effects |
| **Type Safety** | TypeScript 5 | Full static typing |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Public authentication pages
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   │
│   ├── (shop)/                    # Customer-facing shop pages
│   │   ├── products/
│   │   │   ├── page.tsx           # Browse & filter products
│   │   │   └── [id]/page.tsx      # Product detail view
│   │   ├── cart/page.tsx          # Shopping cart
│   │   ├── checkout/page.tsx      # PayPal checkout flow
│   │   └── orders/
│   │       ├── page.tsx           # Order history
│   │       └── [id]/page.tsx      # Order details & tracking
│   │
│   ├── admin/                     # Admin dashboard (role-gated)
│   │   ├── products/
│   │   │   ├── page.tsx           # Manage products
│   │   │   └── [id]/edit/page.tsx # Edit product
│   │   ├── upload/page.tsx        # CSV/Excel bulk import
│   │   ├── categories/page.tsx    # Manage categories
│   │   └── orders/page.tsx        # Manage all orders
│   │
│   └── api/                       # RESTful API routes
│       ├── auth/
│       │   ├── signup/route.ts
│       │   ├── login/route.ts
│       │   └── me/route.ts        # Get current user
│       │
│       ├── products/
│       │   ├── route.ts           # GET (list/filter), POST (admin)
│       │   └── [id]/route.ts      # GET, PUT, DELETE
│       │
│       ├── cart/
│       │   └── route.ts           # GET, POST, PUT, DELETE
│       │
│       ├── orders/
│       │   ├── route.ts           # GET (list), POST (create)
│       │   └── [id]/route.ts      # GET (single)
│       │
│       ├── payment/
│       │   └── paypal/
│       │       ├── create/route.ts    # Initiate payment
│       │       └── capture/route.ts   # Capture payment
│       │
│       ├── shipping/              # Multi-carrier shipping
│       │   ├── rates/route.ts
│       │   ├── track/route.ts
│       │   ├── usps/
│       │   ├── ups/
│       │   └── fedex/
│       │
│       └── admin/                 # Admin-only endpoints
│           ├── products/route.ts
│           ├── bulk-upload/route.ts
│           ├── categories/route.ts
│           ├── subcategories/route.ts
│           └── orders/[id]/route.ts
│
├── components/
│   ├── ui/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Pagination.tsx
│   │   └── Modal.tsx
│   │
│   ├── products/
│   │   ├── ProductCard.tsx        # Reusable product display
│   │   ├── ProductGrid.tsx        # Product list layout
│   │   └── SortBar.tsx            # Sort & view options
│   │
│   ├── filters/
│   │   └── FilterSidebar.tsx      # Multi-select faceted filters
│   │
│   ├── cart/
│   │   ├── CartSummary.tsx
│   │   └── AddToCartButton.tsx
│   │
│   └── shipping/
│       ├── ShippingRateSelector.tsx
│       └── OrderTracking.tsx
│
├── models/                        # Mongoose schemas
│   ├── User.ts
│   │   └── Fields: name, email, password (hashed), role, createdAt
│   │
│   ├── Product.ts                # Core product model - heavily indexed
│   │   └── Fields: name, category, subcategory, price, shape, size,
│   │      color, clarity, certification, stock, images, description,
│   │      isActive, createdAt
│   │   └── 12 indexes for optimal query performance
│   │
│   ├── Category.ts
│   │   └── Fields: name, slug, description
│   │
│   ├── Subcategory.ts
│   │   └── Fields: name, slug, categoryId, description
│   │
│   ├── Cart.ts
│   │   └── Fields: userId, items (productId + quantity), lastModified
│   │
│   └── Order.ts
│       └── Fields: userId, items, shippingAddress, paymentMethod,
│          paymentStatus, orderStatus, trackingNumber, shippingCarrier,
│          totalAmount, createdAt
│
├── services/                      # Business logic layer
│   ├── productFilter.service.ts   # ⭐ Core filtering engine (100k optimization)
│   ├── product.service.ts         # CRUD operations
│   ├── auth.service.ts            # JWT & password hashing
│   ├── cart.service.ts            # Cart operations
│   ├── order.service.ts           # Order creation & management
│   ├── paypal.service.ts          # PayPal API integration
│   ├── category.service.ts        # Category management
│   ├── fileParser.service.ts      # CSV/Excel parsing
│   ├── shipping.aggregator.ts     # Multi-carrier rate aggregation
│   ├── usps.service.ts            # USPS integration
│   ├── ups.service.ts             # UPS integration
│   └── fedex.service.ts           # FedEx integration
│
├── middleware/
│   └── auth.middleware.ts         # withAuth(), withAdmin() HOFs
│
├── hooks/
│   ├── useAuth.tsx                # JWT context + localStorage
│   ├── useApi.ts                  # Authenticated fetch helper
│   └── useFilters.ts              # Client-side filter state management
│
├── types/
│   ├── models.ts                  # TypeScript interfaces for DB models
│   ├── api.ts                     # API request/response types
│   └── shipping.ts                # Shipping types (carriers, rates, tracking)
│
└── lib/
    ├── db.ts                      # MongoDB singleton connection
    ├── jwt.ts                     # sign/verify JWT helpers
    ├── api-response.ts            # Typed response builders
    ├── validation.ts              # Zod schemas
    ├── errors.ts                  # Custom error classes
    └── shipping-config.ts         # Store location, package defaults

public/                            # Static assets
├── images/
└── templates/

scripts/
└── seed.mjs                       # Database seeding script
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (LTS recommended)
- **MongoDB 5.0+** (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cloud)
- **npm** or **yarn**

### 1. Clone Repository
```bash
git clone https://github.com/alphaimports/alphagemstone_official.git
cd alphagemstone_official
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/gemstone-shop

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# PayPal (get from https://developer.paypal.com)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Shipping (optional but recommended)
USPS_USER_ID=your-usps-user-id
UPS_CLIENT_ID=your-ups-client-id
UPS_CLIENT_SECRET=your-ups-client-secret
UPS_ACCOUNT_NUMBER=your-ups-account

# Public URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-paypal-client-id
```

### 4. Seed Database (Optional - Sets Up Demo Data)
```bash
npm run seed
```

This creates:
- **Admin account:** `admin@gemstone.com` / `admin123`
- **Test user:** `user@gemstone.com` / `user123`
- **2 categories** + **4 subcategories** + **50 sample products**

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm run seed` | Populate database with demo data |

---

## 🔐 Authentication & Authorization

### JWT Flow
```
User signs up/logs in
    ↓
Server hashes password with bcryptjs
    ↓
Server signs JWT: { userId, email, role }
    ↓
Client stores JWT in localStorage
    ↓
For authenticated requests: Authorization: Bearer <token>
    ↓
Server verifies JWT → req.user populated
```

### Role-Based Access Control (RBAC)

| Endpoint | Public | User | Admin |
|----------|:------:|:----:|:-----:|
| `GET /api/products` | ✅ | ✅ | ✅ |
| `GET /api/products/:id` | ✅ | ✅ | ✅ |
| `GET /api/categories` | ✅ | ✅ | ✅ |
| `GET/POST /api/cart` | ❌ | ✅ | ✅ |
| `POST /api/orders` | ❌ | ✅ | ✅ |
| `GET /api/orders` | ❌ | ✅ | ✅ |
| `POST /api/payment/*` | ❌ | ✅ | ✅ |
| `/api/admin/*` | ❌ | ❌ | ✅ |

### Middleware Usage
```typescript
import { withAuth, withAdmin } from '@/middleware/auth.middleware';

// Protect route for authenticated users
export const GET = withAuth(async (req, context) => {
  const { userId, email, role } = req.user; // ← Available after middleware
  // ...
});

// Protect route for admins only
export const POST = withAdmin(async (req, context) => {
  // Only admins can reach this
  // ...
});
```

---

## 🛍️ Advanced Product Filtering (100k Scale)

### The Problem
With 100k+ products and ~8 simultaneous filter dimensions, naive queries cause full collection scans, destroying performance.

### The Solution: Three-Layer Architecture

#### 1. **Dynamic Query Building** (`productFilter.service.ts`)
Only active filter clauses are included in the database query:

```typescript
const filter: any = { isActive: true }; // Always filter for active products

// Multi-select → uses $in operator
if (shapes.length) filter.shape = { $in: shapes };

// Range queries → uses $gte/$lte for efficient range scans
if (priceMin || priceMax) {
  filter.price = {
    ...(priceMin && { $gte: priceMin }),
    ...(priceMax && { $lte: priceMax })
  };
}

// Full-text search (if implemented with text index)
if (searchQuery) filter.$text = { $search: searchQuery };

// Result: minimal query for MAXIMUM index efficiency
```

#### 2. **Strategic MongoDB Indexing**

**Single-field indexes** (for individual filter use):
```typescript
ProductSchema.index({ shape: 1 });
ProductSchema.index({ color: 1 });
ProductSchema.index({ clarity: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ size: 1 });
ProductSchema.index({ isActive: 1 });
```

**Compound indexes** (for common multi-filter queries):
```typescript
// Category navigation drill-down
ProductSchema.index({ category: 1, subcategory: 1 });

// Most common 3C filter (shape + color + clarity)
ProductSchema.index({ shape: 1, color: 1, clarity: 1 });

// Browse by category + budget
ProductSchema.index({ category: 1, price: 1 });

// Shape + carat weight search
ProductSchema.index({ shape: 1, size: 1 });

// Full multi-filter coverage
ProductSchema.index({
  category: 1,
  shape: 1,
  color: 1,
  clarity: 1,
  price: 1
});
```

**MongoDB's automatic index intersection** handles cases where no single compound index matches all active filters—it merges results from multiple indexes.

#### 3. **Query Execution Optimization**

```typescript
Product.find(query)
  .sort(sort)                          // Apply sorting
  .skip((page - 1) * limit)            // Pagination
  .limit(limit)
  .populate('category', 'name slug')   // Only fetch needed fields
  .lean()                              // ⭐ Critical: ~3x faster
  .exec()
```

**Why `.lean()` is critical:** Mongoose documents carry method overhead, change tracking, and prototype chains. For large result sets, `.lean()` returns plain JavaScript objects—**significantly faster** for read-heavy queries.

#### 4. **Parallel Execution**

```typescript
// Fetch product data AND facet counts concurrently
const [{ products, total }, facets] = await Promise.all([
  listProducts(params),        // Main product query
  getProductFacets(params),    // Aggregation for filter counts
]);
```

No sequential waterfall—count, data, and facets run simultaneously.

#### 5. **Facet Aggregation Pipeline**

The `$facet` aggregation stage runs a **single pass** across the filtered collection to produce all filter counts:

```javascript
db.products.aggregate([
  { $match: baseFilter },  // Apply base query
  { $facet: {
      shapes: [{ $group: { _id: "$shape", count: { $sum: 1 } } }],
      colors: [{ $group: { _id: "$color", count: { $sum: 1 } } }],
      clarities: [{ $group: { _id: "$clarity", count: { $sum: 1 } } }],
      priceRange: [{ $group: {
        _id: null,
        min: { $min: "$price" },
        max: { $max: "$price" }
      }}],
      sizeRange: [{ $group: {
        _id: null,
        min: { $min: "$size" },
        max: { $max: "$size" }
      }}]
    }
  }
])
```

**Result:** One query replaces 6 separate count queries.

### Query Analysis Tool

Verify index usage in MongoDB shell:

```javascript
db.products.find({
  isActive: true,
  shape: { $in: ["round", "oval"] },
  color: { $in: ["D", "E", "F"] },
  clarity: { $in: ["VS1", "VS2"] },
  price: { $gte: 2000, $lte: 8000 }
}).explain("executionStats")
```

✅ **Expected result:** `IXSCAN` on compound index with `totalDocsExamined ≈ result set size`
❌ **Bad result:** `COLLSCAN` = full collection scan (add missing indexes!)

### Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Product list (filtered) | < 50ms | Compound indexes + `.lean()` |
| Facet aggregation | < 100ms | `$facet` pipeline + index coverage |
| Product detail | < 20ms | Single document lookup by `_id` |
| Bulk insert (1000 rows) | < 2s | `insertMany` in 500-row chunks |
| Cart operations | < 30ms | `findOneAndUpdate` + `$push`/`$pull` |

---

## 💳 PayPal Integration

### Flow
```
1. User completes order → POST /api/orders
   → Returns orderId
   
2. Client calls POST /api/payment/paypal/create { orderId }
   → Server calls PayPal v2/checkout/orders with CAPTURE intent
   → Returns approvalUrl
   
3. Client redirects user to PayPal
   
4. User authorizes payment
   
5. PayPal redirects back to app
   
6. Client calls POST /api/payment/paypal/capture { paypalOrderId }
   → Server captures payment
   → Decrements product stock
   → Clears user's cart
   → Marks order as PAID
```

### API Endpoints

**Create Payment:**
```bash
POST /api/payment/paypal/create
Content-Type: application/json
Authorization: Bearer <token>

{ "orderId": "664order123abc..." }
```

Response:
```json
{
  "success": true,
  "data": {
    "paypalOrderId": "5O190127TN364715T",
    "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T"
  }
}
```

**Capture Payment:**
```bash
POST /api/payment/paypal/capture
Content-Type: application/json
Authorization: Bearer <token>

{ "paypalOrderId": "5O190127TN364715T" }
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "Payment captured successfully",
    "order": {
      "_id": "...",
      "status": "paid",
      "paymentStatus": "completed"
    }
  }
}
```

---

## 📦 Bulk Product Upload

### Supported Formats
- **CSV** (.csv)
- **Excel** (.xlsx)

### Pipeline

1. File uploaded as multipart/form-data
2. Buffer extracted
3. Auto-detect format by file extension
4. Row-by-row normalization & validation
5. **Bulk lookup:** Category/Subcategory slugs → ObjectIds (no N+1 queries!)
6. Chunk into 500-row batches
7. `Product.insertMany({ ordered: false })` per batch
8. Collect per-row errors
9. Return summary

### CSV Format

```csv
name,category,subcategory,price,shape,size,color,clarity,certification,stock,images,description
Round Diamond 1ct,diamonds,loose-diamonds,4500,round,1.0,D,VS1,GIA,5,https://img1.jpg|https://img2.jpg,Excellent cut
Princess Diamond 2ct,diamonds,loose-diamonds,12000,princess,2.0,E,VVS1,GIA,2,https://img3.jpg,Premium quality
```

**Notes:**
- Images are pipe-separated (`|`)
- Category/Subcategory use slugs
- All fields required
- Price: numeric only
- Size: carat weight (decimal)

### Upload Response

```json
{
  "success": true,
  "data": {
    "message": "Processed 250 rows",
    "inserted": 247,
    "failed": 3,
    "errors": [
      {
        "row": 12,
        "error": "Invalid shape: \"triangular\". Valid: round, oval, princess, ..."
      },
      {
        "row": 45,
        "error": "Category not found: \"colored-stones\""
      }
    ]
  }
}
```

### API Usage

```bash
POST /api/admin/bulk-upload
Content-Type: multipart/form-data
Authorization: Bearer <admin-token>

# Form field: file=@products.csv
```

---

## 🚚 Multi-Carrier Shipping Integration

GemStone Shop integrates with **USPS**, **UPS**, and **FedEx** for real-time rate quotes and tracking.

### Carriers Supported

| Carrier | Auth | Rate API | Tracking | Address Val |
|---------|------|----------|----------|-------------|
| USPS | User ID | XML RateV4 | XML TrackV2 | XML Verify |
| UPS | OAuth 2.0 | JSON v2403 | JSON v1 | JSON XAV v2 |
| FedEx | OAuth 2.0 | JSON v1 | JSON v1 | JSON AV v1 |

### Setup Steps

1. **Add environment variables** to `.env.local`:
   ```env
   USPS_USER_ID=your-usps-user-id
   USPS_BASE_URL=https://secure.shippingapis.com/ShippingAPI.dll

   UPS_CLIENT_ID=your-ups-client-id
   UPS_CLIENT_SECRET=your-ups-client-secret
   UPS_ACCOUNT_NUMBER=your-ups-account
   UPS_BASE_URL=https://wwwcie.ups.com   # sandbox
   # Change to https://onlinetools.ups.com for production

   # FedEx (if implemented)
   FEDEX_CLIENT_ID=your-fedex-client-id
   FEDEX_CLIENT_SECRET=your-fedex-client-secret
   FEDEX_ACCOUNT_ID=your-fedex-account
   ```

2. **Update Order model** to include shipping fields:
   ```typescript
   shippingCarrier: string;        // 'USPS' | 'UPS' | 'FedEx'
   shippingService: string;        // e.g., 'Priority Mail'
   shippingRate: number;           // $amount
   trackingNumber: string;
   trackingUrl: string;
   estimatedDelivery: Date;
   ```

3. **Add shipping selector to checkout:**
   ```tsx
   <ShippingRateSelector
     origin={STORE_ORIGIN}
     destination={shippingAddress}
     package={DEFAULT_PACKAGE}
     onSelect={setSelectedShipping}
   />
   ```

### API Endpoints

**Get Rates from All Carriers:**
```bash
POST /api/shipping/rates
Authorization: Bearer <token>
Content-Type: application/json

{
  "origin": {
    "street1": "100 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "destination": {
    "street1": "450 Rose Ave",
    "city": "Los Angeles",
    "state": "CA",
    "postalCode": "90291",
    "country": "US"
  },
  "package": {
    "weightLbs": 0.5,
    "lengthIn": 8,
    "widthIn": 6,
    "heightIn": 3
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "byCarrier": {
      "usps": [
        {
          "carrier": "USPS",
          "service": "Priority Mail",
          "serviceCode": "USPS-PM",
          "rate": 7.40,
          "estimatedDays": 2,
          "estimatedDelivery": "2026-06-08T00:00:00Z"
        }
      ],
      "ups": [
        {
          "carrier": "UPS",
          "service": "UPS Ground",
          "serviceCode": "03",
          "rate": 11.20,
          "estimatedDays": 5
        }
      ],
      "fedex": [...]
    },
    "all": [ /* sorted by price */ ],
    "errors": [ /* any carrier failures */ ]
  }
}
```

**Track Package:**
```bash
POST /api/shipping/track
Authorization: Bearer <token>

{ "trackingNumber": "9400111899223482392269" }
```

Response includes full event history, current location, and estimated delivery date.

**Validate Address:**
```bash
POST /api/shipping/usps/validate-address

{
  "address": {
    "street1": "123 Main ST",
    "city": "boston",
    "state": "MA",
    "postalCode": "02108"
  }
}
```

---

## 📡 Complete API Reference

See **[API.md](./API.md)** for comprehensive endpoint documentation including:
- Authentication (signup, login, token refresh)
- Product browsing and filtering
- Cart management
- Order creation and retrieval
- PayPal payment flow
- Admin product management
- Category/subcategory management
- Bulk uploads

See **[SHIPPING.md](./SHIPPING.md)** for complete shipping integration details.

---

## 🗄️ Database Models

### User
```typescript
{
  name: string;
  email: string (unique);
  password: string (bcrypted);
  role: 'user' | 'admin';
  createdAt: Date;
}
```

### Product
```typescript
{
  name: string;
  category: ObjectId (ref: Category);
  subcategory: ObjectId (ref: Subcategory);
  price: number;
  shape: string;           // 'round', 'oval', 'princess', etc.
  size: number;            // carat weight
  color: string;           // 'D', 'E', 'F', 'G', etc.
  clarity: string;         // 'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'
  certification: string;   // 'GIA', 'AGS', 'EGL', etc.
  stock: number;
  images: string[];        // URLs
  description: string;
  isActive: boolean;       // Soft delete
  createdAt: Date;
  updatedAt: Date;
}
```

### Cart
```typescript
{
  userId: ObjectId (ref: User);
  items: Array<{
    productId: ObjectId (ref: Product);
    quantity: number;
  }>;
  lastModified: Date;
}
```

### Order
```typescript
{
  userId: ObjectId (ref: User);
  items: Array<{
    productId: ObjectId;
    name: string;
    price: number;
    quantity: number;
  }>;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  shippingCarrier?: string;
  shippingService?: string;
  shippingRate?: number;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  paymentMethod: 'paypal';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  paypalOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔧 Development Workflow

### Adding a New Product Filter

1. **Update Product model** with new field + index:
   ```typescript
   // In src/models/Product.ts
   ProductSchema.add({ newField: String });
   ProductSchema.index({ newField: 1 });
   ```

2. **Update productFilter.service.ts**:
   ```typescript
   if (params.newField) {
     query.newField = { $in: params.newField.split(',') };
   }
   ```

3. **Update API query params** documentation in `API.md`

4. **Add UI filter component** in `src/components/filters/`

5. **Test with sample data** using MongoDB shell `explain()`

### Adding a New API Endpoint

1. Create route file: `src/app/api/feature/route.ts`
2. Wrap with `withAuth()` or `withAdmin()` as needed
3. Use typed request/response helpers
4. Add Zod validation schema
5. Document in `API.md`

### Deploying to Production

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Set production env vars** (use platform like Vercel, Railway, Heroku):
   - Use production MongoDB URI
   - Rotate JWT_SECRET
   - Set PayPal credentials to production (not sandbox)
   - Update NEXT_PUBLIC_APP_URL

3. **Run migrations** if any database schema changes

4. **Test payment flow** with PayPal production sandbox accounts

---

## 📊 Performance Monitoring

### Key Metrics to Track

1. **Product List Response Time** (target: < 50ms)
   - Monitor filter + sort + pagination queries
   - Check index usage with `db.products.find(...).explain()`

2. **Database Index Coverage**
   - Regularly run explain() on slow queries
   - Add missing indexes

3. **API Latency**
   - Track endpoint response times
   - Monitor PayPal API calls
   - Monitor shipping rate requests

4. **Inventory Accuracy**
   - Monitor stock levels after orders
   - Implement stock reservation system for high-concurrency scenarios

### Optimization Tips

- ✅ Always use `.lean()` for read-heavy queries
- ✅ Use `$facet` for simultaneous counts instead of N queries
- ✅ Batch operations with `insertMany()` (up to 500-1000 rows per batch)
- ✅ Paginate large result sets (default 20, max 100)
- ✅ Use `.populate()` judiciously (only needed fields)
- ✅ Monitor slow query log: `db.setProfilingLevel(1, { slowms: 100 })`

---

## 🐛 Troubleshooting

### Products Not Showing Up

**Check:**
1. Is `isActive: true` set on products?
2. Are indexes created? Run: `db.products.getIndexes()`
3. Is MongoDB connection working? Check `lib/db.ts` logs

### PayPal Payment Fails

**Check:**
1. Are PayPal credentials correct? (Sandbox vs Production)
2. Does order exist in database?
3. Check PayPal order status in dashboard
4. Review server logs for API errors

### Bulk Upload Errors

**Check:**
1. Is CSV format correct? (All fields required)
2. Do categories exist? Upload fails if category slug not found
3. Check file encoding (should be UTF-8)
4. Check server logs for per-row errors

### Slow Product Queries

**Check:**
1. Run `db.products.find({...}).explain("executionStats")`
2. If `COLLSCAN`, add missing indexes from Product model
3. Check if `.lean()` is used in query
4. Verify facet aggregation isn't bottleneck

### Shipping Rate Calculation Errors

**Check:**
1. Are credentials correct? (USPS_USER_ID, UPS credentials, etc.)
2. Is origin/destination address valid?
3. Is package weight > 0?
4. Check server logs for carrier-specific errors

---

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Mongoose Docs](https://mongoosejs.com/)
- [PayPal Developer Portal](https://developer.paypal.com)
- [JWT Introduction](https://jwt.io/introduction)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TipTap Editor](https://tiptap.dev/)

---

## 📝 Environment Variables Reference

```env
# ==== REQUIRED ====

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gemstone-shop

# JWT & Auth
JWT_SECRET=your-min-32-character-secret-key-for-jwt-signing
JWT_EXPIRES_IN=7d

# PayPal (sandbox or production)
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_CLIENT_SECRET=your-client-secret
PAYPAL_MODE=sandbox

# Public URLs
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_PAYPAL_CLIENT_ID=same-as-above

# ==== OPTIONAL (Shipping) ====

USPS_USER_ID=your-usps-user-id
USPS_BASE_URL=https://secure.shippingapis.com/ShippingAPI.dll

UPS_CLIENT_ID=your-ups-client-id
UPS_CLIENT_SECRET=your-ups-client-secret
UPS_ACCOUNT_NUMBER=your-ups-account
UPS_BASE_URL=https://wwwcie.ups.com

# FedEx (if implemented)
FEDEX_CLIENT_ID=your-fedex-client-id
FEDEX_CLIENT_SECRET=your-fedex-client-secret
FEDEX_ACCOUNT_ID=your-fedex-account
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see LICENSE file for details.

---

## 💬 Support

For questions or issues:
1. Check existing [GitHub Issues](https://github.com/alphaimports/alphagemstone_official/issues)
2. Review documentation files (API.md, SHIPPING.md)
3. Create a new issue with detailed description

---

**Built with ❤️ for gemstone retailers worldwide.**

**Last Updated:** June 2026  
**Status:** Production-Ready ✅
