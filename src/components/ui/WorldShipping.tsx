// src/components/ui/WorldShipping.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, ShieldCheck, PackageCheck, Globe as GlobeIcon } from "lucide-react";
import type { GlobeMethods } from "react-globe.gl";

/**
 * ── Palette (pure white theme) ──
 * page     #FFFFFF   page + card background (no ivory tint)
 * ink      #15181C   headline text
 * ash      #6B6459   body text
 * line     #ECE8DD   hairline borders / dividers
 * brass    #A9814A   accent — icons, numerals, stat labels
 *
 * ── Continent route colors (jewel-tone, matches gemstone branding) ──
 * europe   #C9973A   deep topaz gold
 * africa   #B23A32   ruby
 * asia     #2E8F63   emerald
 */

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const TEXTURES = {
  globe: "/textures/earth-blue-marble.jpg",
  bump: "/textures/earth-topology.png",
};

const HUB = { lat: 40.71, lng: -74.0, name: "New York" };

const CONTINENT_COLOR: Record<"europe" | "africa" | "asia", string> = {
  europe: "#C9973A",
  africa: "#B23A32",
  asia: "#2E8F63",
};

type Continent = keyof typeof CONTINENT_COLOR;

// [name, lat, lng]
const EUROPE: [string, number, number][] = [
  ["France", 48.8566, 2.3522], ["Germany", 52.52, 13.405], ["Italy", 41.9028, 12.4964],
  ["Spain", 40.4168, -3.7038], ["United Kingdom", 51.5074, -0.1278], ["Poland", 52.2297, 21.0122],
  ["Romania", 44.4268, 26.1025], ["Netherlands", 52.3676, 4.9041], ["Belgium", 50.8503, 4.3517],
  ["Greece", 37.9838, 23.7275], ["Czech Republic", 50.0755, 14.4378], ["Portugal", 38.7223, -9.1393],
  ["Sweden", 59.3293, 18.0686], ["Hungary", 47.4979, 19.0402], ["Austria", 48.2082, 16.3738],
  ["Switzerland", 46.948, 7.4474], ["Bulgaria", 42.6977, 23.3219], ["Denmark", 55.6761, 12.5683],
  ["Finland", 60.1699, 24.9384], ["Slovakia", 48.1486, 17.1077], ["Norway", 59.9139, 10.7522],
  ["Ireland", 53.3498, -6.2603], ["Croatia", 45.815, 15.9819], ["Bosnia & Herzegovina", 43.8563, 18.4131],
  ["Albania", 41.3275, 19.8187], ["Lithuania", 54.6872, 25.2797], ["Slovenia", 46.0569, 14.5058],
  ["Latvia", 56.9496, 24.1052], ["Estonia", 59.437, 24.7536], ["North Macedonia", 41.9973, 21.428],
  ["Moldova", 47.0105, 28.8638], ["Iceland", 64.1466, -21.9426], ["Montenegro", 42.4304, 19.2594],
  ["Luxembourg", 49.6116, 6.1319], ["Malta", 35.8989, 14.5146], ["Cyprus", 35.1856, 33.3823],
  ["Andorra", 42.5063, 1.5218], ["Monaco", 43.7384, 7.4246], ["San Marino", 43.9424, 12.4578],
  ["Liechtenstein", 47.141, 9.5215], ["Vatican City", 41.9029, 12.4534], ["Serbia", 44.7866, 20.4489],
  ["Ukraine", 50.4501, 30.5234], ["Belarus", 53.9006, 27.559], ["Russia", 55.7558, 37.6173],
  ["Turkey", 39.9334, 32.8597], ["Georgia", 41.7151, 44.8271], ["Armenia", 40.1792, 44.4991],
  ["Azerbaijan", 40.4093, 49.8671], ["Kosovo", 42.6629, 21.1655],
];

const AFRICA: [string, number, number][] = [
  ["Nigeria", 9.0765, 7.3986], ["Egypt", 30.0444, 31.2357], ["South Africa", -25.7479, 28.2293],
  ["Kenya", -1.2921, 36.8219], ["Morocco", 34.0209, -6.8416], ["Ethiopia", 9.025, 38.7469],
  ["Ghana", 5.6037, -0.187], ["Tanzania", -6.163, 35.7516], ["Algeria", 36.7538, 3.0588],
  ["Tunisia", 36.8065, 10.1815], ["Senegal", 14.7167, -17.4677], ["Uganda", 0.3476, 32.5825],
  ["Cameroon", 3.848, 11.5021], ["Ivory Coast", 6.8276, -5.2893], ["Zambia", -15.3875, 28.3228],
  ["Zimbabwe", -17.8252, 31.0335], ["Rwanda", -1.9403, 30.0586], ["Namibia", -22.5594, 17.0832],
  ["Botswana", -24.6282, 25.9231], ["Mozambique", -25.9692, 32.5732],
];

const ASIA: [string, number, number][] = [
  ["China", 39.9042, 116.4074], ["India", 28.6139, 77.209], ["Japan", 35.6762, 139.6503],
  ["South Korea", 37.5665, 126.978], ["Indonesia", -6.2088, 106.8456], ["Thailand", 13.7563, 100.5018],
  ["Vietnam", 21.0285, 105.8542], ["Philippines", 14.5995, 120.9842], ["Malaysia", 3.139, 101.6869],
  ["Singapore", 1.3521, 103.8198], ["Pakistan", 33.6844, 73.0479], ["Bangladesh", 23.8103, 90.4125],
  ["Sri Lanka", 6.9271, 79.8612], ["Nepal", 27.7172, 85.324], ["Myanmar", 19.7633, 96.0785],
  ["Cambodia", 11.5564, 104.9282], ["Laos", 17.9757, 102.6331], ["Mongolia", 47.8864, 106.9057],
  ["Kazakhstan", 51.1694, 71.4491], ["Uzbekistan", 41.2995, 69.2401], ["Saudi Arabia", 24.7136, 46.6753],
  ["United Arab Emirates", 24.4539, 54.3773], ["Qatar", 25.2854, 51.531], ["Israel", 31.7683, 35.2137],
  ["Jordan", 31.9454, 35.9284], ["Lebanon", 33.8938, 35.5018], ["Iraq", 33.3152, 44.3661],
  ["Iran", 35.6892, 51.389], ["Kuwait", 29.3759, 47.9774], ["Taiwan", 25.033, 121.5654],
];

function buildRoutesAndPoints() {
  const groups: [Continent, [string, number, number][]][] = [
    ["europe", EUROPE],
    ["africa", AFRICA],
    ["asia", ASIA],
  ];

  const routes: any[] = [];
  const points: any[] = [
    { lat: HUB.lat, lng: HUB.lng, name: HUB.name, size: 1.6, isHub: true, continent: null },
  ];

  groups.forEach(([continent, countries]) => {
    countries.forEach(([name, lat, lng], i) => {
      routes.push({
        startLat: HUB.lat,
        startLng: HUB.lng,
        endLat: lat,
        endLng: lng,
        name: `New York → ${name}`,
        continent,
        order: i,
      });
      points.push({ lat, lng, name, size: 0.55, isHub: false, continent });
    });
  });

  return { routes, points };
}

const { routes: ROUTES, points: POINTS } = buildRoutesAndPoints();
const RINGS = POINTS.filter((p) => !p.isHub);

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function GlobeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ringColorFn = useMemo(
    () => (d: any) => {
      const base = CONTINENT_COLOR[d.continent as Continent] ?? "#C9973A";
      const [r, g, b] = hexToRgb(base);
      return (t: number) => `rgba(${r},${g},${b},${1 - t})`;
    },
    []
  );

  return (
    <div ref={containerRef} className="h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef as any}
          width={size.width}
          height={size.height}
          backgroundColor="#FFFFFF"
          globeImageUrl={TEXTURES.globe}
          bumpImageUrl={TEXTURES.bump}
          showGraticules={false}
          showAtmosphere={true}
          atmosphereColor="#D8C08A"
          atmosphereAltitude={0.16}
          arcsData={ROUTES}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcLabel={(d: any) => d.name}
          arcColor={(d: any) => {
            const c = CONTINENT_COLOR[d.continent as Continent] ?? "#C9973A";
            return [c, c];
          }}
          arcAltitude={0.32}
          arcAltitudeAutoScale={0.45}
          arcCurveResolution={48}
          arcDashLength={0.4}
          arcDashGap={2.2}
          arcDashInitialGap={(d: any) => d.order * 0.6}
          arcDashAnimateTime={3200}
          arcsTransitionDuration={800}
          pointsData={POINTS}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: any) => (d.isHub ? "#15181C" : CONTINENT_COLOR[d.continent as Continent] ?? "#C9973A")}
          pointAltitude={0.01}
          pointRadius={(d: any) => d.size * 0.32}
          pointLabel={(d: any) => d.name}
          ringsData={RINGS}
          ringLat="lat"
          ringLng="lng"
          ringColor={ringColorFn}
          ringMaxRadius={2.4}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={3200}
          onGlobeReady={() => {
            const controls = globeRef.current?.controls();
            if (controls) {
              controls.autoRotate = true;
              controls.autoRotateSpeed = 0.5;
              controls.enableZoom = true;
              controls.enablePan = false;
              controls.minDistance = 120;
              controls.maxDistance = 420;
            }
            // Closer altitude = larger globe on load; scrolling out (zoom)
            // lets the user shrink it back down via minDistance/maxDistance above.
            globeRef.current?.pointOfView({ lat: 28, lng: -20, altitude: 1.85 }, 0);
          }}
        />
      )}
    </div>
  );
}

const STATS = [
  { value: "50", label: "European Countries" },
  { value: "20", label: "African Countries" },
  { value: "30", label: "Asian Countries" },
];

const FEATURES = [
  { icon: Plane, title: "Global Shipping", copy: "Fast, tracked delivery from our New York hub to 100 countries." },
  { icon: ShieldCheck, title: "Certified Authenticity", copy: "Every gemstone ships with verified certification papers." },
  { icon: PackageCheck, title: "Insured Packaging", copy: "Fully insured, discreet packaging for high-value items." },
];

const LEGEND = [
  { label: "Europe", color: CONTINENT_COLOR.europe },
  { label: "Africa", color: CONTINENT_COLOR.africa },
  { label: "Asia", color: CONTINENT_COLOR.asia },
];

export default function WorldShipping() {
  return (
    <section
      className="relative overflow-hidden bg-white py-8 lg:flex lg:h-screen lg:items-center lg:py-6"
      style={{ fontFamily: '"Google Sans Flex", sans-serif' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap');
      `}</style>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-6 lg:grid-cols-2 lg:gap-14">
        {/* LEFT CONTENT — editorial, professional layout */}
        <div>
          <div className="mb-3 flex items-center gap-3 lg:mb-4">
            <span className="h-px w-8 bg-[#A9814A]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#A9814A] lg:text-xs">
              Worldwide Delivery
            </span>
          </div>

          <h2
            className="max-w-xl text-[1.65rem] leading-[1.15] text-[#15181C] sm:text-[2.1rem] lg:text-[2.5rem]"
            style={{ fontVariationSettings: "'wght' 560" }}
          >
            Delivering authentic gemstones across the world
          </h2>

          <p className="mt-3 max-w-md text-sm leading-6 text-[#6B6459] lg:mt-4 lg:text-[15px] lg:leading-7">
            From rare gemstones to certified jewelry, we ship our collections
            securely to customers across three continents, with trusted
            international logistics partners handling every leg of the
            journey.
          </p>

          {/* Stat bar */}
          <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#ECE8DD] py-4 lg:mt-6 lg:gap-6 lg:py-5">
            {STATS.map((s) => (
              <div key={s.label}>
                <div
                  className="text-xl text-[#15181C] sm:text-2xl lg:text-3xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  {s.value}
                </div>
                <div className="mt-0.5 text-[10px] uppercase leading-tight tracking-wide text-[#6B6459] lg:text-[11px]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Numbered feature list — cleaner than a card grid */}
          <div>
            {FEATURES.map(({ icon: Icon, title, copy }, i) => (
              <div
                key={title}
                className="flex items-start gap-4 border-b border-[#ECE8DD] py-3 last:border-0 lg:gap-5 lg:py-4"
              >
                <span
                  className="pt-0.5 text-xs text-[#A9814A] lg:text-sm"
                  style={{ fontVariationSettings: "'wght' 500" }}
                >
                  0{i + 1}
                </span>
                <Icon className="mt-0.5 shrink-0 text-[#A9814A]" size={18} strokeWidth={1.6} />
                <div>
                  <h3
                    className="text-sm text-[#15181C] lg:text-[15px]"
                    style={{ fontVariationSettings: "'wght' 560" }}
                  >
                    {title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-5 text-[#6B6459] lg:text-sm lg:leading-6">
                    {copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: GLOBE — height-constrained so it never pushes the page past one viewport */}
        <div className="relative">
          <div className="relative mx-auto h-[38vh] w-full max-w-[420px] overflow-hidden rounded-[32px] bg-white sm:h-[46vh] sm:max-w-[460px] lg:h-[58vh] lg:max-w-none">
            <GlobeCanvas />
          </div>

          {/* Route legend — colored dots matching each continent's arc color */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 lg:mt-4 lg:gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#15181C] px-3 py-1 text-[11px] font-medium text-white lg:px-4 lg:py-1.5 lg:text-xs">
              <GlobeIcon size={11} />
              Shipping from New York
            </span>
            {LEGEND.map(({ label, color }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ECE8DD] px-3 py-1 text-[11px] font-medium text-[#6B6459] lg:px-4 lg:py-1.5 lg:text-xs"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full lg:h-2 lg:w-2"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}