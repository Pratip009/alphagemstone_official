import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Order from '@/models/Order';

export const GET = async () => {
  try {
    await connectDB();

    // Get the latest 4 unique products from recent orders
    const latest = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'refunded'] } } },
      { $sort: { createdAt: -1 } },           // newest orders first
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name:      { $first: '$items.name' },
          image:     { $first: '$items.image' },
          price:     { $first: '$items.price' },
          orderedAt: { $first: '$createdAt' },  // when it was last ordered
        },
      },
      { $sort: { orderedAt: -1 } },            // most recently ordered first
      { $limit: 10 },
    ]);

    return NextResponse.json({ success: true, data: latest });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch latest ordered products' },
      { status: 500 }
    );
  }
};