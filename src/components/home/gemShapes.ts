/**
 * gemShapes.ts — SVG outlines for gemstone cuts, shared by the homepage
 * gem ruler and the finder's shape filter. Every outline is centred on
 * 0,0 with longest dimension L, so it can be drawn at any size.
 */

export type GemShape =
  | "round" | "oval" | "pear" | "marquise" | "heart" | "trillion" | "cushion"
  | "emerald" | "princess" | "square" | "octagon" | "baguette" | "cabochon"
  | "bullet" | "drop" | "briolette" | "kite" | "hexagon" | "triangle"
  | "bead" | "button" | "barrel" | "nugget";

const f = (n: number) => +n.toFixed(2);

function roundedRect(w: number, h: number, c: number): string {
  const hw = w / 2, hh = h / 2;
  return `M${f(-hw + c)},${f(-hh)}H${f(hw - c)}Q${f(hw)},${f(-hh)} ${f(hw)},${f(-hh + c)}V${f(hh - c)}Q${f(hw)},${f(hh)} ${f(hw - c)},${f(hh)}H${f(-hw + c)}Q${f(-hw)},${f(hh)} ${f(-hw)},${f(hh - c)}V${f(-hh + c)}Q${f(-hw)},${f(-hh)} ${f(-hw + c)},${f(-hh)}Z`;
}
function cutCornerRect(w: number, h: number, c: number): string {
  const hw = w / 2, hh = h / 2;
  return `M${f(-hw + c)},${f(-hh)}H${f(hw - c)}L${f(hw)},${f(-hh + c)}V${f(hh - c)}L${f(hw - c)},${f(hh)}H${f(-hw + c)}L${f(-hw)},${f(hh - c)}V${f(-hh + c)}Z`;
}
function ellipse(rx: number, ry: number): string {
  return `M${f(-rx)},0a${f(rx)},${f(ry)} 0 1,0 ${f(2 * rx)},0a${f(rx)},${f(ry)} 0 1,0 ${f(-2 * rx)},0Z`;
}

/** Outline path + bounding box for a cut. Unknown shapes draw as round. */
export function gemOutline(shape: string, L: number): { d: string; w: number; h: number } {
  const r = L / 2;
  switch (shape as GemShape) {
    case "oval":
      return { d: ellipse(L * 0.37, r), w: L * 0.74, h: L };
    case "cabochon":
      return { d: ellipse(L * 0.4, r), w: L * 0.8, h: L };
    case "pear":
    case "drop":
    case "briolette":
      return {
        d: `M0,${f(-r)}C${f(L * 0.42)},${f(-L * 0.08)} ${f(L * 0.4)},${f(r)} 0,${f(r)}C${f(-L * 0.4)},${f(r)} ${f(-L * 0.42)},${f(-L * 0.08)} 0,${f(-r)}Z`,
        w: L * 0.62, h: L,
      };
    case "marquise":
      return { d: `M0,${f(-r)}Q${f(L * 0.42)},0 0,${f(r)}Q${f(-L * 0.42)},0 0,${f(-r)}Z`, w: L * 0.42, h: L };
    case "heart": {
      const k = (n: number) => f(n * L);
      return {
        d: `M0,${k(0.42)}C${k(-0.12)},${k(0.33)} ${k(-0.5)},${k(0.1)} ${k(-0.5)},${k(-0.15)}C${k(-0.5)},${k(-0.37)} ${k(-0.32)},${k(-0.45)} ${k(-0.24)},${k(-0.45)}C${k(-0.1)},${k(-0.45)} 0,${k(-0.36)} 0,${k(-0.28)}C0,${k(-0.36)} ${k(0.1)},${k(-0.45)} ${k(0.24)},${k(-0.45)}C${k(0.32)},${k(-0.45)} ${k(0.5)},${k(-0.37)} ${k(0.5)},${k(-0.15)}C${k(0.5)},${k(0.1)} ${k(0.12)},${k(0.33)} 0,${k(0.42)}Z`,
        w: L, h: L * 0.87,
      };
    }
    case "trillion":
    case "triangle": {
      const h = L * 0.87;
      return { d: `M0,${f(-h / 2)}L${f(r)},${f(h / 2)}L${f(-r)},${f(h / 2)}Z`, w: L, h };
    }
    case "cushion":
    case "barrel": {
      const s = L * 0.92;
      return { d: roundedRect(s, s, s * 0.24), w: s, h: s };
    }
    case "emerald":
    case "octagon":
      return { d: cutCornerRect(L, L * 0.7, L * 0.14), w: L, h: L * 0.7 };
    case "baguette":
      return { d: `M${f(-r)},${f(-L * 0.18)}H${f(r)}V${f(L * 0.18)}H${f(-r)}Z`, w: L, h: L * 0.36 };
    case "princess":
    case "square": {
      const s = L * 0.78, hs = f(s / 2);
      return { d: `M${-hs},${-hs}H${hs}V${hs}H${-hs}Z`, w: s, h: s };
    }
    case "bullet":
      return {
        d: `M0,${f(-r)}L${f(L * 0.22)},${f(-L * 0.18)}V${f(r)}H${f(-L * 0.22)}V${f(-L * 0.18)}Z`,
        w: L * 0.44, h: L,
      };
    case "kite":
      return { d: `M0,${f(-r)}L${f(L * 0.32)},${f(-L * 0.12)}L0,${f(r)}L${f(-L * 0.32)},${f(-L * 0.12)}Z`, w: L * 0.64, h: L };
    case "hexagon": {
      const a = r, b = f(r * 0.866);
      return { d: `M${f(-a)},0L${f(-a / 2)},${-b}H${f(a / 2)}L${f(a)},0L${f(a / 2)},${b}H${f(-a / 2)}Z`, w: L, h: L * 0.866 };
    }
    case "nugget":
      return {
        d: `M${f(-L * 0.42)},${f(-L * 0.1)}C${f(-L * 0.4)},${f(-L * 0.42)} ${f(L * 0.2)},${f(-L * 0.5)} ${f(L * 0.4)},${f(-L * 0.2)}C${f(L * 0.55)},${f(L * 0.05)} ${f(L * 0.3)},${f(L * 0.45)} 0,${f(L * 0.42)}C${f(-L * 0.3)},${f(L * 0.4)} ${f(-L * 0.45)},${f(L * 0.2)} ${f(-L * 0.42)},${f(-L * 0.1)}Z`,
        w: L * 0.95, h: L * 0.9,
      };
    default: // round, bead, button, anything unknown
      return { d: ellipse(r, r), w: L, h: L };
  }
}