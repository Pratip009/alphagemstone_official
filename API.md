# GemStone Shop — API Documentation

Base URL: `http://localhost:3000/api`

All authenticated endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## AUTH

### POST /api/auth/signup
Create a new user account.

**Request:**
```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "password": "securepass123"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": { "id": "664a...", "name": "Alice Smith", "email": "alice@example.com", "role": "user" }
  }
}
```

---

### POST /api/auth/login
```json
{ "email": "admin@gemstone.com", "password": "admin123" }
```
**Response 200:** same shape as signup

---

### GET /api/auth/me
`Authorization: Bearer <token>` — returns current user.

---

## PRODUCTS (Public)

### GET /api/products
Browse products with filtering, sorting, and pagination.

**All query params:**
| Param         | Type   | Example                     | Notes                        |
|---------------|--------|-----------------------------|------------------------------|
| category      | string | `664abc...`                 | MongoDB ObjectId             |
| subcategory   | string | `664def...`                 | MongoDB ObjectId             |
| shape         | string | `round,oval,princess`       | Comma-separated multi-select |
| color         | string | `D,E,F,G`                   | Comma-separated multi-select |
| clarity       | string | `VS1,VS2,SI1`               | Comma-separated multi-select |
| certification | string | `GIA,AGS`                   | Comma-separated multi-select |
| priceMin      | number | `1000`                      | Range filter                 |
| priceMax      | number | `5000`                      | Range filter                 |
| sizeMin       | number | `0.5`                       | Carat range filter           |
| sizeMax       | number | `2.0`                       | Carat range filter           |
| inStock       | bool   | `true`                      | Only in-stock items          |
| q             | string | `round diamond`             | Full-text search             |
| sortBy        | string | `price_asc`                 | See sort options below       |
| page          | number | `1`                         | Default: 1                   |
| limit         | number | `20`                        | Default: 20, max: 100        |
| facets        | bool   | `true`                      | Include filter facet counts  |

**Sort options:** `newest` `oldest` `price_asc` `price_desc` `size_asc` `size_desc`

**Example — complex filter:**
```
GET /api/products?shape=round,oval&color=D,E,F&clarity=VS1,VS2&priceMin=2000&priceMax=8000&sizeMin=1.0&sizeMax=3.0&inStock=true&sortBy=price_asc&page=1&limit=24&facets=true
```

**Response 200:**
```json
{
  "success": true,
  "data": [ { "_id": "...", "name": "Round Diamond 1.5ct D/VS1", "price": 4500, ... } ],
  "pagination": {
    "total": 142,
    "page": 1,
    "limit": 24,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": false
  },
  "facets": {
    "shapes": [{ "_id": "round", "count": 42 }, { "_id": "oval", "count": 28 }],
    "colors": [{ "_id": "D", "count": 15 }, { "_id": "E", "count": 22 }],
    "clarities": [{ "_id": "VS1", "count": 30 }, { "_id": "VS2", "count": 25 }],
    "priceRange": [{ "min": 500, "max": 45000 }],
    "sizeRange": [{ "min": 0.3, "max": 5.0 }]
  }
}
```

---

### GET /api/products/:id
```
GET /api/products/664a1b2c3d4e5f6a7b8c9d0e
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "664a...",
    "name": "Round Diamond 1.5ct D/VS1 GIA",
    "category": { "_id": "...", "name": "Diamonds", "slug": "diamonds" },
    "subcategory": { "_id": "...", "name": "Loose Diamonds", "slug": "loose-diamonds" },
    "price": 4500,
    "shape": "round",
    "size": 1.5,
    "color": "D",
    "clarity": "VS1",
    "certification": "GIA",
    "images": ["https://..."],
    "stock": 3,
    "description": "...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## CATEGORIES (Public)

### GET /api/categories
```
GET /api/categories
GET /api/categories?withSubcategories=true
```

---

## CART (Authenticated)

### GET /api/cart
Returns cart + calculated totals.

### POST /api/cart
```json
{ "productId": "664a...", "quantity": 1 }
```

### PUT /api/cart
Update quantity:
```json
{ "productId": "664a...", "quantity": 3 }
```

### DELETE /api/cart?productId=664a...
Remove item from cart.

---

## ORDERS (Authenticated)

### POST /api/orders
Create order from current cart:
```json
{
  "shippingAddress": {
    "fullName": "Alice Smith",
    "addressLine1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "US",
    "phone": "+1-555-0100"
  },
  "paymentMethod": "paypal"
}
```
**Response 201:** Full order object with `_id` for PayPal flow.

### GET /api/orders
List current user's orders.

### GET /api/orders/:id
Get single order (own orders only, unless admin).

---

## PAYMENT — PayPal Flow

### STEP 1: POST /api/payment/paypal/create
```json
{ "orderId": "664order..." }
```
**Response:**
```json
{
  "success": true,
  "data": {
    "paypalOrderId": "5O190127TN364715T",
    "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T"
  }
}
```
→ Redirect user to `approvalUrl`

### STEP 2: POST /api/payment/paypal/capture
After user approves on PayPal:
```json
{ "paypalOrderId": "5O190127TN364715T" }
```
**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Payment captured successfully",
    "order": { "_id": "...", "status": "paid", "paymentStatus": "completed" }
  }
}
```
→ Stock decremented, cart cleared, order marked paid.

---

## ADMIN ENDPOINTS
All require `Authorization: Bearer <admin_token>`

### POST /api/admin/products
```json
{
  "name": "Princess Diamond 2ct E/VVS1 GIA",
  "category": "664catId...",
  "subcategory": "664subId...",
  "price": 12000,
  "shape": "princess",
  "size": 2.0,
  "color": "E",
  "clarity": "VVS1",
  "certification": "GIA",
  "images": ["https://cdn.example.com/diamond1.jpg"],
  "stock": 2,
  "description": "Exceptional princess cut diamond."
}
```

### GET /api/admin/products
List all products (including inactive). Params: `page`, `limit`.

### PUT /api/admin/products/:id
Partial update — send only changed fields.

### DELETE /api/admin/products/:id
Soft-deletes (sets `isActive: false`).

---

### POST /api/admin/bulk-upload
`Content-Type: multipart/form-data`
- Field: `file` — `.csv` or `.xlsx`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Processed 250 rows",
    "inserted": 247,
    "failed": 3,
    "errors": [
      { "row": 12, "error": "Invalid shape: \"triangular\". Valid: round, oval, ..." },
      { "row": 45, "error": "Category not found: \"coloured-stones\"" }
    ]
  }
}
```

### GET /api/admin/bulk-upload
Downloads the CSV template file.

---

### POST /api/admin/categories
```json
{ "name": "Coloured Stones", "description": "Natural coloured gemstones" }
```

### POST /api/admin/subcategories
```json
{ "name": "Sapphires", "categoryId": "664catId..." }
```

### GET /api/admin/orders
List all orders. Params: `page`, `limit`, `status` filter.

### PUT /api/admin/orders/:id
Update order status:
```json
{ "status": "shipped" }
```
Valid statuses: `pending` `paid` `processing` `shipped` `delivered` `cancelled` `refunded`
