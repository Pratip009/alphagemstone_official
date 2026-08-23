import mongoose from 'mongoose';
import Review from '@/models/Review';
import Product from '@/models/Product';
import Order from '@/models/Order';
import User from '@/models/User';

const REVIEWS_PER_PAGE = 10;

export type ReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';

function sortStage(sort: ReviewSort): Record<string, 1 | -1> {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1 };
    case 'highest':
      return { rating: -1, createdAt: -1 };
    case 'lowest':
      return { rating: 1, createdAt: -1 };
    case 'helpful':
      return { likeCount: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

// Shapes a lean review doc for the client: adds `likeCount` and, when
// viewerId is supplied, `likedByMe` — without ever leaking the full list of
// liker ids to the browser.
function serializeReview(review: any, viewerId?: string) {
  const likes: mongoose.Types.ObjectId[] = review.likes || [];
  return {
    _id: String(review._id),
    product: String(review.product),
    user: review.user?._id ? String(review.user._id) : String(review.user),
    userName: review.user?.name || review.userName,
    userAvatar: review.user?.avatarUrl,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    verifiedPurchase: review.verifiedPurchase,
    likeCount: likes.length,
    likedByMe: viewerId ? likes.some((id) => id.toString() === viewerId) : false,
    adminReply: review.adminReply
      ? {
          text: review.adminReply.text,
          repliedAt: review.adminReply.repliedAt,
        }
      : undefined,
    isHidden: review.isHidden,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export async function getRatingStats(productId: string) {
  const stats = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), isHidden: false } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
  ]);

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const row of stats) {
    const star = row._id as 1 | 2 | 3 | 4 | 5;
    breakdown[star] = row.count;
    total += row.count;
    sum += star * row.count;
  }

  return {
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    breakdown,
  };
}

export async function listProductReviews(
  productId: string,
  { page = 1, sort = 'newest' as ReviewSort, viewerId }: { page?: number; sort?: ReviewSort; viewerId?: string } = {}
) {
  const filter = { product: productId, isHidden: false };

  const [reviews, total, stats] = await Promise.all([
    Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId), isHidden: false } },
      { $addFields: { likeCount: { $size: { $ifNull: ['$likes', []] } } } },
      { $sort: sortStage(sort) },
      { $skip: (page - 1) * REVIEWS_PER_PAGE },
      { $limit: REVIEWS_PER_PAGE },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { name: 1, avatarUrl: 1 } }],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]),
    Review.countDocuments(filter),
    getRatingStats(productId),
  ]);

  return {
    reviews: reviews.map((r) => serializeReview(r, viewerId)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE)),
    stats,
  };
}

export async function getMyReviewForProduct(productId: string, userId: string) {
  const review = await Review.findOne({ product: productId, user: userId }).lean();
  return review ? serializeReview({ ...review, user: userId }, userId) : null;
}

async function checkVerifiedPurchase(userId: string, productId: string): Promise<boolean> {
  const order = await Order.exists({
    user: userId,
    'items.product': productId,
    status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
  });
  return !!order;
}

export async function createOrUpdateReview(
  productId: string,
  userId: string,
  data: { rating: number; title?: string; comment: string }
) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new Error('Invalid product');
  const product = await Product.findById(productId).select('_id isActive').lean();
  if (!product) throw new Error('Product not found');

  const rating = Math.round(Number(data.rating));
  if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5 stars');

  const comment = (data.comment || '').trim();
  if (comment.length < 3) throw new Error('Please write a few words about your experience');

  const existing = await Review.findOne({ product: productId, user: userId });

  if (existing) {
    existing.rating = rating;
    existing.title = data.title?.trim() || undefined;
    existing.comment = comment;
    await existing.save();
    return serializeReview(existing.toObject(), userId);
  }

  const [verifiedPurchase, buyer] = await Promise.all([
    checkVerifiedPurchase(userId, productId),
    User.findById(userId).select('name').lean(),
  ]);

  const created = await Review.create({
    product: productId,
    user: userId,
    userName: (buyer as { name?: string } | null)?.name || 'Customer',
    rating,
    title: data.title?.trim() || undefined,
    comment,
    verifiedPurchase,
  });

  return serializeReview(created.toObject(), userId);
}

export async function deleteReview(reviewId: string, userId: string, isAdmin: boolean) {
  const review = await Review.findById(reviewId);
  if (!review) throw new Error('Review not found');
  if (!isAdmin && review.user.toString() !== userId) {
    throw new Error('You can only delete your own review');
  }
  await review.deleteOne();
  return { productId: review.product.toString() };
}

export async function toggleReviewLike(reviewId: string, userId: string) {
  const review = await Review.findById(reviewId);
  if (!review) throw new Error('Review not found');

  const uid = new mongoose.Types.ObjectId(userId);
  const alreadyLiked = review.likes.some((id) => id.toString() === userId);

  if (alreadyLiked) {
    review.likes = review.likes.filter((id) => id.toString() !== userId);
  } else {
    review.likes.push(uid);
  }
  await review.save();

  return { liked: !alreadyLiked, likeCount: review.likes.length };
}

export async function replyToReview(reviewId: string, adminId: string, text: string) {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Reply cannot be empty');

  const review = await Review.findByIdAndUpdate(
    reviewId,
    {
      adminReply: {
        text: trimmed,
        repliedBy: adminId,
        repliedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  if (!review) throw new Error('Review not found');
  return serializeReview(review);
}

export async function removeReviewReply(reviewId: string) {
  const review = await Review.findByIdAndUpdate(
    reviewId,
    { $unset: { adminReply: '' } },
    { new: true }
  ).lean();
  if (!review) throw new Error('Review not found');
  return serializeReview(review);
}

export async function setReviewVisibility(reviewId: string, isHidden: boolean) {
  const review = await Review.findByIdAndUpdate(reviewId, { isHidden }, { new: true }).lean();
  if (!review) throw new Error('Review not found');
  return serializeReview(review);
}

// ─── Admin listing across all products ─────────────────────────────────────
export async function listReviewsAdmin({
  page = 1,
  productId,
  hasReply,
}: { page?: number; productId?: string; hasReply?: 'yes' | 'no' } = {}) {
  const filter: Record<string, unknown> = {};
  if (productId) filter.product = productId;
  if (hasReply === 'yes') filter.adminReply = { $exists: true };
  if (hasReply === 'no') filter.adminReply = { $exists: false };

  const LIMIT = 20;
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .skip((page - 1) * LIMIT)
      .limit(LIMIT)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return {
    reviews: reviews.map((r: any) => ({
      _id: String(r._id),
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isHidden: r.isHidden,
      verifiedPurchase: r.verifiedPurchase,
      likeCount: (r.likes || []).length,
      createdAt: r.createdAt,
      user: r.user ? { _id: String(r.user._id), name: r.user.name, email: r.user.email } : { name: r.userName },
      product: r.product ? { _id: String(r.product._id), name: r.product.name, image: r.product.images?.[0] } : null,
      adminReply: r.adminReply
        ? { text: r.adminReply.text, repliedAt: r.adminReply.repliedAt }
        : undefined,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / LIMIT)),
  };
}
