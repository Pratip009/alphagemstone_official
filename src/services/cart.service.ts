import Cart from '@/models/Cart';
import Product, { IProduct } from '@/models/Product';
import { CartIdentity } from '@/middleware/auth.middleware';

// Every function below takes a CartIdentity ({ userId } or { guestId })
// instead of a bare userId, so the same cart logic serves logged-in
// shoppers and anonymous guests alike.
function identityQuery(identity: CartIdentity) {
  return identity.userId ? { user: identity.userId } : { guestId: identity.guestId };
}

export async function getCart(identity: CartIdentity) {
  const cart = await Cart.findOne(identityQuery(identity))
    .populate('items.product', 'name images price stock isActive')
    .lean();
  return cart;
}

export async function addToCart(identity: CartIdentity, productId: string, quantity = 1) {
  const product = await Product.findOne({ _id: productId, isActive: true, stock: { $gt: 0 } }).lean() as IProduct | null;
  if (!product) throw new Error('Product not found or out of stock');

  let cart = await Cart.findOne(identityQuery(identity));
  if (!cart) {
    cart = new Cart({
      user: identity.userId ?? undefined,
      guestId: identity.guestId ?? undefined,
      items: [],
    });
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
  return getCart(identity);
}

export async function updateCartItem(identity: CartIdentity, productId: string, quantity: number) {
  if (quantity < 1) return removeFromCart(identity, productId);

  const product = await Product.findById(productId).lean() as IProduct | null;
  if (!product) throw new Error('Product not found');
  if (quantity > product.stock) throw new Error('Insufficient stock');

  const cart = await Cart.findOneAndUpdate(
    { ...identityQuery(identity), 'items.product': productId },
    { $set: { 'items.$.quantity': quantity } },
    { new: true }
  ).populate('items.product', 'name images price stock isActive');

  return cart;
}

export async function removeFromCart(identity: CartIdentity, productId: string) {
  const cart = await Cart.findOneAndUpdate(
    identityQuery(identity),
    { $pull: { items: { product: productId } } },
    { new: true }
  ).populate('items.product', 'name images price stock isActive');
  return cart;
}

export async function clearCart(identity: CartIdentity) {
  return Cart.findOneAndUpdate(identityQuery(identity), { $set: { items: [] } }, { new: true });
}

export function calculateCartTotals(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = 0;
  const shippingCost = 0;
  const total = parseFloat((subtotal + tax + shippingCost).toFixed(2));
  return { subtotal, tax, shippingCost, total };
}

// ─── Guest → user merge ─────────────────────────────────────────────────────
// Called right after login/signup/verify-signup, before the guest_id cookie
// is cleared, so items added while browsing as a guest aren't lost the
// moment someone creates an account or logs in mid-session. Guest items win
// on quantity conflicts by *summing* (same behavior as addToCart), capped to
// available stock so a merge can never oversell.
export async function mergeGuestCartIntoUser(guestId: string, userId: string): Promise<void> {
  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart || guestCart.items.length === 0) {
    // Nothing to merge — but still delete an empty guest cart doc if present.
    if (guestCart) await guestCart.deleteOne();
    return;
  }

  let userCart = await Cart.findOne({ user: userId });
  if (!userCart) {
    // No existing user cart — just re-home the guest cart onto the user.
    guestCart.user = userId as any;
    guestCart.guestId = undefined;
    await guestCart.save();
    return;
  }

  for (const guestItem of guestCart.items as Array<{ product: { toString(): string }; quantity: number; price: number }>) {
    const product = await Product.findById(guestItem.product).lean() as IProduct | null;
    if (!product || !product.isActive || product.stock <= 0) continue; // dropped silently — no longer purchasable

    const existingIdx = (userCart.items as Array<{ product: { toString(): string }; quantity: number; price: number }>).findIndex(
      (item) => item.product.toString() === guestItem.product.toString()
    );
    if (existingIdx > -1) {
      userCart.items[existingIdx].quantity = Math.min(
        userCart.items[existingIdx].quantity + guestItem.quantity,
        product.stock
      );
    } else {
      userCart.items.push({
        product: guestItem.product as any,
        quantity: Math.min(guestItem.quantity, product.stock),
        price: product.price, // re-priced from the current product, not the stale guest-cart price
      });
    }
  }

  await userCart.save();
  await guestCart.deleteOne();
}
