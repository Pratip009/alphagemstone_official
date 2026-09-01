import Cart from '@/models/Cart';
import Product, { IProduct } from '@/models/Product';

export async function getCart(userId: string) {
  // Fetch the raw (unpopulated) cart first so we still have the stored
  // product ids around even for items whose product no longer exists.
  const rawCart = await Cart.findOne({ user: userId }).lean();
  if (!rawCart) return rawCart;

  const rawDoc = rawCart as unknown as { items: Array<{ product: { toString(): string } }> };
  const orphanedIds = rawDoc.items
    .filter((item) => !!item.product)
    .map((item) => item.product.toString());

  const cart = await Cart.findOne({ user: userId })
    .populate('items.product', 'name images price stock isActive')
    .lean();

  if (!cart) return cart;

  const cartDoc = cart as unknown as { items: Array<{ product: unknown }> };
  const staleProductIds: string[] = [];
  cartDoc.items.forEach((item, idx) => {
    if (!item.product) staleProductIds.push(orphanedIds[idx]);
  });

  // Self-heal: a populated item.product of null means the referenced
  // product was deleted (or its id no longer resolves). Strip those out
  // of the response so the client never sees a null product, and pull
  // them out of the stored cart in the background (by their real stored
  // id) so this doesn't recur on every fetch.
  if (staleProductIds.length > 0) {
    cartDoc.items = cartDoc.items.filter((item) => !!item.product);
    Cart.updateOne(
      { user: userId },
      { $pull: { items: { product: { $in: staleProductIds } } } }
    ).catch(() => {});
  }

  return cart;
}

export async function addToCart(userId: string, productId: string, quantity = 1) {
  const product = await Product.findOne({ _id: productId, isActive: true }).lean() as IProduct | null;
  if (!product) throw new Error('Product not found or out of stock');

  // Purchasability must be judged on availableStock (stock minus units
  // currently out on memo with a trade customer), not raw stock — otherwise
  // a memo'd one-of-a-kind piece could be sold online while it's out on
  // consignment.
  const availableStock = Math.max(0, product.stock - (product.reservedForMemo || 0));
  if (availableStock <= 0) throw new Error('Product not found or out of stock');

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existingIdx = (cart.items as Array<{ product: { toString(): string }; quantity: number; price: number }>).findIndex(
    (item) => item.product.toString() === productId
  );

  if (existingIdx > -1) {
    const newQty = cart.items[existingIdx].quantity + quantity;
    if (newQty > availableStock) throw new Error('Insufficient stock');
    cart.items[existingIdx].quantity = newQty;
  } else {
    if (quantity > availableStock) throw new Error('Insufficient stock');
    cart.items.push({ product: product._id, quantity, price: product.price });
  }

  await cart.save();
  return getCart(userId);
}

export async function updateCartItem(userId: string, productId: string, quantity: number) {
  if (quantity < 1) return removeFromCart(userId, productId);

  const product = await Product.findById(productId).lean() as IProduct | null;
  if (!product) throw new Error('Product not found');
  const availableStock = Math.max(0, product.stock - (product.reservedForMemo || 0));
  if (quantity > availableStock) throw new Error('Insufficient stock');

  await Cart.updateOne(
    { user: userId, 'items.product': productId },
    { $set: { 'items.$.quantity': quantity } }
  );

  // Route through getCart so any other orphaned items (deleted products)
  // are stripped from the response instead of crashing the client.
  return getCart(userId);
}

export async function removeFromCart(userId: string, productId: string) {
  await Cart.updateOne(
    { user: userId },
    { $pull: { items: { product: productId } } }
  );
  return getCart(userId);
}

export async function clearCart(userId: string) {
  return Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } }, { new: true });
}

export function calculateCartTotals(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const tax = 0;
  const shippingCost = 0;
  const total = parseFloat((subtotal + tax + shippingCost).toFixed(2));
  return { subtotal, tax, shippingCost, total };
}
