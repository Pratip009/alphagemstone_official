import Navbar from "../ui/Navbar";
import Footer from "../ui/Footer";

type Props = {
  title: string;
  children: React.ReactNode;
};

export default function FooterPageLayout({
  title,
  children,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 w-full">

        {/* Hero/Header */}
        <section className="relative overflow-hidden border-b border-[#e8e2d9]">

          {/* Background Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#c9a84c10,transparent_40%)] pointer-events-none" />

          {/* Decorative Grid */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#c9a84c08 1px, transparent 1px), linear-gradient(90deg, #c9a84c08 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">

            <p className="uppercase tracking-[0.35em] text-[11px] font-bold text-[#c9a84c] mb-5">
              Alpha Gemstone NY Inc.
            </p>

            <h1 className="font-serif text-4xl md:text-6xl text-[#1a1714] leading-tight mb-6">
              {title}
            </h1>

            <div className="w-28 h-[2px] bg-[#c9a84c]" />
          </div>
        </section>

        {/* Content */}
        <section className="w-full">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-14 lg:py-20">

           

              <div className="space-y-8 text-[15px] md:text-[16px] leading-8 text-[#4d463f]">
                {children}
              </div>

          
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}