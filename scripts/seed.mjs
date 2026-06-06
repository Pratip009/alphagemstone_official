/**
 * Seed script — run with: node scripts/seed.mjs
 * Requires MONGODB_URI in environment or .env file
 *
 * Creates:
 *  - 1 admin user (admin@gemstone.com / admin123)
 *  - 1 regular user (user@gemstone.com / user123)
 *  - 2 categories (diamonds, gemstones)
 *  - 4 subcategories
 *  - 50 sample products
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pratiptest_db_user:pratipkayalgemstone@cluster0.yoh1ght.mongodb.net/gemstone-shop';

// ── Minimal inline schemas (no TypeScript required for seed) ──────────────────
const UserSchema = new mongoose.Schema({ name: String, email: String, password: String, role: String });
const CategorySchema = new mongoose.Schema({ name: String, slug: String, isActive: Boolean });
const SubcategorySchema = new mongoose.Schema({ name: String, slug: String, category: mongoose.Schema.Types.ObjectId, isActive: Boolean });
const ProductSchema = new mongoose.Schema({
  name: String, category: mongoose.Schema.Types.ObjectId,
  subcategory: mongoose.Schema.Types.ObjectId, price: Number,
  shape: String, size: Number, color: String, clarity: String,
  certification: String, images: [String], stock: Number,
  isActive: Boolean, description: String,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', SubcategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const SHAPES = ['round', 'oval', 'princess', 'cushion', 'emerald', 'pear', 'marquise'];
const COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const CLARITIES = ['FL', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'];
const CERTS = ['GIA', 'AGS', 'IGI', 'none'];

// ── Image pools by shape (diamonds) ──────────────────────────────────────────
// Multiple images per shape so products feel varied
const DIAMOND_IMAGES = {
  round: [
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1589674781759-c21c37956a44?w=600&h=600&fit=crop',
  ],
  oval: [
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1573408301185-9519f94f7cbe?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1583937443787-0ab2a2b41db1?w=600&h=600&fit=crop',
  ],
  princess: [
    'https://images.unsplash.com/photo-1616751408093-fa51e82a8090?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1586104195538-050b9f74f58e?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1612541983539-4f03d9dad20b?w=600&h=600&fit=crop',
  ],
  cushion: [
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?w=600&h=600&fit=crop',
  ],
  emerald: [
    'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1598560917505-59a3ad559071?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1603561604478-a8a11c0bc0e4?w=600&h=600&fit=crop',
  ],
  pear: [
    'https://images.unsplash.com/photo-1568944650015-e4d973e36201?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1601121141461-9d6647bef0a1?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?w=600&h=600&fit=crop',
  ],
  marquise: [
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1598560917505-59a3ad559071?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&h=600&fit=crop',
  ],
};

// ── Image pools by gemstone type ──────────────────────────────────────────────
const GEMSTONE_IMAGES = {
  ruby: [
    'https://images.unsplash.com/photo-1601906109706-f5b9fd5f5bfa?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1596367407372-96cb88503db4?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1614440976223-f36e8cf31c84?w=600&h=600&fit=crop',
  ],
  emerald: [
    'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1551122102-77b0e0b5f4f5?w=600&h=600&fit=crop',
  ],
};

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randNum(min, max, decimals = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(decimals)); }

// Pick 2–3 images for a product so detail page can show a gallery
function getDiamondImages(shape) {
  const pool = DIAMOND_IMAGES[shape] || DIAMOND_IMAGES.round;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

function getGemstoneImages(type) {
  const pool = GEMSTONE_IMAGES[type] || GEMSTONE_IMAGES.ruby;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clean
  await Promise.all([User.deleteMany({}), Category.deleteMany({}), Subcategory.deleteMany({}), Product.deleteMany({})]);
  console.log('Cleared existing data');

  // Users
  const adminPw = await bcrypt.hash('admin123', 12);
  const userPw = await bcrypt.hash('user123', 12);
  await User.insertMany([
    { name: 'Admin', email: 'admin@gemstone.com', password: adminPw, role: 'admin' },
    { name: 'Test User', email: 'user@gemstone.com', password: userPw, role: 'user' },
  ]);
  console.log('✅ Users created');

  // Categories
  const [diamonds, gemstones] = await Category.insertMany([
    { name: 'Diamonds', slug: 'diamonds', isActive: true },
    { name: 'Gemstones', slug: 'gemstones', isActive: true },
  ]);
  console.log('✅ Categories created');

  // Subcategories
  const [loose, rings, rubies, emeralds] = await Subcategory.insertMany([
    { name: 'Loose Diamonds', slug: 'loose-diamonds', category: diamonds._id, isActive: true },
    { name: 'Diamond Rings', slug: 'diamond-rings', category: diamonds._id, isActive: true },
    { name: 'Rubies', slug: 'rubies', category: gemstones._id, isActive: true },
    { name: 'Emeralds', slug: 'emeralds', category: gemstones._id, isActive: true },
  ]);
  console.log('✅ Subcategories created');

  // Products
  const products = [];
  for (let i = 0; i < 50; i++) {
    const isDiamond = i < 35;
    const shape = rand(SHAPES);
    const color = rand(COLORS);
    const clarity = rand(CLARITIES);
    const size = randNum(0.3, 5.0, 2);
    const cert = rand(CERTS);
    const gemType = i % 2 === 0 ? 'ruby' : 'emerald';

    // Realistic price based on size + quality
    const qualityMultiplier = CLARITIES.indexOf(clarity) < 3 ? 1.5 : 1;
    const colorMultiplier = COLORS.indexOf(color) < 4 ? 1.4 : 1;
    const price = Math.round(size * 2000 * qualityMultiplier * colorMultiplier * (0.8 + Math.random() * 0.4));

    products.push({
      name: isDiamond
        ? `${shape.charAt(0).toUpperCase() + shape.slice(1)} Diamond ${size}ct ${color}/${clarity}${cert !== 'none' ? ` ${cert}` : ''}`
        : `${size}ct ${gemType.charAt(0).toUpperCase() + gemType.slice(1)} ${rand(['Oval', 'Round', 'Cushion'])}`,
      category: isDiamond ? diamonds._id : gemstones._id,
      subcategory: isDiamond ? (i < 20 ? loose._id : rings._id) : (gemType === 'ruby' ? rubies._id : emeralds._id),
      price,
      shape,
      size,
      color: isDiamond ? color : rand(['fancy-red', 'fancy-green', 'other']),
      clarity,
      certification: cert,
      images: isDiamond ? getDiamondImages(shape) : getGemstoneImages(gemType),
      stock: Math.floor(Math.random() * 20) + 1,
      isActive: true,
      description: `Beautiful ${shape} cut ${isDiamond ? 'diamond' : gemType} with excellent brilliance.`,
    });
  }

  await Product.insertMany(products);
  console.log('✅ 50 products created with images');

  console.log('\n🎉 Seed complete!');
  console.log('Admin: admin@gemstone.com / admin123');
  console.log('User:  user@gemstone.com / user123');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
