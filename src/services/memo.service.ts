import { Types } from 'mongoose';
import { connectDB } from '@/lib/db';
import Memo, { type IMemo, type MemoStatus, type MemoActorRole } from '@/models/Memo';
import Product from '@/models/Product';
import User from '@/models/User';
import {
  MEMO_MAX_DAYS,
  MEMO_MIN_DAYS_DEFAULT,
  MAX_EXTENSIONS,
  OUTSTANDING_MEMO_STATUSES,
  BLOCKING_MEMO_STATUSES,
  TERMINAL_MEMO_STATUSES,
  RESERVATION_RELEASING_STATUSES,
  TERMS_VERSION,
  OVERDUE_ESCALATION_INTERVAL_HOURS,
  OVERDUE_ADMIN_ALERT_LEVEL,
  DUE_SOON_WINDOW_DAYS,
} from '@/lib/memo.constants';

// ---- import these once they exist in your repo (see docs/INTEGRATION.md) ----
// import { getShipEngineRates, purchaseLabelFromRate, trackShipEnginePackage } from '@/services/shipengine.service';
// import { createOrderFromCart } from '@/services/order.service';
// import {
//   sendMemoRequestReceivedEmail, sendMemoRequestAdminNotifyEmail, sendMemoApprovedEmail,
//   sendMemoRejectedEmail, sendMemoShippedEmail, sendMemoDueSoonEmail, sendMemoOverdueEmail,
//   sendMemoOverdueAdminAlertEmail, sendMemoReturnLabelEmail, sendMemoReturnedConfirmationEmail,
//   sendMemoPurchasedConfirmationEmail, sendMemoRecalledEmail, sendMemoForceConvertedEmail,
//   sendMemoApplicationReceivedEmail, sendMemoApplicationApprovedEmail,
// } from '@/lib/email-templates';
// -------------------------------------------------------------------------

export class MemoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type ActorId = Types.ObjectId | 'system' | 'cron';

interface ShippingAddressInput {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface CreateMemoInput {
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  durationDays: number;
  shippingAddress: ShippingAddressInput;
  termsAccepted: boolean;
  ip: string;
  userAgent: string;
}

// ---------------------------------------------------------------------------
// Small internal helpers
// ---------------------------------------------------------------------------

function pushEvent(
  memo: IMemo,
  status: MemoStatus,
  actedBy: ActorId,
  actedByRole: MemoActorRole,
  note?: string
) {
  memo.events.push({ status, note, actedBy: actedBy as any, actedByRole, at: new Date() });
}

function assertNotTerminal(memo: IMemo) {
  if ((TERMINAL_MEMO_STATUSES as readonly string[]).includes(memo.status)) {
    throw new MemoError(`Memo is in a terminal state (${memo.status}) and cannot be modified`, 409);
  }
}

function assertOwner(memo: IMemo, userId: string) {
  // Same pattern as order.service.ts capturePayment() — explicit owner check
  // before any read/mutation, never rely on the query filter alone.
  if (memo.user.toString() !== userId) {
    throw new MemoError('Memo not found', 404); // 404, not 403 — don't leak existence
  }
}

/**
 * The ONLY function permitted to touch Product.reservedForMemo downward.
 * Called exclusively from the transitions listed in RESERVATION_RELEASING_STATUSES.
 * Idempotent: safe to call twice (second call is a no-op) via reservationReleasedAt guard.
 */
async function releaseReservation(memo: IMemo, targetStatus: MemoStatus) {
  if (!(RESERVATION_RELEASING_STATUSES as readonly string[]).includes(targetStatus)) {
    throw new MemoError(
      `Internal error: releaseReservation called for non-releasing status "${targetStatus}"`,
      500
    );
  }
  if (memo.reservationReleasedAt) return; // already released, never double-release

  for (const item of memo.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { reservedForMemo: -item.quantity } }
    );
  }
  memo.reservationReleasedAt = new Date();
}

async function sumOutstandingMemoValue(userId: string, excludeMemoId?: string): Promise<number> {
  const filter: any = {
    user: new Types.ObjectId(userId),
    status: { $in: OUTSTANDING_MEMO_STATUSES },
  };
  if (excludeMemoId) filter._id = { $ne: new Types.ObjectId(excludeMemoId) };
  const agg = await Memo.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$totalValue' } } },
  ]);
  return agg[0]?.total ?? 0;
}

function computeDueAt(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Customer-facing
// ---------------------------------------------------------------------------

export async function applyForMemoEligibility(
  userId: string,
  payload: { businessName: string; resaleCertNumber?: string; references?: string }
) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw new MemoError('User not found', 404);
  if (user.memoStatus === 'approved') {
    throw new MemoError('You already have memo privileges', 409);
  }
  user.memoStatus = 'pending';
  user.memoBusinessName = payload.businessName;
  user.memoResaleCertNumber = payload.resaleCertNumber;
  user.memoReferences = payload.references;
  await user.save();

  // void sendMemoApplicationReceivedEmail(user);
  // void sendMemoAdminNotifyNewApplicationEmail(user); // fire-and-forget, per repo convention

  return user;
}

export async function createMemoRequest(input: CreateMemoInput): Promise<IMemo> {
  await connectDB();

  if (!input.termsAccepted) {
    throw new MemoError('You must accept the memo agreement to proceed', 400);
  }

  const user = await User.findById(input.userId);
  if (!user) throw new MemoError('User not found', 404);
  if (user.memoStatus !== 'approved') {
    throw new MemoError('Your account is not approved for memo purchases', 403);
  }

  // §5.3 — block new requests while any memo is unresolved (overdue)
  const blockingCount = await Memo.countDocuments({
    user: user._id,
    status: { $in: BLOCKING_MEMO_STATUSES },
  });
  if (blockingCount > 0) {
    throw new MemoError(
      'You have an overdue memo that must be resolved before requesting a new one',
      409
    );
  }

  if (!input.items?.length) throw new MemoError('At least one item is required', 400);

  // Duration validated per-product below, but cap globally at 14 days
  // regardless of what any individual product allows.
  if (input.durationDays > MEMO_MAX_DAYS) {
    throw new MemoError(`Memo duration cannot exceed ${MEMO_MAX_DAYS} days`, 400);
  }
  if (input.durationDays < 1) {
    throw new MemoError('Memo duration must be at least 1 day', 400);
  }

  // ---- Atomic reservation, one product at a time, with rollback on any failure ----
  const reserved: Array<{ productId: Types.ObjectId; quantity: number }> = [];
  const memoItems: IMemo['items'] = [];
  let totalValue = 0;

  try {
    for (const line of input.items) {
      const product = await Product.findOne({ _id: line.productId });
      if (!product) throw new MemoError(`Product ${line.productId} not found`, 404);

      const minDays = product.memoMinDays ?? MEMO_MIN_DAYS_DEFAULT;
      const maxDays = Math.min(product.memoMaxDays ?? MEMO_MAX_DAYS, MEMO_MAX_DAYS);
      if (input.durationDays < minDays || input.durationDays > maxDays) {
        throw new MemoError(
          `"${product.name}" allows memo durations of ${minDays}-${maxDays} days`,
          400
        );
      }

      // Single conditional update — never read-then-write for stock (§5.1).
      const updated = await Product.findOneAndUpdate(
        {
          _id: line.productId,
          memoEligible: true,
          isActive: true,
          $expr: {
            $gte: [{ $subtract: ['$stock', '$reservedForMemo'] }, line.quantity],
          },
        },
        { $inc: { reservedForMemo: line.quantity } },
        { new: true }
      );
      if (!updated) {
        throw new MemoError(`"${product.name}" is no longer available for memo`, 409);
      }
      reserved.push({ productId: updated._id, quantity: line.quantity });

      const lineValue = updated.price * line.quantity;
      totalValue += lineValue;
      memoItems.push({
        product: updated._id,
        name: updated.name,
        price: updated.price,
        quantity: line.quantity,
        image: updated.images?.[0],
        itemStatus: 'pending',
      });
    }

    // §5.2 — credit limit check, after we know the real totalValue
    const outstanding = await sumOutstandingMemoValue(input.userId);
    if (outstanding + totalValue > user.memoCreditLimit) {
      throw new MemoError(
        `This request ($${totalValue.toFixed(2)}) plus your current outstanding memo value ` +
          `($${outstanding.toFixed(2)}) would exceed your credit limit ($${user.memoCreditLimit.toFixed(2)})`,
        409
      );
    }

    const memo = await Memo.create({
      user: user._id,
      items: memoItems,
      status: 'pending',
      totalValue,
      requestedDurationDays: input.durationDays,
      dueAt: computeDueAt(new Date(), input.durationDays), // recomputed properly at approval time
      shippingAddress: input.shippingAddress,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      termsAcceptedIp: input.ip,
      termsAcceptedUserAgent: input.userAgent,
      extensionCount: 0,
      overdueEscalationLevel: 0,
      events: [
        {
          status: 'pending',
          actedBy: user._id,
          actedByRole: 'customer',
          at: new Date(),
          note: 'Memo requested',
        },
      ],
    });

    // void sendMemoRequestReceivedEmail(user, memo);
    // void sendMemoRequestAdminNotifyEmail(memo);

    return memo;
  } catch (err) {
    // Roll back every reservation increment made so far in this request.
    for (const r of reserved) {
      await Product.updateOne({ _id: r.productId }, { $inc: { reservedForMemo: -r.quantity } });
    }
    throw err;
  }
}

export async function getMemoForUser(memoId: string, userId: string): Promise<IMemo> {
  await connectDB();
  const memo = await Memo.findById(memoId).populate('items.product', 'name images');
  if (!memo) throw new MemoError('Memo not found', 404);
  assertOwner(memo, userId);
  return memo;
}

export async function listMemosForUser(userId: string) {
  await connectDB();
  return Memo.find({ user: userId }).sort({ createdAt: -1 });
}

export async function requestExtension(memoId: string, userId: string, extraDays: number) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertOwner(memo, userId);
  assertNotTerminal(memo);

  if (memo.status !== 'with_customer') {
    throw new MemoError('Extensions can only be requested while the item is with you', 409);
  }
  if (memo.extensionCount >= MAX_EXTENSIONS) {
    throw new MemoError('Extension limit already reached for this memo', 409);
  }
  if (extraDays < 1) throw new MemoError('Extension must be at least 1 day', 400);

  // Enforce the 14-day-from-approval ceiling even at the *request* stage, so
  // the customer gets an honest error instead of an admin rejecting it later.
  const approvedAt = memo.approvedAt ?? memo.createdAt;
  const proposedDueAt = computeDueAt(memo.dueAt, extraDays);
  if (daysBetween(approvedAt, proposedDueAt) > MEMO_MAX_DAYS) {
    const maxExtra = MEMO_MAX_DAYS - daysBetween(approvedAt, memo.dueAt);
    throw new MemoError(
      maxExtra > 0
        ? `Only ${maxExtra} additional day(s) available — total memo period cannot exceed ${MEMO_MAX_DAYS} days`
        : `Total memo period already at the ${MEMO_MAX_DAYS}-day maximum — no further extension possible`,
      409
    );
  }

  pushEvent(memo, memo.status, new Types.ObjectId(userId), 'customer', `Extension requested: +${extraDays} day(s)`);
  // NOTE: this does NOT auto-approve. It only records intent via the event
  // log; the admin PUT route with action:'extend' is what actually moves
  // dueAt. Storing the requested amount on the memo lets the admin UI show
  // it without a separate collection:
  (memo as any)._pendingExtensionDays = extraDays; // convenience only, not persisted as a schema field
  await memo.save();
  return memo;
}

export async function cancelMemo(memoId: string, userId: string, actedByRole: MemoActorRole = 'customer') {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  if (actedByRole === 'customer') assertOwner(memo, userId);
  assertNotTerminal(memo);

  if (!['pending', 'approved'].includes(memo.status)) {
    throw new MemoError('Memo can only be cancelled before it ships', 409);
  }

  memo.status = 'cancelled';
  await releaseReservation(memo, 'cancelled');
  pushEvent(memo, 'cancelled', new Types.ObjectId(userId), actedByRole, 'Cancelled pre-shipment');
  await memo.save();
  return memo;
}

export async function requestReturn(memoId: string, userId: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertOwner(memo, userId);
  assertNotTerminal(memo);

  if (!['with_customer', 'overdue'].includes(memo.status)) {
    throw new MemoError('Return can only be requested while the item is with you', 409);
  }

  // TODO: wire to real shipengine.service once available:
  // const rates = await getShipEngineRates({ from: memo.shippingAddress, to: WAREHOUSE_ADDRESS, ... });
  // const label = await purchaseLabelFromRate(rates[0].rateId, { insuredValue: memo.totalValue });
  // memo.returnCarrier = label.carrier; memo.returnTrackingNumber = label.trackingNumber; ...

  memo.status = 'return_requested';
  memo.items.forEach((i) => (i.itemStatus = 'return_requested'));
  pushEvent(memo, 'return_requested', new Types.ObjectId(userId), 'customer', 'Return requested; label issued');
  await memo.save();

  // void sendMemoReturnLabelEmail(memo);
  return memo;
}

export async function purchaseMemo(memoId: string, userId: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertOwner(memo, userId);
  assertNotTerminal(memo);

  if (!['with_customer', 'overdue'].includes(memo.status)) {
    throw new MemoError('This memo cannot be purchased in its current state', 409);
  }

  // Build items[] in the same shape createOrderFromCart expects, and delegate
  // — do NOT fork a second checkout implementation (§5.6). Add a
  // `source: 'memo'` param to createOrderFromCart so it skips the cart read
  // and the (already-reserved) stock re-check:
  //
  // const order = await createOrderFromCart({
  //   userId,
  //   source: 'memo',
  //   items: memo.items.map(i => ({ productId: i.product, name: i.name, price: i.price, quantity: i.quantity })),
  //   shippingAddress: memo.shippingAddress,
  // });

  const order = { _id: new Types.ObjectId() }; // placeholder until wired to real order.service.ts

  memo.status = 'purchased';
  memo.items.forEach((i) => (i.itemStatus = 'purchased'));
  memo.convertedOrderId = order._id as any;
  await releaseReservation(memo, 'purchased'); // releases the hold; permanent stock decrement happens in order.service
  for (const item of memo.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } });
  }
  pushEvent(memo, 'purchased', new Types.ObjectId(userId), 'customer', `Converted to Order ${order._id}`);
  await memo.save();

  // void sendMemoPurchasedConfirmationEmail(memo, order);
  return memo;
}

// ---------------------------------------------------------------------------
// Admin-facing
// ---------------------------------------------------------------------------

export async function adminListMemos(query: {
  status?: string;
  overdueOnly?: boolean;
  userId?: string;
  productId?: string;
  page?: number;
  limit?: number;
}) {
  await connectDB();
  const filter: any = {};
  if (query.status) filter.status = query.status;
  if (query.overdueOnly) filter.status = 'overdue';
  if (query.userId) filter.user = query.userId;
  if (query.productId) filter['items.product'] = query.productId;

  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);

  const [items, total] = await Promise.all([
    Memo.find(filter)
      .populate('user', 'name email memoCreditLimit')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Memo.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function adminGetMemo(memoId: string) {
  await connectDB();
  const memo = await Memo.findById(memoId)
    .populate('user', 'name email memoCreditLimit memoStatus')
    .populate('items.product', 'name images');
  if (!memo) throw new MemoError('Memo not found', 404);
  return memo;
}

export async function adminApprove(memoId: string, adminId: string, note?: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);
  if (memo.status !== 'pending') throw new MemoError('Only pending memos can be approved', 409);

  const approvedAt = new Date();
  const durationDays = Math.min(memo.requestedDurationDays, MEMO_MAX_DAYS);

  memo.status = 'approved';
  memo.items.forEach((i) => (i.itemStatus = 'approved'));
  memo.approvedAt = approvedAt;
  memo.approvedBy = new Types.ObjectId(adminId);
  memo.dueAt = computeDueAt(approvedAt, durationDays);
  pushEvent(memo, 'approved', new Types.ObjectId(adminId), 'admin', note);
  await memo.save();

  // void sendMemoApprovedEmail(memo);
  return memo;
}

export async function adminReject(memoId: string, adminId: string, reason: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);
  if (memo.status !== 'pending') throw new MemoError('Only pending memos can be rejected', 409);

  memo.status = 'rejected';
  memo.items.forEach((i) => (i.itemStatus = 'rejected'));
  memo.rejectedReason = reason;
  await releaseReservation(memo, 'rejected');
  pushEvent(memo, 'rejected', new Types.ObjectId(adminId), 'admin', reason);
  await memo.save();

  // void sendMemoRejectedEmail(memo);
  return memo;
}

export async function adminApproveExtension(memoId: string, adminId: string, extraDays: number, note?: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);

  if (memo.status !== 'with_customer') {
    throw new MemoError('Extensions can only be approved while status is with_customer', 409);
  }
  if (memo.extensionCount >= MAX_EXTENSIONS) {
    throw new MemoError('Extension limit already reached for this memo', 409);
  }
  if (extraDays < 1) throw new MemoError('Extension must be at least 1 day', 400);

  const approvedAt = memo.approvedAt ?? memo.createdAt;
  const newDueAt = computeDueAt(memo.dueAt, extraDays);
  const totalWindowDays = daysBetween(approvedAt, newDueAt);

  // This is the hard ceiling, enforced server-side regardless of what the UI
  // shows or what was requested — see §5.5 in the plan.
  if (totalWindowDays > MEMO_MAX_DAYS) {
    throw new MemoError(
      `Approving this would make the total memo period ${totalWindowDays} days, exceeding the ${MEMO_MAX_DAYS}-day maximum`,
      409
    );
  }

  memo.dueAt = newDueAt;
  memo.extensionCount += 1;
  pushEvent(memo, memo.status, new Types.ObjectId(adminId), 'admin', note ?? `Extended +${extraDays} day(s)`);
  await memo.save();
  return memo;
}

export async function adminAddNote(memoId: string, adminId: string, note: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  pushEvent(memo, memo.status, new Types.ObjectId(adminId), 'admin', note);
  await memo.save();
  return memo;
}

export async function adminPurchaseOutboundLabel(memoId: string, adminId: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);
  if (memo.status !== 'approved') {
    throw new MemoError('Outbound label can only be purchased for an approved memo', 409);
  }

  // TODO wire to real shipengine.service:
  // const rates = await getShipEngineRates({ from: WAREHOUSE_ADDRESS, to: memo.shippingAddress, insuredValue: memo.totalValue });
  // const label = await purchaseLabelFromRate(rates[0].rateId);
  // memo.outboundCarrier = label.carrier; memo.outboundTrackingNumber = label.trackingNumber;
  // memo.outboundTrackingUrl = label.trackingUrl; memo.outboundLabelUrl = label.labelUrl;

  memo.status = 'shipped';
  memo.items.forEach((i) => (i.itemStatus = 'shipped'));
  memo.outboundShippedAt = new Date();
  pushEvent(memo, 'shipped', new Types.ObjectId(adminId), 'admin', 'Outbound label purchased');
  await memo.save();

  // void sendMemoShippedEmail(memo); // must restate due date + return instructions
  return memo;
}

/**
 * §5.4 — the ONLY place reservedForMemo is released on a return path.
 * "Delivered" tracking status is never sufficient; an admin must physically
 * inspect the item first.
 */
export async function adminMarkReturned(
  memoId: string,
  adminId: string,
  condition: 'ok' | 'damaged',
  note?: string
) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);

  if (!['return_requested', 'return_in_transit', 'overdue'].includes(memo.status)) {
    throw new MemoError('Memo is not in a state awaiting return inspection', 409);
  }

  if (condition === 'ok') {
    memo.status = 'returned';
    memo.items.forEach((i) => (i.itemStatus = 'returned'));
    memo.returnReceivedAt = new Date();
    await releaseReservation(memo, 'returned'); // item re-listed for sale
    pushEvent(memo, 'returned', new Types.ObjectId(adminId), 'admin', note ?? 'Inspected, condition OK');
    // void sendMemoReturnedConfirmationEmail(memo);
  } else {
    memo.status = 'damaged';
    memo.items.forEach((i) => (i.itemStatus = 'damaged'));
    memo.returnReceivedAt = new Date();
    // Deliberately does NOT release reservation — damaged stock is not
    // sellable and must be resolved manually (write-off / insurance / dispute).
    pushEvent(memo, 'damaged', new Types.ObjectId(adminId), 'admin', note ?? 'Inspected, DAMAGED');
    // void sendMemoOverdueAdminAlertEmail(memo, { reason: 'damaged return' });
  }

  await memo.save();
  return memo;
}

export async function adminRecall(memoId: string, adminId: string, note?: string) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);
  if (!['shipped', 'with_customer', 'overdue'].includes(memo.status)) {
    throw new MemoError('Only an active memo can be recalled', 409);
  }

  memo.status = 'recalled';
  memo.items.forEach((i) => (i.itemStatus = 'recalled'));
  // TODO: purchase a prepaid mandatory-return label, same as requestReturn().
  pushEvent(memo, 'recalled', new Types.ObjectId(adminId), 'admin', note ?? 'Force recall issued');
  await memo.save();

  // void sendMemoRecalledEmail(memo);
  return memo;
}

/**
 * Converts an overdue memo into a real charge. This is the one endpoint that
 * depends directly on the §7 payment-mechanism decision — currently wired
 * to the "credit-limit only, no per-memo deposit" option (cheapest to build,
 * relies on suspension as the deterrent). Swap the marked block for a
 * PayPal-refund-of-deposit or Stripe manual-capture flow if the business
 * picks a different option later — this function is the single seam.
 */
export async function adminForceConvert(
  memoId: string,
  adminId: string,
  opts: { suspendUser?: boolean; note?: string } = {}
) {
  await connectDB();
  const memo = await Memo.findById(memoId);
  if (!memo) throw new MemoError('Memo not found', 404);
  assertNotTerminal(memo);
  if (memo.status !== 'overdue') {
    throw new MemoError('Force-convert is only reachable from overdue — no skipping the grace period', 409);
  }

  // ---- §7 payment-mechanism seam ----
  // const order = await createOrderFromCart({ userId: memo.user.toString(), source: 'memo-force-convert', items: ..., paymentMethod: 'invoice' });
  const order = { _id: new Types.ObjectId() }; // placeholder
  // ------------------------------------

  memo.status = 'force_converted';
  memo.items.forEach((i) => (i.itemStatus = 'force_converted'));
  memo.convertedOrderId = order._id as any;
  await releaseReservation(memo, 'force_converted');
  for (const item of memo.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } });
  }
  pushEvent(memo, 'force_converted', new Types.ObjectId(adminId), 'admin', opts.note ?? 'Force-converted after non-return');
  await memo.save();

  const suspend = opts.suspendUser !== false; // default true, per plan §4.2
  if (suspend) {
    await User.updateOne(
      { _id: memo.user },
      { $set: { memoStatus: 'suspended', memoSuspendedReason: 'Force-converted overdue memo' } }
    );
  }

  // void sendMemoForceConvertedEmail(memo, order);
  return memo;
}

export async function adminGetStats() {
  await connectDB();
  const [active, overdue, totalOutAgg, convertedAgg] = await Promise.all([
    Memo.countDocuments({ status: { $in: OUTSTANDING_MEMO_STATUSES } }),
    Memo.countDocuments({ status: 'overdue' }),
    Memo.aggregate([
      { $match: { status: { $in: OUTSTANDING_MEMO_STATUSES } } },
      { $group: { _id: null, total: { $sum: '$totalValue' } } },
    ]),
    Memo.aggregate([
      {
        $match: {
          status: { $in: ['purchased', 'force_converted'] },
          updatedAt: { $gte: new Date(new Date().setDate(1)) }, // this calendar month
        },
      },
      { $group: { _id: null, total: { $sum: '$totalValue' }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    activeCount: active,
    overdueCount: overdue,
    totalValueOutstanding: totalOutAgg[0]?.total ?? 0,
    convertedThisMonth: {
      total: convertedAgg[0]?.total ?? 0,
      count: convertedAgg[0]?.count ?? 0,
    },
  };
}

export async function adminListEligibilityApplications() {
  await connectDB();
  return User.find({ memoStatus: 'pending' }).select(
    'name email memoBusinessName memoResaleCertNumber memoReferences createdAt'
  );
}

// ---------------------------------------------------------------------------
// Cron — GET /api/cron/memo-reminders calls these in sequence, one memo at a
// time (not Promise.all), matching the sync-deliveries cron's rate-limit-
// respecting pattern. Every send is guarded by an idempotency field so a
// retried or overlapping cron invocation never double-sends.
// ---------------------------------------------------------------------------

export async function runDueSoonReminders(): Promise<number> {
  await connectDB();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + DUE_SOON_WINDOW_DAYS);

  const memos = await Memo.find({
    status: 'with_customer',
    dueAt: { $lte: windowEnd, $gte: new Date() },
    dueSoonNotifiedAt: null,
  });

  let sent = 0;
  for (const memo of memos) {
    // void await sendMemoDueSoonEmail(memo); // sequential, not Promise.all
    memo.dueSoonNotifiedAt = new Date();
    await memo.save();
    sent += 1;
  }
  return sent;
}

export async function runOverdueSweep(): Promise<number> {
  await connectDB();
  const memos = await Memo.find({
    status: 'with_customer',
    dueAt: { $lt: new Date() },
  });

  let flipped = 0;
  for (const memo of memos) {
    memo.status = 'overdue';
    memo.items.forEach((i) => (i.itemStatus = 'overdue'));
    memo.overdueNotifiedAt = new Date();
    memo.overdueEscalationLevel = 1;
    memo.lastEscalationSentAt = new Date();
    pushEvent(memo, 'overdue', 'cron', 'system', 'Due date passed with no action');
    await memo.save();

    // void await sendMemoOverdueEmail(memo);
    // void await sendMemoOverdueAdminAlertEmail(memo);
    flipped += 1;
  }
  return flipped;
}

export async function runEscalationSweep(): Promise<number> {
  await connectDB();
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - OVERDUE_ESCALATION_INTERVAL_HOURS);

  const memos = await Memo.find({
    status: 'overdue',
    $or: [{ lastEscalationSentAt: { $lte: cutoff } }, { lastEscalationSentAt: null }],
  });

  let escalated = 0;
  for (const memo of memos) {
    memo.overdueEscalationLevel += 1;
    memo.lastEscalationSentAt = new Date();
    pushEvent(memo, 'overdue', 'cron', 'system', `Escalation level ${memo.overdueEscalationLevel}`);
    await memo.save();

    // void await sendMemoOverdueEmail(memo); // tone escalates with overdueEscalationLevel
    if (memo.overdueEscalationLevel >= OVERDUE_ADMIN_ALERT_LEVEL) {
      // void await sendMemoOverdueAdminAlertEmail(memo, { recommend: 'force-convert or recall' });
    }
    escalated += 1;
  }
  return escalated;
}

/**
 * Optional: polls carrier tracking for in-transit legs and advances the
 * SHIPPING status only. Never advances inventory state — see §5.4. A
 * "delivered" return never auto-flips to `returned`; it stops at
 * `return_in_transit` and waits for adminMarkReturned().
 */
export async function syncMemoTrackingStatuses(): Promise<number> {
  await connectDB();
  let updated = 0;

  const outbound = await Memo.find({ status: 'shipped', outboundTrackingNumber: { $exists: true } });
  for (const memo of outbound) {
    // const tracking = await trackShipEnginePackage(memo.outboundTrackingNumber!);
    // if (tracking.status === 'delivered') {
    //   memo.status = 'with_customer';
    //   memo.items.forEach((i) => (i.itemStatus = 'with_customer'));
    //   memo.outboundDeliveredAt = new Date();
    //   pushEvent(memo, 'with_customer', 'cron', 'system', 'Carrier reports delivered');
    //   await memo.save();
    //   updated += 1;
    // }
  }

  const returning = await Memo.find({ status: 'return_requested', returnTrackingNumber: { $exists: true } });
  for (const memo of returning) {
    // const tracking = await trackShipEnginePackage(memo.returnTrackingNumber!);
    // if (tracking.status === 'in_transit' || tracking.status === 'delivered') {
    //   // NOTE: even "delivered" only moves shipping status, never inventory.
    //   memo.status = 'return_in_transit';
    //   memo.items.forEach((i) => (i.itemStatus = 'return_in_transit'));
    //   pushEvent(memo, 'return_in_transit', 'cron', 'system', `Carrier: ${tracking.status}`);
    //   await memo.save();
    //   updated += 1;
    // }
  }

  return updated;
}

export async function adminUpdateEligibility(
  userId: string,
  adminId: string,
  payload: { action: 'approve' | 'deny' | 'suspend'; creditLimit?: number; reason?: string }
) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw new MemoError('User not found', 404);

  if (payload.action === 'approve') {
    if (!payload.creditLimit || payload.creditLimit <= 0) {
      throw new MemoError('A positive creditLimit is required to approve', 400);
    }
    user.memoStatus = 'approved';
    user.memoCreditLimit = payload.creditLimit;
    user.memoApprovedAt = new Date();
    user.memoApprovedBy = new Types.ObjectId(adminId);
    user.memoSuspendedReason = null;
    // void sendMemoApplicationApprovedEmail(user);
  } else if (payload.action === 'deny') {
    user.memoStatus = 'none';
  } else if (payload.action === 'suspend') {
    user.memoStatus = 'suspended';
    user.memoSuspendedReason = payload.reason ?? 'Suspended by admin';
  }

  await user.save();
  return user;
}
