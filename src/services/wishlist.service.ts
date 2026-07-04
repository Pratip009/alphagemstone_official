import Wishlist from '@/models/Wishlist';
import Product from '@/models/Product';

export async function getWishlist(userId: string) {
  const wishlist = await Wishlist.findOne({ user: userId })
    .populate('items.product', 'name images price stock isActive productKind gemstoneName shape size color clarity certification watchBrand watchModel watchMovement watchGender')
    .lean();
  return wishlist;
}

export async function getWishlistProductIds(userId: string): Promise<string[]> {
  const wishlist = await Wishlist.findOne({ user: userId }).select('items.product').lean();
  if (!wishlist) return [];
  return (wishlist.items || []).map((item) => item.product.toString());
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await Product.findById(productId).select('_id isActive').lean();
  if (!product) throw new Error('Product not found');

  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = new Wishlist({ user: userId, items: [] });
  }

  const alreadySaved = wishlist.items.some((item) => item.product.toString() === productId);
  if (!alreadySaved) {
    wishlist.items.push({ product: product._id, addedAt: new Date() });
    await wishlist.save();
  }

  return getWishlist(userId);
}

export async function removeFromWishlist(userId: string, productId: string) {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { items: { product: productId } } },
    { new: true }
  ).populate('items.product', 'name images price stock isActive productKind gemstoneName shape size color clarity certification watchBrand watchModel watchMovement watchGender');
  return wishlist;
}

export async function toggleWishlist(userId: string, productId: string) {
  const wishlist = await Wishlist.findOne({ user: userId });
  const alreadySaved = !!wishlist?.items.some((item) => item.product.toString() === productId);

  if (alreadySaved) {
    const updated = await removeFromWishlist(userId, productId);
    return { wishlist: updated, inWishlist: false };
  }

  const updated = await addToWishlist(userId, productId);
  return { wishlist: updated, inWishlist: true };
}

export async function clearWishlist(userId: string) {
  return Wishlist.findOneAndUpdate({ user: userId }, { $set: { items: [] } }, { new: true });
}

export async function isInWishlist(userId: string, productId: string): Promise<boolean> {
  const wishlist = await Wishlist.findOne({ user: userId, 'items.product': productId }).select('_id').lean();
  return !!wishlist;
}

export async function moveToCart(userId: string, productId: string, quantity = 1) {
  const { addToCart } = await import('@/services/cart.service');
  const cart = await addToCart(userId, productId, quantity);
  await removeFromWishlist(userId, productId);
  return cart;
}