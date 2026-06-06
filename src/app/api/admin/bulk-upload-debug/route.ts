import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import Category from '@/models/Category';
import Subcategory from '@/models/Subcategory';
import mongoose from 'mongoose';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    await connectDB();

    // 1. What DB are we connected to?
    const dbName = mongoose.connection.db?.databaseName ?? 'unknown';
    const dbHost = mongoose.connection.host ?? 'unknown';

    // 2. What collections exist?
    const collections = await mongoose.connection.db
      ?.listCollections()
      .toArray()
      .then((cols) => cols.map((c) => c.name)) ?? [];

    // 3. What does Category model think its collection is?
    const categoryCollectionName = Category.collection.name;
    const subcategoryCollectionName = Subcategory.collection.name;

    // 4. Count documents
    const categoryCount = await Category.countDocuments();
    const subcategoryCount = await Subcategory.countDocuments();

    // 5. Fetch first 10 of each so we can see actual slug/name values
    const categories = await Category.find().limit(10).lean();
    const subcategories = await Subcategory.find().limit(10).lean();

    // 6. Raw collection query — bypass Mongoose model entirely
    const rawCategories = await mongoose.connection.db
      ?.collection(categoryCollectionName)
      .find({})
      .limit(10)
      .toArray() ?? [];

    return successResponse({
      connection: { dbName, dbHost },
      collections,
      models: {
        Category: { collectionName: categoryCollectionName, count: categoryCount },
        Subcategory: { collectionName: subcategoryCollectionName, count: subcategoryCount },
      },
      // Show the actual slug + name values from the DB
      categoryRecords: categories.map((c: any) => ({
        _id: c._id?.toString(),
        slug: c.slug,
        name: c.name,
        // Show ALL keys so we can spot unexpected field names
        keys: Object.keys(c),
      })),
      subcategoryRecords: subcategories.map((s: any) => ({
        _id: s._id?.toString(),
        slug: s.slug,
        name: s.name,
        keys: Object.keys(s),
      })),
      // Raw bypasses schema — shows what Mongoose might be filtering out
      rawCategoryRecords: rawCategories.map((c: any) => ({
        _id: c._id?.toString(),
        ...c,
      })),
    });
  } catch (err) {
    console.error('[GET /api/admin/bulk-upload-debug]', err);
    return errorResponse(err instanceof Error ? err.message : 'Debug failed', 500);
  }
});