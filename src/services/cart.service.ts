import Cart from '@/models/Cart';
import Product, { IProduct } from '@/models/Product';

export async function getCart(userId: string) {
  const cart = await Cart.findOne({ user: userId })
    .populate('items.product', 'name images price stock isActive')
    .lean();
  return cart;
}

export async function addToCart(userId: string, productId: string, quantity = 1) {
  const product = await Product.findOne({ _id: productId, isActive: true, stock: { $gt: 0 } }).lean() as IProduct | null;
  if (!product) throw new Error('Product not found or out of stock');

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existingIdx = (cart.items as Array<{ product: { toString(): string }; quantity: number; price: number }>).findIndex(
    (item) => item.product.toString() === productId
  );

  if (existingIdx > -1) {
    const newQty = cart.items[existingIdx].quantity + quantity;
    if (newQty > product.stock) throw new Error('Insufficient stock');
    cart.items[existingIdx].quantity = newQty;
  } else {
    if (quantity > product.stock) throw new Error('Insufficient stock');
    cart.items.push({ product: product._id, quantity, price: product.price });
  }

  await cart.save();
  return getCart(userId);
}

export async function updateCartItem(userId: string, productId: string, quantity: number) {
  if (quantity < 1) return removeFromCart(userId, productId);

  const product = await Product.findById(productId).lean() as IProduct | null;
  if (!product) throw new Error('Product not found');
  if (quantity > product.stock) throw new Error('Insufficient stock');

  const cart = await Cart.findOneAndUpdate(
    { user: userId, 'items.product': productId },
    { $set: { 'items.$.quantity': quantity } },
    { new: true }
  ).populate('items.product', 'name images price stock isActive');

  return cart;
}

export async function removeFromCart(userId: string, productId: string) {
  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $pull: { items: { product: productId } } },
    { new: true }
  ).populate('items.product', 'name images price stock isActive');
  return cart;
}

export async function clearCart(userId: string) {
  return Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } }, { new: true });
}

export function calculateCartTotals(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = parseFloat((subtotal * 0.08).toFixed(2));
  const shippingCost = subtotal > 500 ? 0 : 25;
  const total = parseFloat((subtotal + tax + shippingCost).toFixed(2));
  return { subtotal, tax, shippingCost, total };
}
