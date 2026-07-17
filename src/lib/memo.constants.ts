/**
 * Memo business-rule constants.
 *
 * IMPORTANT: every one of these is enforced in memo.service.ts, not just in
 * the UI. A directly-called API request must be rejected the same way a
 * button-click would be, even if someone crafts the request by hand.
 */

// Hard ceiling on how long a customer may hold an item on memo, start to
// finish, INCLUDING any approved extension. Business requirement: 2 weeks.
export const MEMO_MAX_DAYS = 14;

// Default lower bound if a product doesn't override memoMinDays.
export const MEMO_MIN_DAYS_DEFAULT = 3;

// Default upper bound if a product doesn't override memoMaxDays.
// Must never exceed MEMO_MAX_DAYS — this is asserted in Product validation.
export const MEMO_MAX_DAYS_DEFAULT = MEMO_MAX_DAYS;

// How many extension *requests* a memo may have approved, total.
export const MAX_EXTENSIONS = 1;

// Statuses that count as "outstanding" against a user's memoCreditLimit and
// that block a new memo request under the "one unresolved memo" rule (§5.3
// of the plan only blocks on 'overdue', but credit-limit sums across all of
// these).
export const OUTSTANDING_MEMO_STATUSES = [
  'approved',
  'shipped',
  'with_customer',
  'return_requested',
  'return_in_transit',
  'overdue',
] as const;

// Statuses from which a new memo request is flatly rejected (business rule,
// not just a UI nicety — see §5.3).
export const BLOCKING_MEMO_STATUSES = ['overdue'] as const;

// Terminal statuses — a memo in one of these can never transition again.
// Used as a guard in every state-transition function to fail loudly instead
// of silently corrupting an already-closed record.
export const TERMINAL_MEMO_STATUSES = [
  'rejected',
  'purchased',
  'returned',
  'force_converted',
  'lost',
  'damaged',
  'cancelled',
] as const;

// The ONLY statuses from which releaseReservation() may be called. Anything
// else throws — this is the single audit point for reservedForMemo changes.
export const RESERVATION_RELEASING_STATUSES = [
  'returned',
  'purchased',
  'force_converted',
  'cancelled',
  'rejected',
  'lost',
] as const;

// Escalation cadence for the overdue cron (hours between escalation emails).
export const OVERDUE_ESCALATION_INTERVAL_HOURS = 24;

// Escalation level at which the admin gets a "recommend action" alert.
export const OVERDUE_ADMIN_ALERT_LEVEL = 3;

// "Due soon" reminder window.
export const DUE_SOON_WINDOW_DAYS = 2;

export const TERMS_VERSION = '2026-07-v1';
