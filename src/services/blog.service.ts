import mongoose from 'mongoose';
import Blog, { IBlog } from '@/models/Blog';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const text = content.replace(/<[^>]*>/g, '');
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// ─── List published blogs ─────────────────────────────────────────────────────

export interface ListBlogsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: 'latest' | 'popular';
}

export async function listPublishedBlogs(params: ListBlogsParams = {}) {
  const { page = 1, limit = 9, search, category, sort = 'latest' } = params;
  const skip = (page - 1) * limit;

  const query: mongoose.FilterQuery<IBlog> = { status: 'published' };

  if (category && category !== 'all') query.category = category;

  if (search) {
    query.$text = { $search: search };
  }

  const sortOrder =
    sort === 'popular'
      ? ({ views: -1, publishedAt: -1 } as Record<string, 1 | -1>)
      : ({ publishedAt: -1 } as Record<string, 1 | -1>);

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .select('title slug shortDescription featuredImage category tags publishedAt views likes comments authorName')
      .lean(),
    Blog.countDocuments(query),
  ]);

  return { blogs, total, page, limit };
}

// ─── Get published blog by slug ───────────────────────────────────────────────

export async function getBlogBySlug(slug: string) {
  return Blog.findOne({ slug, status: 'published' }).lean();
}

// ─── Get related blogs ────────────────────────────────────────────────────────

export async function getRelatedBlogs(blogId: string, category: string, tags: string[], limit = 4) {
  return Blog.find({
    _id: { $ne: new mongoose.Types.ObjectId(blogId) },
    status: 'published',
    $or: [{ category }, { tags: { $in: tags } }],
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .select('title slug shortDescription featuredImage category publishedAt views likes authorName')
    .lean();
}

// ─── Increment view count ─────────────────────────────────────────────────────

export async function incrementViews(slug: string) {
  return Blog.findOneAndUpdate({ slug, status: 'published' }, { $inc: { views: 1 } });
}

// ─── Like / unlike ────────────────────────────────────────────────────────────

export async function toggleLike(slug: string, userId: string) {
  const blog = await Blog.findOne({ slug, status: 'published' });
  if (!blog) throw new Error('Blog not found');

  const uid = new mongoose.Types.ObjectId(userId);
  const hasLiked = blog.likes.some((id) => id.equals(uid));

  if (hasLiked) {
    await Blog.updateOne({ slug }, { $pull: { likes: uid } });
    return { liked: false, likesCount: blog.likes.length - 1 };
  } else {
    await Blog.updateOne({ slug }, { $addToSet: { likes: uid } });
    return { liked: true, likesCount: blog.likes.length + 1 };
  }
}

// ─── Add comment ─────────────────────────────────────────────────────────────

export async function addComment(
  slug: string,
  userId: string,
  userName: string,
  message: string
) {
  const blog = await Blog.findOneAndUpdate(
    { slug, status: 'published' },
    {
      $push: {
        comments: { user: new mongoose.Types.ObjectId(userId), userName, message },
      },
    },
    { new: true }
  );
  if (!blog) throw new Error('Blog not found');
  return blog.comments[blog.comments.length - 1];
}

// ─── Edit comment ─────────────────────────────────────────────────────────────

export async function editComment(
  slug: string,
  commentId: string,
  userId: string,
  message: string
) {
  const result = await Blog.updateOne(
    { slug, 'comments._id': new mongoose.Types.ObjectId(commentId), 'comments.user': new mongoose.Types.ObjectId(userId) },
    { $set: { 'comments.$.message': message, 'comments.$.updatedAt': new Date() } }
  );
  if (result.matchedCount === 0) throw new Error('Comment not found or unauthorized');
}

// ─── Delete comment ───────────────────────────────────────────────────────────

export async function deleteComment(slug: string, commentId: string, userId: string, isAdmin: boolean) {
  const cid = new mongoose.Types.ObjectId(commentId);
  const blog = await Blog.findOne({ slug });
  if (!blog) throw new Error('Blog not found');

  const comment = blog.comments.find((c) => c._id.equals(cid));
  if (!comment) throw new Error('Comment not found');
  if (!isAdmin && !comment.user.equals(new mongoose.Types.ObjectId(userId))) {
    throw new Error('Unauthorized');
  }

  await Blog.updateOne({ slug }, { $pull: { comments: { _id: cid } } });
}

// ─── Add reply (admin) ────────────────────────────────────────────────────────

export async function addReply(
  slug: string,
  commentId: string,
  userId: string,
  userName: string,
  message: string,
  isAdmin: boolean
) {
  const result = await Blog.findOneAndUpdate(
    { slug, 'comments._id': new mongoose.Types.ObjectId(commentId) },
    {
      $push: {
        'comments.$.replies': {
          user: new mongoose.Types.ObjectId(userId),
          userName,
          isAdmin,
          message,
        },
      },
    },
    { new: true }
  );
  if (!result) throw new Error('Comment not found');
  return result;
}

// ─── Get blog categories ──────────────────────────────────────────────────────

export async function getBlogCategories() {
  return Blog.distinct('category', { status: 'published' });
}

// ─── Admin: list all blogs ────────────────────────────────────────────────────

export interface AdminListBlogsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'draft' | 'published' | 'all';
}

export async function adminListBlogs(params: AdminListBlogsParams = {}) {
  const { page = 1, limit = 10, search, status = 'all' } = params;
  const skip = (page - 1) * limit;

  const query: mongoose.FilterQuery<IBlog> = {};
  if (status !== 'all') query.status = status;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
  }

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title slug status category publishedAt views likes comments createdAt')
      .lean(),
    Blog.countDocuments(query),
  ]);

  return { blogs, total, page, limit };
}

// ─── Admin: get blog stats ────────────────────────────────────────────────────

export async function getBlogStats() {
  const [totalBlogs, totalViews, totalLikesAgg, totalCommentsAgg] = await Promise.all([
    Blog.countDocuments(),
    Blog.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
    Blog.aggregate([{ $project: { count: { $size: '$likes' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
    Blog.aggregate([{ $project: { count: { $size: '$comments' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
  ]);

  return {
    totalBlogs,
    totalViews: totalViews[0]?.total ?? 0,
    totalLikes: totalLikesAgg[0]?.total ?? 0,
    totalComments: totalCommentsAgg[0]?.total ?? 0,
  };
}

// ─── Admin: create blog ───────────────────────────────────────────────────────

export async function createBlog(data: {
  title: string;
  slug?: string;
  shortDescription: string;
  content: string;
  featuredImage?: string;
  category: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  status: 'draft' | 'published';
  authorId: string;
  authorName: string;
}) {
  const slug = data.slug || generateSlug(data.title);

  // ensure unique slug
  let finalSlug = slug;
  let counter = 1;
  while (await Blog.exists({ slug: finalSlug })) {
    finalSlug = `${slug}-${counter++}`;
  }

  const blog = new Blog({
    ...data,
    slug: finalSlug,
    author: new mongoose.Types.ObjectId(data.authorId),
    tags: data.tags ?? [],
    publishedAt: data.status === 'published' ? new Date() : undefined,
  });

  await blog.save();
  return blog.toObject();
}

// ─── Admin: update blog ───────────────────────────────────────────────────────

export async function updateBlog(id: string, data: Partial<IBlog> & { status?: 'draft' | 'published' }) {
  const existing = await Blog.findById(id);
  if (!existing) throw new Error('Blog not found');

  // set publishedAt only on first publish
  if (data.status === 'published' && existing.status !== 'published') {
    (data as Record<string, unknown>).publishedAt = new Date();
  }

  const updated = await Blog.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  return updated?.toObject();
}

// ─── Admin: delete blog ───────────────────────────────────────────────────────

export async function deleteBlog(id: string) {
  const blog = await Blog.findByIdAndDelete(id);
  if (!blog) throw new Error('Blog not found');
}