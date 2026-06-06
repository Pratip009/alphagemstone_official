import Link from "next/link";

const ROUTES = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Products", href: "/products" },
  { label: "Diamonds", href: "/products/diamonds" },
  { label: "Watches", href: "/products/watches" },
  { label: "Cart", href: "/cart" },
  { label: "Checkout", href: "/checkout" },

  // Footer Pages
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Return Policy", href: "/return-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Help Center", href: "/help-center" },
  { label: "FAQ", href: "/faq" },
  { label: "Wish List", href: "/wishlist" },
  { label: "Find Products", href: "/find-products" },
  { label: "Learning Center", href: "/learning-center" },
  { label: "Expert Advice", href: "/expert-advice" },
  { label: "E-Catalog", href: "/e-catalog" },
  { label: "Certificates & Appraisal", href: "/certificates-appraisal" },
  { label: "Volume Discount", href: "/volume-discount" },
  { label: "Where Is My Order", href: "/where-is-my-order" },
];

export default function FooterSitemap() {
  return (
    <section className="border-t border-[#e8e2d9] py-14">
      <div className="max-w-7xl mx-auto px-6">

        <div className="mb-8">
          <p className="uppercase tracking-[0.25em] text-[11px] font-bold text-[#c9a84c] mb-3">
            Website Navigation
          </p>

          <h2 className="text-3xl font-serif text-[#1a1714]">
            Sitemap
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

          {ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="text-[14px] text-[#5c554d] hover:text-[#c9a84c] transition-colors"
            >
              {route.label}
            </Link>
          ))}

        </div>
      </div>
    </section>
  );
}