"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gem,
  UploadCloud,
  Layers,
  ShoppingBag,
  LayoutDashboard,
  ExternalLink,
  ChevronRight,
  HomeIcon,
  Users,
  BookOpen,
  ImagePlay,
  Mail,
  Tag,
  FileClock,
  UserCheck,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: HomeIcon, exact: true },
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/hero-slides", label: "Hero Slides", icon: ImagePlay },
  { href: "/admin/products", label: "Products", icon: Gem },
  { href: "/admin/upload", label: "Bulk Upload", icon: UploadCloud },
  { href: "/admin/categories", label: "Categories", icon: Layers },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/contacts", label: "Contacts", icon: Users },
  { href: "/admin/blogs", label: "Blog", icon: BookOpen },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/memos", label: "Memos", icon: FileClock },
  {
    href: "/admin/memo-eligibility",
    label: "Memo Applications",
    icon: UserCheck,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#f6f4f0]">
      {/* ── Sidebar ── */}
      <aside className="w-[220px] flex-shrink-0 bg-[#0f0e0c] flex flex-col sticky top-0 h-screen overflow-hidden">
        {/* Logo */}
        <div className="px-5 pt-7 pb-5 border-b border-white/[0.06]">
          <div className="font-['Cormorant_Garamond',serif] text-[1.3rem] font-semibold text-[#f0e8d0] tracking-wide leading-none">
            Alpha<span className="text-[#c9a84c]">Imports</span>
          </div>
          <span className="mt-2 inline-block font-mono text-[0.6rem] font-medium tracking-[0.18em] uppercase text-[#4a4540]">
            Admin Console
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname.startsWith(href) && href !== "/admin";

            return (
              <Link
                key={href}
                href={href}
                className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.81rem] font-medium transition-all duration-150
                  ${
                    active
                      ? "bg-[#c9a84c]/10 text-[#c9a84c]"
                      : "text-[#6b6560] hover:bg-white/5 hover:text-[#e8e0d0]"
                  }
                `}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] bg-[#c9a84c] rounded-r" />
                )}
                <Icon
                  size={15}
                  strokeWidth={1.6}
                  className={
                    active
                      ? "text-[#c9a84c]"
                      : "text-[#3a3530] group-hover:text-[#c9a84c]"
                  }
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <Link
            href="/"
            className="flex items-center gap-2 text-[0.73rem] font-medium text-[#4a4540] hover:text-[#c9a84c] transition-colors"
          >
            <ExternalLink size={13} strokeWidth={1.6} />
            View storefront
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[#ede9e1] flex items-center px-8 gap-2 sticky top-0 z-10">
          <Link
            href="/admin"
            className="text-[0.7rem] font-semibold tracking-[0.07em] uppercase text-[#b0a898] hover:text-[#8a6e2a] transition-colors"
          >
            Admin
          </Link>
          {pathname !== "/admin" && (
            <>
              <ChevronRight size={12} className="text-[#d4cfc6]" />
              <span className="text-[0.7rem] font-semibold tracking-[0.07em] uppercase text-[#1a1714]">
                {NAV.find(
                  (n) => pathname.startsWith(n.href) && n.href !== "/admin",
                )?.label ?? "Page"}
              </span>
            </>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
