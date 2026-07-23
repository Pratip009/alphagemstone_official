'use client';

import { useState } from 'react';
import {
  Gem, Shield, RotateCcw, Truck, HelpCircle, Heart,
  Package, Star, BookOpen, Award, FileText, ChevronDown,
  Mail, Phone, MapPin, Users, Tag, Search, CheckCircle, Gift,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface PolicyBlockProps {
  title: string;
  items: string[];
}

interface AccordionItemProps {
  question: string;
  answer: string;
}

interface InfoCardProps {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

interface StatCardProps {
  label: string;
  value: string;
}

interface BenefitCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'legal',   label: 'Policies & Legal',      icon: Shield    },
  { id: 'help',    label: 'Help & Orders',          icon: HelpCircle},
  { id: 'learn',   label: 'Products & Learning',    icon: BookOpen  },
  { id: 'contact', label: 'Contact & Club',         icon: Users     },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Are the gemstones natural?',
    a: 'Yes. All our gemstones are natural. Most colored stones are Enhanced (E) or Treated (T) — methods may include heating, oiling, resin filling, diffusion, or irradiation, which is standard industry practice and disclosed on all products.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Shipping times vary by destination and method selected. Domestic US orders typically arrive within 3–7 business days. International orders depend on customs clearance.',
  },
  {
    q: 'Do you offer wholesale pricing?',
    a: 'Yes. We offer volume discounts for jewelry manufacturers, retailers, and bulk buyers. Please contact us directly for quantity pricing.',
  },
  {
    q: 'Can I request matching stones?',
    a: 'Absolutely. Our expert team can help match stones by color, size, shape, and quality. Contact us via the Help Center for custom matching requests.',
  },
  {
    q: 'Do you ship internationally?',
    a: 'Yes, we ship worldwide using FedEx, UPS, and USPS. International buyers are responsible for any local duties or taxes.',
  },
  {
    q: 'Which payment methods are accepted?',
    a: 'We accept major credit cards, PayPal, and other secure payment methods. All transactions are SSL-encrypted for your safety.',
  },
  {
    q: 'How do I return an item?',
    a: 'Returns are accepted within 10 days of delivery for unused items in original condition. Contact us first for a return authorization number before sending anything back.',
  },
  {
    q: 'Are custom orders returnable?',
    a: 'Custom orders and special-cut stones are non-returnable. Please contact us before placing a custom order to ensure specifications are correct.',
  },
];

// ─── Shared Primitives ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-1.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gold-faint border border-gold-muted shrink-0">
          <Icon size={15} strokeWidth={1.8} className="text-gold" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink tracking-tight leading-none">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-xs text-ink-muted ml-12 mt-1">{subtitle}</p>
      )}
      <div className="h-px mt-4 bg-gradient-to-r from-gold/40 via-gold/20 to-transparent" />
    </div>
  );
}

function PolicyBlock({ title, items }: PolicyBlockProps) {
  return (
    <div className="mb-6">
      <h3 className="text-[0.58rem] tracking-[0.26em] uppercase font-black text-ink mb-3">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[0.73rem] text-ink-soft leading-relaxed">
            <span className="text-gold mt-1 text-[0.4rem] shrink-0">◆</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccordionItem({ question, answer }: AccordionItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-cream-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-3.5 text-left bg-transparent border-none cursor-pointer group"
      >
        <span className="text-[0.8rem] font-semibold text-ink-dark pr-4 group-hover:text-gold transition-colors duration-150">
          {question}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`text-gold shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="text-[0.74rem] text-ink-muted leading-relaxed pb-4 mt-0">
          {answer}
        </p>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: InfoCardProps) {
  return (
    <div className="bg-white border border-cream-border rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={13} strokeWidth={2} className="text-gold" />
        <h3 className="text-[0.6rem] tracking-[0.22em] uppercase font-black text-ink">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-white border border-cream-border rounded-xl p-4">
      <p className="text-[0.58rem] tracking-[0.2em] uppercase text-gold font-bold mb-1">{label}</p>
      <p className="text-[0.82rem] font-semibold text-ink-dark">{value}</p>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, desc }: BenefitCardProps) {
  return (
    <div className="bg-white border border-cream-border rounded-xl p-4 text-center">
      <div className="w-8 h-8 rounded-lg mx-auto mb-2.5 bg-gold-faint border border-gold-muted flex items-center justify-center">
        <Icon size={13} strokeWidth={2} className="text-gold" />
      </div>
      <p className="text-[0.68rem] font-bold text-ink mb-1">{title}</p>
      <p className="text-[0.67rem] text-ink-muted leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── Tab Pages ────────────────────────────────────────────────────────────────

function LegalPage() {
  return (
    <div>
      {/* Privacy Policy */}
      <SectionHeader
        icon={Shield}
        title="Privacy Policy"
        subtitle="We respect your privacy and are committed to protecting your personal information."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <PolicyBlock
          title="Information We Collect"
          items={['Name, address, phone & email', 'Payment details and order history', 'IP address & browser info for security']}
        />
        <PolicyBlock
          title="How We Use It"
          items={['Process and ship orders', 'Customer support & fraud prevention', 'Improve website experience', 'Promotional offers & newsletters (optional)']}
        />
        <PolicyBlock
          title="Third Parties & Cookies"
          items={['Shipping details shared with FedEx, UPS, USPS & payment processors only', 'Cookies improve browsing and remember preferences', 'Customers may request correction or removal of data']}
        />
      </div>
      <div className="bg-cream-warm rounded-xl px-4 py-3 mb-12">
        <p className="text-[0.72rem] text-ink-soft leading-relaxed">
          <span className="font-bold text-ink-dark">Security: </span>
          All transactions are protected with SSL encryption and secure payment gateways.
        </p>
      </div>

      {/* Terms */}
      <SectionHeader
        icon={FileText}
        title="Terms & Conditions"
        subtitle="By using AlphaImports.com, you agree to the following terms."
      />
      <PolicyBlock
        title="General Terms"
        items={[
          'Product images may appear larger for display purposes',
          'Natural gemstones may vary in color, shape, or inclusions',
          'Prices and availability may change without notice',
          'Orders may be canceled in case of pricing or inventory errors',
          'Customers are responsible for providing accurate shipping information',
          'Unauthorized use of website images/content is prohibited',
          'All disputes governed under North Carolina, USA laws',
        ]}
      />

      <div className="h-8" />

      {/* Return Policy */}
      <SectionHeader
        icon={RotateCcw}
        title="Return Policy"
        subtitle="Customer satisfaction is our priority."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Return Window" value="10 days from delivery" />
        <StatCard label="Condition" value="Unused, original condition" />
        <StatCard label="Custom Orders" value="Non-returnable" />
        <StatCard label="Shipping Charges" value="Non-refundable" />
      </div>
      <p className="text-[0.73rem] text-ink-muted leading-relaxed mb-12">
        Return authorization is required before sending any package back. Refunds are processed after inspection of returned merchandise.
      </p>

      {/* Shipping */}
      <SectionHeader
        icon={Truck}
        title="Shipping Policy"
        subtitle="We ship worldwide using trusted carriers."
      />
      <div className="flex gap-2.5 flex-wrap mb-4">
        {['FedEx', 'UPS', 'USPS'].map((c) => (
          <span
            key={c}
            className="px-4 py-1.5 rounded-full border border-gold-muted bg-gold-faint text-[0.72rem] font-bold text-ink-dark tracking-wide"
          >
            {c}
          </span>
        ))}
      </div>
      <PolicyBlock
        title="Important Notes"
        items={[
          'Orders ship after payment verification',
          'Tracking info emailed after shipment',
          'Delivery times vary by destination and customs clearance',
          'International buyers responsible for local duties and taxes',
        ]}
      />
    </div>
  );
}

function HelpPage() {
  return (
    <div>
      <SectionHeader
        icon={HelpCircle}
        title="Help Center"
        subtitle="Our team is here to assist with orders, products, returns, and more."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <InfoCard icon={Package} title="Track My Order">
          <p className="text-[0.74rem] text-ink-soft leading-relaxed mb-2.5">
            Use your tracking number or order confirmation email to check delivery status. Log in to your account for full order history.
          </p>
          <p className="text-[0.7rem] text-ink-muted">
            Questions?{' '}
            <a href="mailto:orders@alphaimports.com" className="text-gold font-semibold hover:text-ink-dark transition-colors">
              orders@alphaimports.com
            </a>
          </p>
        </InfoCard>

        <InfoCard icon={Heart} title="Wish List">
          <p className="text-[0.74rem] text-ink-soft leading-relaxed">
            Save your favorite gems and jewelry to your personal Wish List for easy access, future purchase, and side-by-side product comparison — all within your account.
          </p>
        </InfoCard>

        <InfoCard icon={Gift} title="Drop Shipping">
          <p className="text-[0.74rem] text-ink-soft leading-relaxed mb-3">
            Professional drop shipping for jewelers, online sellers, and retailers worldwide.
          </p>
          <ul className="space-y-1.5">
            {['Blind shipping available', 'No pricing in package', 'Professional packaging', 'Large inventory selection'].map((b) => (
              <li key={b} className="flex items-center gap-2 text-[0.7rem] text-ink-soft">
                <CheckCircle size={10} className="text-gold shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </InfoCard>
      </div>

      {/* FAQ */}
      <SectionHeader icon={HelpCircle} title="Frequently Asked Questions" />
      <div className="max-w-2xl">
        {FAQS.map((f) => (
          <AccordionItem key={f.q} question={f.q} answer={f.a} />
        ))}
      </div>

      {/* Delivery note */}
      <div className="mt-8 bg-white border border-cream-border rounded-2xl p-5 flex gap-4 items-start shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <Truck size={20} strokeWidth={1.5} className="text-gold shrink-0 mt-0.5" />
        <div>
          <h3 className="text-[0.62rem] tracking-[0.22em] uppercase font-black text-ink mb-2">
            Delivery Date Estimator
          </h3>
          <p className="text-[0.74rem] text-ink-soft leading-relaxed">
            Estimated delivery depends on product availability, shipping method, destination, and holiday or weather delays. Estimates are not guaranteed — for time-sensitive orders, please contact us in advance.
          </p>
        </div>
      </div>
    </div>
  );
}

function LearnPage() {
  return (
    <div>
      <SectionHeader
        icon={BookOpen}
        title="Learning Center"
        subtitle="Educating our customers about fine gems, jewelry, and quality."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          {
            icon: Star, title: 'Gemstone Guide',
            items: ['Diamonds & colored stones', 'Birthstones by month', 'Treatments & enhancements', 'Stone grading basics', 'Jewelry care tips'],
          },
          {
            icon: Award, title: 'Quality Score Chart',
            items: ['Clarity grades explained', 'Color grading (D–Z scale)', 'Cut & shape standards', 'Diamond & gem grading systems', 'What affects stone value'],
          },
          {
            icon: FileText, title: 'Certificates & Appraisal',
            items: ['Gemstone certificates available', 'Diamond grading reports', 'Insurance appraisal documents', 'Select products certified', 'Ask us for availability'],
          },
        ].map(({ icon, title, items }) => (
          <InfoCard key={title} icon={icon} title={title}>
            <ul className="space-y-1.5">
              {items.map((i) => (
                <li key={i} className="flex items-start gap-2 text-[0.72rem] text-ink-soft">
                  <span className="text-gold text-[0.4rem] mt-1.5 shrink-0">◆</span>
                  {i}
                </li>
              ))}
            </ul>
          </InfoCard>
        ))}
      </div>

      <SectionHeader icon={Search} title="Expert Advice & Product Resources" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <InfoCard icon={Users} title="Expert Advice">
          <p className="text-[0.74rem] text-ink-soft leading-relaxed mb-2">
            Our specialists assist with stone matching, custom jewelry projects, wholesale buying, and personalized gemstone recommendations.
          </p>
          <p className="text-[0.7rem] text-ink-muted">Ideal for jewelry designers and trade buyers.</p>
        </InfoCard>

        <InfoCard icon={FileText} title="E-Catalog">
          <p className="text-[0.74rem] text-ink-soft leading-relaxed mb-2">
            Browse our digital catalogs featuring new arrivals, featured collections, sale items, seasonal specials, and wholesale selections.
          </p>
          <p className="text-[0.7rem] text-ink-muted">Printed catalogs available on request.</p>
        </InfoCard>

        <InfoCard icon={Search} title="Find Products">
          <p className="text-[0.72rem] text-ink-soft mb-3">Search our full inventory by:</p>
          <div className="flex flex-wrap gap-1.5">
            {['Gem Type', 'Shape', 'Size', 'Color', 'Price', 'SKU / Item #'].map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full border border-cream-input text-[0.63rem] font-semibold text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        </InfoCard>
      </div>

      {/* Volume Discount CTA */}
      <div className="rounded-2xl p-6 flex flex-wrap gap-5 items-center justify-between bg-ink-dark">
        <div>
          <p className="text-[0.58rem] tracking-[0.28em] uppercase font-bold text-gold mb-1">
            Volume Discount Program
          </p>
          <h3 className="font-serif text-xl font-bold text-cream-warm mb-1.5">
            Special Pricing for Trade Buyers
          </h3>
          <p className="text-[0.73rem] text-ink-faint">
            Bulk orders · Jewelry manufacturers · Retail stores · Wholesale buyers
          </p>
        </div>
        <button className="px-5 py-2.5 rounded-xl bg-gold text-[0.68rem] font-black tracking-wider uppercase text-ink transition-opacity hover:opacity-90 active:scale-95 whitespace-nowrap">
          Contact for Pricing
        </button>
      </div>
    </div>
  );
}

function ContactPage() {
  return (
    <div>
      <SectionHeader
        icon={Phone}
        title="Customer Service Center"
        subtitle="Reach our team Monday – Friday, 10:00 AM – 6:00 PM EST."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <InfoCard icon={MapPin} title="Our Location">
          <p className="text-[0.82rem] font-semibold text-ink-dark mb-0.5">Alpha Gemstone NY Inc.</p>
          <p className="text-[0.74rem] text-ink-muted">Raleigh, North Carolina, USA</p>
        </InfoCard>

        <InfoCard icon={Mail} title="Email Us">
          <div className="space-y-3">
            {[
              { label: 'General', email: 'balkhatod@gmail.com' },
              { label: 'Orders',  email: 'orders@alphaimports.com' },
            ].map(({ label, email }) => (
              <div key={label}>
                <p className="text-[0.56rem] tracking-[0.2em] uppercase text-gold font-bold mb-0.5">{label}</p>
                <a
                  href={`mailto:${email}`}
                  className="text-[0.74rem] font-semibold text-ink-dark hover:text-gold transition-colors"
                >
                  {email}
                </a>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard icon={HelpCircle} title="Support Hours">
          <p className="text-[0.82rem] font-semibold text-ink-dark mb-0.5">Monday – Friday</p>
          <p className="text-[0.74rem] text-ink-muted mb-3">10:00 AM – 6:00 PM EST</p>
          <a
            href="https://www.alphaimports.com"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-3 py-1.5 rounded-full bg-gold-faint border border-gold-muted text-[0.64rem] font-bold text-gold hover:bg-gold hover:text-ink transition-all"
          >
            alphaimports.com
          </a>
        </InfoCard>
      </div>

      {/* Alpha Club */}
      <SectionHeader
        icon={Star}
        title="Join the Alpha Club"
        subtitle="Exclusive member benefits for our most valued customers."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <BenefitCard icon={Tag}  title="Special Pricing" desc="Members-only deals on fine gems and jewelry" />
        <BenefitCard icon={Gift} title="VIP Offers"       desc="Exclusive promotions not available to the public" />
        <BenefitCard icon={Star} title="Early Access"     desc="Be first to shop new arrivals and sales" />
        <BenefitCard icon={Gem}  title="New Alerts"       desc="Notifications for rare gems as they arrive" />
      </div>

      {/* Newsletter */}
      <div className="bg-white border border-cream-border rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        <p className="text-[0.56rem] tracking-[0.28em] uppercase font-black text-gold mb-1.5">
          Alpha Club &amp; Newsletter
        </p>
        <h3 className="font-serif text-[1.4rem] font-bold text-ink mb-1.5">
          Stay Ahead of the Gem Market
        </h3>
        <p className="text-[0.74rem] text-ink-muted mb-5">
          Jewelry trends · Birthstone specials · Colored diamond promotions · New arrivals · Educational articles
        </p>
        <div className="flex gap-2 max-w-md">
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 px-3.5 py-3 rounded-xl border-[1.5px] border-cream-input bg-cream text-[0.74rem] text-ink-dark outline-none
                       focus:border-gold transition-colors placeholder:text-ink-ghost"
          />
          <button className="px-5 py-3 rounded-xl bg-ink-dark text-cream-warm text-[0.68rem] font-black tracking-widest uppercase
                             hover:opacity-90 active:scale-95 transition-all whitespace-nowrap">
            Join Free
          </button>
        </div>
        <p className="text-[0.62rem] text-ink-ghost mt-2.5">
          Includes Alpha Bargains — exclusive discounts, new gems, holiday sales &amp; special promotions.
        </p>
      </div>
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────

const PAGE_MAP: Record<string, React.FC> = {
  legal:   LegalPage,
  help:    HelpPage,
  learn:   LearnPage,
  contact: ContactPage,
};

export default function InfoPage() {
  const [active, setActive] = useState<string>('legal');
  const ActivePage = PAGE_MAP[active];

  return (
    <div className="min-h-screen font-sans bg-cream bg-grid-gold bg-grid">

      {/* ── Page Header ── */}
      <header className="relative bg-gradient-to-b from-ink-dark to-ink overflow-hidden text-center px-8 pt-12 pb-10">
        {/* watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[220px] text-gold opacity-[0.03] leading-none font-serif">◆</span>
        </div>
        {/* brand mark */}
        <div className="relative flex items-center justify-center gap-2.5 mb-4">
          <Gem size={16} strokeWidth={1.5} className="text-gold" />
          <span className="font-serif text-xl tracking-wide text-cream-warm font-semibold">
            Alpha Gemstone
          </span>
        </div>
        <h1 className="relative font-serif text-[clamp(1.8rem,4vw,2.6rem)] font-bold text-cream-warm tracking-tight mb-2">
          Customer Information
        </h1>
        <p className="relative text-[0.78rem] text-ink-faint">
          Policies, help, learning resources &amp; contact details — all in one place
        </p>
      </header>

      {/* ── Tab Bar ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-cream-border shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 px-5 py-4 whitespace-nowrap border-b-[2.5px] transition-all duration-150 text-[0.72rem] font-medium tracking-wide
                  ${isActive
                    ? 'border-gold text-ink font-bold'
                    : 'border-transparent text-ink-muted hover:text-ink-dark hover:border-gold/30'
                  }`}
              >
                <Icon
                  size={13}
                  strokeWidth={2}
                  className={isActive ? 'text-gold' : 'text-ink-faint'}
                />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-6 py-10 pb-20">
        <ActivePage />
      </main>

      {/* ── Footer Strip ── */}
      <footer className="bg-ink-dark py-5 text-center">
        <p className="text-[0.62rem] text-ink-soft">
          © {new Date().getFullYear()} Alpha Gemstone NY Inc. All Rights Reserved. ·{' '}
          <a href="https://www.alphaimports.com" className="hover:text-gold transition-colors">
            alphaimports.com
          </a>
        </p>
      </footer>

    </div>
  );
}