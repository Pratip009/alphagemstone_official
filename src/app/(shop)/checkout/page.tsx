'use client';
import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import ShippingRateSelector from '@/components/shipping/ShippingRateSelector';
import type { ShippingRate } from '@/types/shipping';
import { STORE_ORIGIN, DEFAULT_PACKAGE } from '@/lib/shipping-config';
 import { cartEvents } from '@/hooks/useCart';

interface ShippingForm {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

const EMPTY_FORM: ShippingForm = {
  fullName: '', addressLine1: '', addressLine2: '',
  city: '', state: '', postalCode: '', country: 'IN', phone: '',
};

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NZ', name: 'New Zealand' }, { code: 'IE', name: 'Ireland' },
  { code: 'NL', name: 'Netherlands' }, { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' }, { code: 'DK', name: 'Denmark' },
  { code: 'CH', name: 'Switzerland' }, { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' }, { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' }, { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' }, { code: 'KE', name: 'Kenya' },
  { code: 'PH', name: 'Philippines' }, { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' }, { code: 'TH', name: 'Thailand' },
  { code: 'KR', name: 'South Korea' }, { code: 'CN', name: 'China' },
];

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ['DC','Washington D.C.'],
];

const CA_PROVINCES = [
  ['AB','Alberta'],['BC','British Columbia'],['MB','Manitoba'],['NB','New Brunswick'],
  ['NL','Newfoundland and Labrador'],['NS','Nova Scotia'],['NT','Northwest Territories'],
  ['NU','Nunavut'],['ON','Ontario'],['PE','Prince Edward Island'],['QC','Quebec'],
  ['SK','Saskatchewan'],['YT','Yukon'],
];

const IN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const POSTAL_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, hint: '12345 or 12345-6789' },
  CA: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, hint: 'A1B 2C3' },
  GB: { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, hint: 'SW1A 1AA' },
  AU: { pattern: /^\d{4}$/, hint: '2000' },
  IN: { pattern: /^\d{6}$/, hint: '110001' },
};

type FormErrors = Partial<Record<keyof ShippingForm, string>>;

function validateForm(form: ShippingForm, pinVerified: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!form.fullName.trim()) { errors.fullName = 'Full name is required'; }
  else if (!/^[A-Za-z\u00C0-\u024F\s'\-]{2,}$/.test(form.fullName.trim())) { errors.fullName = 'Letters, spaces and hyphens only'; }
  else if (form.fullName.trim().split(/\s+/).length < 2) { errors.fullName = 'Please enter first and last name'; }
  if (!form.addressLine1.trim()) { errors.addressLine1 = 'Street address is required'; }
  else if (form.addressLine1.trim().length < 5) { errors.addressLine1 = 'Enter a complete street address'; }
  if (!form.city.trim() && !pinVerified) {
    errors.city = 'City is required';
  } else if (form.city.trim() && !pinVerified && !/^[A-Za-z\u00C0-\u024F\s'\-\.]{2,}$/.test(form.city.trim())) {
    errors.city = 'Enter a valid city name';
  }
  if ((form.country === 'US' || form.country === 'CA' || form.country === 'IN') && !form.state) {
    errors.state = form.country === 'CA' ? 'Province is required' : 'State is required';
  }
  if (!form.postalCode.trim()) { errors.postalCode = 'Postal code is required'; }
  else {
    const rule = POSTAL_PATTERNS[form.country];
    if (rule && !rule.pattern.test(form.postalCode.trim())) { errors.postalCode = `Expected format: ${rule.hint}`; }
  }
  if (!form.country) { errors.country = 'Please select a country'; }
  if (!form.phone.trim()) { errors.phone = 'Phone number is required'; }
  else { const digits = form.phone.replace(/\D/g, ''); if (digits.length < 7 || digits.length > 15) { errors.phone = 'Enter a valid phone number (7–15 digits)'; } }
  return errors;
}

function formatPhone(raw: string, country: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  if (country === 'IN') { if (digits.length <= 5) return digits; return `${digits.slice(0, 5)} ${digits.slice(5)}`; }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
}

const LABELS: Record<keyof ShippingForm, string> = {
  fullName: 'Full Name', addressLine1: 'Street Address', addressLine2: 'Apt / Suite / Unit',
  city: 'City / District', state: 'State / Province', postalCode: 'Pincode / Postal Code',
  country: 'Country', phone: 'Phone Number',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const CheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.1"/>
    <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.5"/>
    <path d="M8 12l2.5 2.5L16 9" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const AlertCircle = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
    <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const Spinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
    <path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const MapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.5"/>
    <circle cx="12" cy="9" r="2.5" fill="#6366f1"/>
  </svg>
);
const Lock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="16" r="1" fill="currentColor"/>
  </svg>
);
const Truck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M1 3h15v13H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const Shield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6L12 2z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Star = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Package = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// ─── Sub-components ────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ marginTop: 5, fontSize: 11.5, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
      <AlertCircle />{msg}
    </p>
  );
}

function PincodeBanner({ postOffices, onSelect }: {
  postOffices: { Name: string; District: string; State: string }[];
  onSelect: (po: { Name: string; District: string; State: string }) => void;
}) {
  if (!postOffices.length) return null;
  return (
    <div style={{ marginTop: 8, borderRadius: 12, border: '1px solid #e0e7ff', background: '#f5f3ff', padding: '12px 14px' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <MapPin />
        {postOffices.length} area{postOffices.length > 1 ? 's' : ''} found — select yours
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
        {postOffices.map((po, i) => (
          <button key={i} type="button" onClick={() => onSelect(po)} style={{
            textAlign: 'left', padding: '8px 12px', borderRadius: 8,
            background: '#fff', border: '1px solid #c7d2fe',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>{po.Name}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{po.District}, {po.State}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrustBadges() {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 }}>
      {[
        { icon: <Shield />, label: 'SSL Secured Checkout' },
        { icon: <Truck />, label: 'Free Insured Shipping' },
        { icon: <Star />, label: '4.9★ Rated by 2,400+' },
      ].map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 100, padding: '6px 14px',
          fontSize: 11.5, fontWeight: 500, color: '#475569',
        }}>
          <span style={{ color: '#6366f1' }}>{b.icon}</span>
          {b.label}
        </div>
      ))}
    </div>
  );
}

function OrderSummary({ total, shippingRate, couponDiscount = 0 }: { total: number; shippingRate: ShippingRate | null; couponDiscount?: number }) {
  const shipping = shippingRate?.rate ?? 0;
  const grandTotal = Math.max(0, total + shipping - couponDiscount);
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, marginBottom: 28 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 14 }}>
        Order Summary
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#475569' }}>Subtotal</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>${total.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#475569' }}>
            {shippingRate ? `${shippingRate.carrier} – ${shippingRate.service}` : 'Shipping'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: shipping === 0 ? '#22c55e' : '#1e293b' }}>
            {shippingRate ? (shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`) : '—'}
          </span>
        </div>
        {couponDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#22c55e' }}>Coupon Discount</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>−${couponDiscount.toFixed(2)}</span>
          </div>
        )}
        <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>
            {shippingRate ? `$${grandTotal.toFixed(2)}` : `$${total.toFixed(2)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Step type ─────────────────────────────────────────────────────────────────
type Step = 'shipping' | 'rates' | 'payment';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { apiFetch } = useApi();
  const router = useRouter();
  const [step, setStep] = useState<Step>('shipping');
  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ShippingForm, boolean>>>({});
  const [orderId, setOrderId] = useState<string | null>(null);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedShipping, setSelectedShipping] = useState<ShippingRate | null>(null);

  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [postOffices, setPostOffices] = useState<{ Name: string; District: string; State: string }[]>([]);
  const [pinVerified, setPinVerified] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    apiFetch('/api/cart')
      .then((d) => setTotal(d.data.totals?.total || 0))
      .catch(() => router.push('/login'));
  }, []);

  useEffect(() => {
    const newErrors = validateForm(form, pinVerified);
    setErrors((prev) => {
      const updated: FormErrors = { ...prev };
      (Object.keys(newErrors) as (keyof ShippingForm)[]).forEach((k) => {
        if (touched[k]) updated[k] = newErrors[k];
      });
      (Object.keys(touched) as (keyof ShippingForm)[]).forEach((k) => {
        if (!newErrors[k]) delete updated[k];
      });
      return updated;
    });
  }, [form, touched, pinVerified]);

  const handleCountryChange = (country: string) => {
    setForm((f) => ({ ...f, country, state: '', postalCode: '', city: '' }));
    setTouched((t) => ({ ...t, country: true }));
    setPostOffices([]); setPinError(''); setPinVerified(false);
  };

  const handleBlur = (field: keyof ShippingForm) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const newErrors = validateForm(form, pinVerified);
    setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
  };

  const handleChange = (field: keyof ShippingForm, value: string) => {
    let processed = value;
    if (field === 'fullName') processed = value.replace(/[^A-Za-z\u00C0-\u024F\s'\-\.]/g, '');
    setForm((f) => ({ ...f, [field]: processed }));
  };

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 15);
    setForm((f) => ({ ...f, phone: digits }));
  };

  const handlePincodeChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setForm((f) => ({ ...f, postalCode: digits, city: '', state: '' }));
    setPostOffices([]); setPinError(''); setPinVerified(false);
    if (digits.length === 6) {
      setPinLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${digits}`);
        const data = await res.json();
        if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const offices = data[0].PostOffice as { Name: string; District: string; State: string }[];
          if (offices.length === 1) {
            setForm((f) => ({ ...f, postalCode: digits, city: offices[0].District, state: offices[0].State, country: 'IN' }));
            setTouched((t) => ({ ...t, postalCode: true, city: true, state: true }));
            setPinVerified(true);
            setErrors((prev) => { const updated = { ...prev }; delete updated.city; delete updated.state; delete updated.postalCode; return updated; });
          } else { setPostOffices(offices); }
        } else { setPinError('Invalid pincode. Please check and try again.'); }
      } catch { setPinError('Could not verify pincode. Fill city and state manually.'); }
      finally { setPinLoading(false); }
    }
  };

  const handlePostOfficeSelect = (po: { Name: string; District: string; State: string }) => {
    setForm((f) => ({ ...f, city: po.District, state: po.State, country: 'IN' }));
    setTouched((t) => ({ ...t, city: true, state: true, postalCode: true }));
    setPostOffices([]);
    setPinVerified(true);
    setErrors((prev) => { const updated = { ...prev }; delete updated.city; delete updated.state; delete updated.postalCode; return updated; });
  };

  const handlePostalChange = (value: string) => {
    if (form.country === 'IN') { handlePincodeChange(value); return; }
    let processed = value;
    if (form.country === 'US') { const d = value.replace(/\D/g, '').slice(0, 9); processed = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; }
    else if (form.country === 'CA') { const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6); processed = clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean; }
    else { processed = value.toUpperCase().slice(0, 10); }
    setForm((f) => ({ ...f, postalCode: processed }));
  };

  // ─── Step 1: validate address form → go to rate selection ─────────────────
  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = Object.keys(EMPTY_FORM).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<keyof ShippingForm, boolean>);
    setTouched(allTouched);
    if (form.country === 'IN' && !pinVerified && postOffices.length === 0) {
      setPinError('Please enter a valid 6-digit pincode to auto-fill your location.'); return;
    }
    const newErrors = validateForm(form, pinVerified);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setStep('rates');
  };

  // ─── Step 2: rate selected → create order → go to payment ─────────────────
  const handleRateConfirm = async () => {
    if (!selectedShipping) return;
    setApiError(''); setLoading(true);
    try {
      const data = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          shippingAddress: form,
          paymentMethod: 'paypal',
          shippingCarrier: selectedShipping.carrier,
          shippingService: selectedShipping.service,
          shippingServiceCode: selectedShipping.serviceCode ?? null,
          shippingRate: selectedShipping.rate,
          shippingRateId: selectedShipping.rateId, 
          shippingEstimatedDays: selectedShipping.estimatedDays ?? null,
          shippingEstimatedDelivery: selectedShipping.estimatedDelivery ?? null,
          ...(couponCode ? { couponCode } : {}),
        }),
      });
      // ── Set orderId first, then step — both are batched by React 18
      // but the PayPal block guards on orderId so it won't render until truthy
      setOrderId(data.data._id);
      setStep('payment');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: PayPal handlers ───────────────────────────────────────────────
  const createPayPalOrder = async () => {
    const data = await apiFetch('/api/payment/paypal/create', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
    return data.data.paypalOrderId;
  };

  const onPayPalApprove = async (data: { orderID: string }) => {
    setPaymentProcessing(true);
    try {
      await apiFetch('/api/payment/paypal/capture', {
        method: 'POST',
        body: JSON.stringify({ paypalOrderId: data.orderID }),
      });
      cartEvents.refresh();
      router.push('/orders?success=true');
    } catch (err) {
      setPaymentProcessing(false);
      setApiError(err instanceof Error ? err.message : 'Payment capture failed');
    }
  };

  // ─── Destination address for ShippingRateSelector ─────────────────────────
  const shippingDestination = {
    fullName: form.fullName,
    street1: form.addressLine1,
    street2: form.addressLine2 || undefined,
    city: form.city,
    state: form.state,
    postalCode: form.postalCode,
    country: form.country,
    phone: form.phone,
  };

  const isIndia = form.country === 'IN';
  const showUSCADropdown = form.country === 'US' || form.country === 'CA';
  const stateOptions = form.country === 'US' ? US_STATES : CA_PROVINCES;
  const stateLabel = form.country === 'CA' ? 'Province' : 'State';

  // ─── Style helpers ─────────────────────────────────────────────────────────
  const fieldState = (field: keyof ShippingForm): 'error' | 'valid' | 'idle' => {
    if (errors[field]) return 'error';
    if (touched[field] && !errors[field] && form[field]) return 'valid';
    return 'idle';
  };

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 13.5,
    fontFamily: "'Google Sans Flex', sans-serif", outline: 'none', transition: 'all 0.18s',
    color: '#1e293b', background: '#fff', WebkitAppearance: 'none',
  };
  const inputStyle = (state: 'error' | 'valid' | 'idle', extra?: React.CSSProperties): React.CSSProperties => ({
    ...inputBase,
    border: state === 'error' ? '1.5px solid #fca5a5' : state === 'valid' ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
    boxShadow: state === 'error' ? '0 0 0 3px rgba(239,68,68,0.06)' : state === 'valid' ? '0 0 0 3px rgba(34,197,94,0.08)' : 'none',
    ...extra,
  });
  const lockedStyle: React.CSSProperties = { ...inputBase, background: '#f8fafc', border: '1.5px solid #86efac', color: '#374151', boxShadow: '0 0 0 3px rgba(34,197,94,0.08)', cursor: 'default' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };

  const STEPS: Step[] = ['shipping', 'rates', 'payment'];
  const STEP_LABELS: Record<Step, string> = { shipping: 'Address', rates: 'Shipping', payment: 'Payment' };

  // ─── PayPalScriptProvider options (stable — never recreated) ───────────────
  // IMPORTANT: defined outside JSX so the object reference doesn't change on
  // re-render, which would cause the SDK to reload and break the buttons.
  const paypalOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    currency: 'USD',
  };

  return (
    // ── PayPalScriptProvider wraps the ENTIRE page so it is never
    // unmounted/remounted as the user moves between steps.
    // PayPalButtons inside step 3 will work because the SDK is already loaded.
    <PayPalScriptProvider options={paypalOptions}>
      <>
        {/* ── Payment Processing Overlay ────────────────────────────────────── */}
        {paymentProcessing && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 15, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
            padding: '0 20px', textAlign: 'center',
          }}>
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ animation: 'spin 1s linear infinite', position: 'absolute', inset: 0 }}>
                <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(201,168,76,0.15)" strokeWidth="4" />
                <circle cx="36" cy="36" r="30" fill="none" stroke="#c9a84c" strokeWidth="4" strokeLinecap="round" strokeDasharray="60 130" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#c9a84c" opacity="0.9"/>
                </svg>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: 600, color: '#f5f1eb', fontFamily: '"Google Sans Flex", sans-serif', letterSpacing: '-0.3px', marginBottom: 8 }}>
                Confirming your payment…
              </p>
              <p style={{ fontSize: 13, color: '#8a8278', maxWidth: 280 }}>
                Please wait while we verify your transaction and prepare your order.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#c9a84c',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  opacity: 0.6,
                }} />
              ))}
            </div>
            <style>{`
              @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.4); opacity: 1; } }
            `}</style>
          </div>
        )}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
          .co * { box-sizing: border-box; margin: 0; padding: 0; }
          .co input::placeholder { color: #cbd5e1 !important; }
          .co select { appearance: none; cursor: pointer; }
          .co input:focus, .co select:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }
          .field-wrap { animation: fadeUp 0.3s ease both; }
          .submit-btn { transition: all 0.2s; }
          .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
          .submit-btn:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
          .back-btn:hover { background: #f1f5f9 !important; }
          ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

          /* ── Responsive layout ──────────────────────────────────────────── */
          .co-header {
            padding: 0 24px;
          }
          .co-main-grid {
            max-width: 1060px; margin: 0 auto; padding: 40px 20px 60px;
            display: grid; grid-template-columns: 1fr 380px; gap: 40px; align-items: start;
          }
          .co-card-body { padding: 28px 28px 32px; }
          .co-steps { display: flex; align-items: center; gap: 0; margin-bottom: 32px; flex-wrap: wrap; row-gap: 10px; }
          .co-step-connector { width: 48px; height: 2px; border-radius: 2px; margin: 0 12px; transition: background 0.4s; }
          .co-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .co-coupon-row { display: flex; gap: 8px; }

          @media (max-width: 900px) {
            .co-main-grid { grid-template-columns: 1fr; gap: 28px; padding: 28px 16px 40px; }
          }
          @media (max-width: 480px) {
            .co-header { padding: 0 14px; }
            .co-card-body { padding: 20px 16px 24px; }
            .co-step-connector { width: 20px; margin: 0 6px; }
          }
          @media (max-width: 420px) {
            .co-two-col { grid-template-columns: 1fr; }
          }
          @media (max-width: 360px) {
            .co-coupon-row { flex-wrap: wrap; }
            .co-coupon-row input { flex: 1 1 100%; }
            .co-coupon-row button { flex: 1 1 100%; }
          }
        `}</style>

        <div className="co" style={{ minHeight: '100vh', background: '#ffffff', fontFamily: "'Google Sans Flex', sans-serif" }}>

          {/* Top nav */}
          <header className="co-header" style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Package />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', letterSpacing: '-0.01em' }}>Alpha Imports</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
              <Lock /> <span className="co-secure-label">Secure Checkout</span>
            </div>
          </header>

          {/* Main layout */}
          <div className="co-main-grid">

            {/* LEFT COLUMN */}
            <div>
              <div style={{ marginBottom: 28, animation: 'fadeUp 0.4s ease both' }}>
                <h1 style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {step === 'shipping' ? 'Delivery Details' : step === 'rates' ? 'Choose Shipping' : 'Complete Payment'}
                </h1>
                <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>
                  {step === 'shipping' ? 'Enter your shipping address to continue' : step === 'rates' ? 'Select a shipping method for your order' : 'Review your order and complete payment securely'}
                </p>
              </div>

              {/* Step indicator */}
              <div className="co-steps">
                {STEPS.map((s, i) => {
                  const done = STEPS.indexOf(step) > i;
                  const active = step === s;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                      {i > 0 && (
                        <div className="co-step-connector" style={{ background: done ? '#6366f1' : '#e2e8f0' }} />
                      )}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 14px', borderRadius: 100,
                        background: active ? '#6366f1' : done ? '#f0fdf4' : '#f8fafc',
                        border: `1.5px solid ${active ? '#6366f1' : done ? '#86efac' : '#e2e8f0'}`,
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          background: active ? 'rgba(255,255,255,0.2)' : done ? '#22c55e' : '#e2e8f0',
                          fontSize: 10, fontWeight: 700,
                          color: active ? '#fff' : done ? '#fff' : '#94a3b8',
                        }}>
                          {done ? '✓' : i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#fff' : done ? '#166534' : '#94a3b8', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {STEP_LABELS[s]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main card */}
              <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.05)', overflow: 'hidden', animation: 'fadeUp 0.4s ease 0.08s both' }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)' }} />
                <div className="co-card-body">

                  {/* ── STEP 1: SHIPPING ADDRESS ── */}
                  {step === 'shipping' && (
                    <form onSubmit={handleShippingSubmit} noValidate>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                        {/* Full Name */}
                        <div className="field-wrap" style={{ animationDelay: '0.05s' }}>
                          <label style={labelStyle}>Full Name <span style={{ color: '#6366f1' }}>*</span></label>
                          <div style={{ position: 'relative' }}>
                            <input style={inputStyle(fieldState('fullName'))} placeholder="Rahul Sharma" value={form.fullName}
                              onChange={(e) => handleChange('fullName', e.target.value)} onBlur={() => handleBlur('fullName')} autoComplete="name" />
                            {fieldState('fullName') === 'valid' && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><CheckCircle /></span>}
                          </div>
                          <FieldError msg={errors.fullName} />
                        </div>

                        {/* Country */}
                        <div className="field-wrap" style={{ animationDelay: '0.08s' }}>
                          <label style={labelStyle}>Country <span style={{ color: '#6366f1' }}>*</span></label>
                          <div style={{ position: 'relative' }}>
                            <select style={{ ...inputStyle(fieldState('country')), paddingRight: 40 }} value={form.country}
                              onChange={(e) => handleCountryChange(e.target.value)} onBlur={() => handleBlur('country')}>
                              <option value="">Select country…</option>
                              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}><ChevronDown /></span>
                          </div>
                          <FieldError msg={errors.country} />
                        </div>

                        {/* India pincode */}
                        {isIndia && (
                          <div className="field-wrap" style={{ animationDelay: '0.11s' }}>
                            <label style={labelStyle}>
                              Pincode <span style={{ color: '#6366f1' }}>*</span>
                              <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>(auto-fills city & state)</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                style={pinError ? inputStyle('error') : pinVerified ? inputStyle('valid') : inputStyle(fieldState('postalCode'))}
                                placeholder="Enter 6-digit pincode" value={form.postalCode}
                                onChange={(e) => handlePincodeChange(e.target.value)} onBlur={() => handleBlur('postalCode')}
                                autoComplete="postal-code" maxLength={6} inputMode="numeric" />
                              {pinLoading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }}><Spinner /></span>}
                              {pinVerified && !pinLoading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><CheckCircle /></span>}
                            </div>
                            {pinError && <p style={{ marginTop: 5, fontSize: 11.5, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}><AlertCircle />{pinError}</p>}
                            <FieldError msg={errors.postalCode} />
                            <PincodeBanner postOffices={postOffices} onSelect={handlePostOfficeSelect} />
                            {pinVerified && form.city && form.state && (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', flexWrap: 'wrap' }}>
                                <MapPin />
                                <span style={{ fontSize: 12.5, color: '#166534', fontWeight: 500 }}>{form.city}, {form.state}, India</span>
                                <button type="button" onClick={() => { setForm((f) => ({ ...f, postalCode: '', city: '', state: '' })); setPinVerified(false); setPostOffices([]); setPinError(''); setErrors((prev) => { const u = { ...prev }; delete u.city; delete u.state; return u; }); }}
                                  style={{ marginLeft: 'auto', fontSize: 11.5, color: '#6366f1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                  Change
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Address Line 1 */}
                        <div className="field-wrap" style={{ animationDelay: '0.13s' }}>
                          <label style={labelStyle}>Street Address <span style={{ color: '#6366f1' }}>*</span></label>
                          <div style={{ position: 'relative' }}>
                            <input style={inputStyle(fieldState('addressLine1'))} placeholder={isIndia ? 'House No., Street, Area' : '123 Main Street'} value={form.addressLine1}
                              onChange={(e) => handleChange('addressLine1', e.target.value)} onBlur={() => handleBlur('addressLine1')} autoComplete="address-line1" />
                            {fieldState('addressLine1') === 'valid' && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><CheckCircle /></span>}
                          </div>
                          <FieldError msg={errors.addressLine1} />
                        </div>

                        {/* Address Line 2 */}
                        <div className="field-wrap" style={{ animationDelay: '0.15s' }}>
                          <label style={labelStyle}>Apt / Suite / Unit <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>(optional)</span></label>
                          <input style={inputStyle('idle')} placeholder={isIndia ? 'Landmark, Colony, etc.' : 'Apt 4B, Floor 2, etc.'} value={form.addressLine2}
                            onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} autoComplete="address-line2" />
                        </div>

                        {/* City + State */}
                        <div className="field-wrap co-two-col" style={{ animationDelay: '0.17s' }}>
                          <div>
                            <label style={labelStyle}>{isIndia ? 'District / City' : LABELS.city} <span style={{ color: '#6366f1' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                              <input style={isIndia && pinVerified ? lockedStyle : inputStyle(fieldState('city'))} placeholder={isIndia ? 'Auto-filled' : 'New York'}
                                value={form.city} onChange={(e) => !pinVerified && handleChange('city', e.target.value)} onBlur={() => !pinVerified && handleBlur('city')}
                                readOnly={isIndia && pinVerified} autoComplete="address-level2" />
                              {((isIndia && pinVerified) || (!isIndia && fieldState('city') === 'valid')) && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><CheckCircle /></span>}
                            </div>
                            <FieldError msg={errors.city} />
                          </div>
                          <div>
                            <label style={labelStyle}>{isIndia ? 'State' : showUSCADropdown ? stateLabel : 'State / Region'}<span style={{ color: '#6366f1' }}> *</span></label>
                            {isIndia ? (
                              <div style={{ position: 'relative' }}>
                                {pinVerified ? <input style={lockedStyle} value={form.state} readOnly /> : (
                                  <select style={{ ...inputStyle(fieldState('state')), paddingRight: 40 }} value={form.state}
                                    onChange={(e) => { setForm((f) => ({ ...f, state: e.target.value })); setTouched((t) => ({ ...t, state: true })); }} onBlur={() => handleBlur('state')}>
                                    <option value="">Select state…</option>
                                    {IN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                )}
                                {pinVerified
                                  ? <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><CheckCircle /></span>
                                  : <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}><ChevronDown /></span>}
                              </div>
                            ) : showUSCADropdown ? (
                              <div style={{ position: 'relative' }}>
                                <select style={{ ...inputStyle(fieldState('state')), paddingRight: 40 }} value={form.state}
                                  onChange={(e) => { setForm((f) => ({ ...f, state: e.target.value })); setTouched((t) => ({ ...t, state: true })); }} onBlur={() => handleBlur('state')}>
                                  <option value="">Select…</option>
                                  {stateOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                                </select>
                                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}><ChevronDown /></span>
                              </div>
                            ) : (
                              <input style={inputStyle(fieldState('state'))} placeholder="State / Region" value={form.state}
                                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} onBlur={() => handleBlur('state')} autoComplete="address-level1" />
                            )}
                            <FieldError msg={errors.state} />
                          </div>
                        </div>

                        {/* Postal code non-India */}
                        {!isIndia && (
                          <div className="field-wrap" style={{ animationDelay: '0.19s' }}>
                            <label style={labelStyle}>
                              Postal Code <span style={{ color: '#6366f1' }}>*</span>
                              {POSTAL_PATTERNS[form.country] && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>({POSTAL_PATTERNS[form.country].hint})</span>}
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input style={inputStyle(fieldState('postalCode'))} placeholder={POSTAL_PATTERNS[form.country]?.hint || 'Postal code'} value={form.postalCode}
                                onChange={(e) => handlePostalChange(e.target.value)} onBlur={() => handleBlur('postalCode')} autoComplete="postal-code" />
                              {fieldState('postalCode') === 'valid' && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}><CheckCircle /></span>}
                            </div>
                            <FieldError msg={errors.postalCode} />
                          </div>
                        )}

                        {/* Phone */}
                        <div className="field-wrap" style={{ animationDelay: '0.21s' }}>
                          <label style={labelStyle}>Phone Number <span style={{ color: '#6366f1' }}>*</span></label>
                          <div style={{
                            display: 'flex', borderRadius: 10, overflow: 'hidden',
                            border: errors.phone ? '1.5px solid #fca5a5' : (touched.phone && !errors.phone && form.phone) ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
                            boxShadow: errors.phone ? '0 0 0 3px rgba(239,68,68,0.06)' : (touched.phone && !errors.phone && form.phone) ? '0 0 0 3px rgba(34,197,94,0.08)' : 'none',
                            transition: 'all 0.18s',
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 600, borderRight: '1.5px solid #e2e8f0', whiteSpace: 'nowrap', minWidth: 52, flexShrink: 0 }}>
                              {form.country === 'IN' ? '+91' : form.country === 'US' || form.country === 'CA' ? '+1' : form.country === 'GB' ? '+44' : form.country === 'AU' ? '+61' : form.country === 'AE' ? '+971' : '+'}
                            </span>
                            <input style={{ flex: 1, minWidth: 0, border: 'none', padding: '11px 14px', fontSize: 13.5, fontFamily: "'Google Sans Flex', sans-serif", outline: 'none', background: '#fff', color: '#1e293b' }}
                              type="tel" placeholder={isIndia ? '98765 43210' : '(555) 123-4567'}
                              value={form.phone ? formatPhone(form.phone, form.country) : ''}
                              onChange={(e) => handlePhoneChange(e.target.value)} onBlur={() => handleBlur('phone')} autoComplete="tel" inputMode="numeric" />
                            {touched.phone && !errors.phone && form.phone && <span style={{ display: 'flex', alignItems: 'center', paddingRight: 12, flexShrink: 0 }}><CheckCircle /></span>}
                          </div>
                          <FieldError msg={errors.phone} />
                        </div>

                        {Object.keys(errors).length > 0 && Object.keys(touched).length > 3 && (
                          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                            <AlertCircle /> Please fix {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''} before continuing
                          </div>
                        )}

                        <button className="submit-btn" type="submit" disabled={loading || pinLoading} style={{
                          width: '100%', padding: '14px 24px', marginTop: 4,
                          background: loading || pinLoading ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: loading || pinLoading ? '#94a3b8' : '#fff',
                          border: 'none', borderRadius: 12, cursor: loading || pinLoading ? 'not-allowed' : 'pointer',
                          fontSize: 14, fontWeight: 600, fontFamily: "'Google Sans Flex', sans-serif", letterSpacing: '0.01em',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        }}>
                          {loading ? <><Spinner /> Processing…</> : <>Choose Shipping Method <ArrowRight /></>}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── STEP 2: SHIPPING RATE SELECTOR ── */}
                  {step === 'rates' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Address summary */}
                      <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{form.fullName}</p>
                          <p style={{ fontSize: 11.5, color: '#64748b' }}>{form.addressLine1}, {form.city}, {form.state} {form.postalCode}</p>
                        </div>
                        <button onClick={() => setStep('shipping')} style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          Edit
                        </button>
                      </div>

                      <ShippingRateSelector
                        origin={STORE_ORIGIN}
                        destination={shippingDestination}
                        package={DEFAULT_PACKAGE}
                        onSelect={setSelectedShipping}
                        selectedServiceCode={selectedShipping ? `${selectedShipping.carrier}-${selectedShipping.service}` : undefined}
                      />

                      {apiError && (
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#dc2626', fontWeight: 500 }}>
                          {apiError}
                        </div>
                      )}

                      <button className="submit-btn" onClick={handleRateConfirm} disabled={!selectedShipping || loading} style={{
                        width: '100%', padding: '14px 24px',
                        background: !selectedShipping || loading ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        color: !selectedShipping || loading ? '#94a3b8' : '#fff',
                        border: 'none', borderRadius: 12, cursor: !selectedShipping || loading ? 'not-allowed' : 'pointer',
                        fontSize: 14, fontWeight: 600, fontFamily: "'Google Sans Flex', sans-serif", letterSpacing: '0.01em',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      }}>
                        {loading ? <><Spinner /> Creating order…</> : <>Continue to Payment <ArrowRight /></>}
                      </button>

                      <button className="back-btn" onClick={() => setStep('shipping')} style={{ width: '100%', padding: '12px 24px', background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'Google Sans Flex', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <ArrowLeft /> Back to Address
                      </button>
                    </div>
                  )}

                  {/* ── STEP 3: PAYMENT ── */}
                  {step === 'payment' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Shipping summary */}
                      <div style={{ borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Truck /> Delivering to
                        </p>
                        <p style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a', marginBottom: 3 }}>{form.fullName}</p>
                        <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6 }}>
                          {form.addressLine1}{form.addressLine2 ? `, ${form.addressLine2}` : ''}<br />
                          {form.city}, {form.state} {form.postalCode}<br />
                          {COUNTRIES.find((c) => c.code === form.country)?.name}
                        </p>
                        {selectedShipping && (
                          <p style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginTop: 8 }}>
                            {selectedShipping.carrier} · {selectedShipping.service} — ${selectedShipping.rate.toFixed(2)}
                            {selectedShipping.estimatedDelivery && ` · ${selectedShipping.estimatedDelivery}`}
                          </p>
                        )}
                      </div>

                      {apiError && (
                        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12.5, color: '#dc2626', fontWeight: 500 }}>
                          {apiError}
                        </div>
                      )}

                      {/* ── PayPal buttons ────────────────────────────────────────────────────
                          PayPalScriptProvider lives at the top of the tree so it's never
                          remounted. Here we just render the buttons once orderId is ready.
                          While orderId is still null (the brief moment between setOrderId
                          and the re-render), we show a spinner instead.            ── */}
                      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!orderId ? (
                          <div style={{ padding: 24, color: '#6366f1' }}><Spinner /></div>
                        ) : (
                          <div style={{ width: '100%', padding: '8px' }}>
                            <PayPalButtons
                              createOrder={createPayPalOrder}
                              onApprove={onPayPalApprove}
                              onError={(err) => setApiError(String(err))}
                              style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' }}
                            />
                          </div>
                        )}
                      </div>

                      <button className="back-btn" onClick={() => setStep('rates')} style={{ width: '100%', padding: '12px 24px', background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'Google Sans Flex', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.18s' }}>
                        <ArrowLeft /> Back to Shipping
                      </button>
                    </div>
                  )}

                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#94a3b8', fontSize: 12, flexWrap: 'wrap' }}>
                <Lock /> 256-bit SSL encrypted · Your information is always secure
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ animation: 'fadeUp 0.4s ease 0.15s both' }}>
              <TrustBadges />

              {/* ── Coupon Input ────────────────────────────────────────── */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12 }}>
                  Coupon Code
                </p>
                {couponDiscount > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>✓ {couponCode} — $10 off applied!</span>
                    <button
                      onClick={() => { setCouponCode(''); setCouponInput(''); setCouponDiscount(0); setCouponMsg(''); }}
                      style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="co-coupon-row">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(''); }}
                        placeholder="Enter code"
                        style={{ flex: 1, minWidth: 0, border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'Google Sans Flex', letterSpacing: '0.08em', outline: 'none' }}
                      />
                      <button
                        disabled={couponLoading || !couponInput.trim()}
                        onClick={async () => {
                          if (!couponInput.trim()) return;
                          setCouponLoading(true); setCouponMsg('');
                          try {
                            const res = await fetch('/api/coupons/validate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ code: couponInput.trim(), subtotal: total }),
                            });
                            const json = await res.json();
                            if (json?.data?.valid) {
                              setCouponCode(couponInput.trim().toUpperCase());
                              setCouponDiscount(json.data.discount);
                              setCouponMsg('');
                            } else {
                              setCouponMsg(json?.data?.message ?? json?.message ?? 'Invalid code.');
                            }
                          } catch { setCouponMsg('Network error. Try again.'); }
                          finally { setCouponLoading(false); }
                        }}
                        style={{ padding: '9px 16px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: couponLoading || !couponInput.trim() ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {couponLoading ? '…' : 'Apply'}
                      </button>
                    </div>
                    {couponMsg && <p style={{ marginTop: 6, fontSize: 11.5, color: couponMsg.includes('off') ? '#15803d' : '#dc2626' }}>{couponMsg}</p>}
                  </>
                )}
              </div>

              <OrderSummary total={total} shippingRate={selectedShipping} couponDiscount={couponDiscount} />
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.01em' }}>What to expect</p>
                {[
                  { step: '1', title: 'Order Confirmed', desc: 'Instant email confirmation', color: '#6366f1' },
                  { step: '2', title: 'Packed & Dispatched', desc: 'Within 1–2 business days', color: '#8b5cf6' },
                  { step: '3', title: 'Out for Delivery', desc: '3–7 days estimated delivery', color: '#a78bfa' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 2 ? 16 : 0, position: 'relative' }}>
                    {i < 2 && <div style={{ position: 'absolute', left: 15, top: 28, width: 1, height: 24, background: '#e2e8f0' }} />}
                    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: item.color + '15', border: `1.5px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: item.color }}>
                      {item.step}
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 11.5, color: '#94a3b8' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Need help?</p>
                <p style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10 }}>Our support team is available 24/7</p>
                <a href="mailto:support@alphaimports.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#6366f1', textDecoration: 'none', padding: '7px 16px', background: '#eef2ff', borderRadius: 8 }}>
                  support@alphaimports.com
                </a>
              </div>
            </div>

          </div>
        </div>
      </>
    </PayPalScriptProvider>
  );
}