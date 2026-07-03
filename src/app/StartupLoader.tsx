'use client';

import { useEffect, useRef, useState } from 'react';

export default function StartupLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // ── Three.js diamond ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let animId: number;
    let renderer: any, scene: any, camera: any, gem: any, envGroup: any;

    async function init() {
      const THREE = await import('three');

      if (cancelled || !canvasRef.current) return;

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(320, 320);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;
      canvasRef.current.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0.6, 3.8);
      camera.lookAt(0, 0, 0);

      // ── Lighting ──────────────────────────────────────────────────────────
      // Warm key light (gold)
      const key = new THREE.DirectionalLight('#ffe4a0', 3.5);
      key.position.set(2, 3, 2);
      key.castShadow = true;
      scene.add(key);

      // Cool fill (sky blue)
      const fill = new THREE.DirectionalLight('#c8e8ff', 1.8);
      fill.position.set(-2.5, 1.5, 1);
      scene.add(fill);

      // Rim (warm)
      const rim = new THREE.DirectionalLight('#ffd080', 2.0);
      rim.position.set(0, -2, -2.5);
      scene.add(rim);

      // Top sparkle
      const top = new THREE.DirectionalLight('#ffffff', 1.2);
      top.position.set(0, 5, 0);
      scene.add(top);

      // Ambient
      scene.add(new THREE.AmbientLight('#f0e8d8', 0.6));

      // ── Diamond Geometry ──────────────────────────────────────────────────
      // Build a proper brilliant-cut diamond with crown + pavilion
      const verts: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];

      const SEGS = 16; // facet count
      const crown_r = 1.0;
      const table_r = 0.55;
      const gir_r = 1.0;
      const crown_h = 0.38;
      const gir_y = 0;
      const table_y = crown_h;
      const culet_y = -1.12;

      // Helper: add triangle with auto normal
      function addTri(
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
      ) {
        const base = verts.length / 3;
        verts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        indices.push(base, base + 1, base + 2);
        // flat normal
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        normals.push(nx / len, ny / len, nz / len);
        normals.push(nx / len, ny / len, nz / len);
        normals.push(nx / len, ny / len, nz / len);
      }

      for (let i = 0; i < SEGS; i++) {
        const a0 = (i / SEGS) * Math.PI * 2;
        const a1 = ((i + 1) / SEGS) * Math.PI * 2;
        const g0x = Math.cos(a0) * gir_r, g0z = Math.sin(a0) * gir_r;
        const g1x = Math.cos(a1) * gir_r, g1z = Math.sin(a1) * gir_r;
        const t0x = Math.cos(a0) * table_r, t0z = Math.sin(a0) * table_r;
        const t1x = Math.cos(a1) * table_r, t1z = Math.sin(a1) * table_r;
        const c0x = Math.cos(a0) * crown_r, c0z = Math.sin(a0) * crown_r;
        const c1x = Math.cos(a1) * crown_r, c1z = Math.sin(a1) * crown_r;

        // Table (flat top) — fan from center
        addTri(0, table_y, 0, t0x, table_y, t0z, t1x, table_y, t1z);

        // Upper crown bezel (table → girdle edge)
        addTri(t0x, table_y, t0z, g0x, gir_y, g0z, t1x, table_y, t1z);
        addTri(t1x, table_y, t1z, g0x, gir_y, g0z, g1x, gir_y, g1z);

        // Lower crown star (girdle → outer crown)
        // Alternate between steeper and shallower to mimic star/bezel facets
        if (i % 2 === 0) {
          addTri(g0x, gir_y, g0z, c0x, gir_y * 0.5, c0z, g1x, gir_y, g1z);
        }

        // Pavilion main facets
        addTri(g0x, gir_y, g0z, 0, culet_y, 0, g1x, gir_y, g1z);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setIndex(indices);

      // ── Materials ─────────────────────────────────────────────────────────
      // Main glass-like diamond body
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f0f8ff'),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 0.92,
        thickness: 1.8,
        ior: 2.42,         // diamond IOR
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        envMapIntensity: 2.5,
      });

      // Subtle gold-tinted wireframe overlay for facet lines
      const wireMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#c9a84c'),
        wireframe: true,
        transparent: true,
        opacity: 0.10,
      });

      gem = new THREE.Group();
      gem.add(new THREE.Mesh(geo, mat));
      gem.add(new THREE.Mesh(geo, wireMat));
      scene.add(gem);

      // ── Floating sparkle particles ─────────────────────────────────────────
      envGroup = new THREE.Group();
      const sparkGeo = new THREE.BufferGeometry();
      const sparkCount = 28;
      const sparkPos = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 1.6 + Math.random() * 1.2;
        sparkPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        sparkPos[i * 3 + 1] = r * Math.cos(phi);
        sparkPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPos, 3));
      const sparkMat = new THREE.PointsMaterial({
        color: '#c9a84c',
        size: 0.045,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
      });
      envGroup.add(new THREE.Points(sparkGeo, sparkMat));
      scene.add(envGroup);

      // ── Thin gold ring orbit ───────────────────────────────────────────────
      const ringGeo = new THREE.TorusGeometry(1.55, 0.008, 6, 80);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#c9a84c',
        transparent: true,
        opacity: 0.35,
      });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.x = Math.PI / 2.8;
      scene.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(1.72, 0.005, 6, 80),
        new THREE.MeshBasicMaterial({ color: '#b8966e', transparent: true, opacity: 0.2 })
      );
      ring2.rotation.x = Math.PI / 2;
      ring2.rotation.y = Math.PI / 5;
      scene.add(ring2);

      // ── Animation loop ─────────────────────────────────────────────────────
      let t = 0;
      function animate() {
        if (cancelled) return;
        animId = requestAnimationFrame(animate);
        t += 0.008;

        // Slow elegant rotation
        gem.rotation.y = t * 0.55;
        gem.rotation.x = Math.sin(t * 0.3) * 0.18;
        gem.position.y = Math.sin(t * 0.6) * 0.08;

        // Counter-rotate particles slightly
        envGroup.rotation.y = -t * 0.12;
        envGroup.rotation.z = t * 0.07;

        // Rings
        ring1.rotation.z = t * 0.25;
        ring2.rotation.y = t * 0.18;

        renderer.render(scene, camera);
      }
      animate();
    }

    init();

    cleanupRef.current = () => {
      cancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (renderer) {
        renderer.dispose();
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
      }
    };

    return () => cleanupRef.current?.();
  }, []);

  // ── Data preload + progress ────────────────────────────────────────────────
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Josefin+Sans:wght@300;400&display=swap';
    document.head.appendChild(link);

    // Animate progress bar over the loading window
    let p = 0;
    const steps = [
      { target: 35, delay: 200 },
      { target: 62, delay: 900 },
      { target: 85, delay: 1800 },
      { target: 97, delay: 2600 },
      { target: 100, delay: 3200 },
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach(({ target, delay }) => {
      timers.push(setTimeout(() => { p = target; setProgress(target); }, delay));
    });

    const loadData = async () => {
      try {
        await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/products/popular'),
        ]);
        await new Promise((r) => setTimeout(r, 3000));
      } catch {}
      setFadeOut(true);
      setTimeout(() => {
        setLoading(false);
        cleanupRef.current?.();
      }, 800);
    };

    loadData();
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!loading) return <>{children}</>;

  return (
    <>
      <style>{`
        @keyframes sl-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sl-shimmer {
          0%   { background-position: -300% center; }
          100% { background-position:  300% center; }
        }
        @keyframes sl-pulse-ring {
          0%   { transform: scale(0.95); opacity: 0.5; }
          50%  { transform: scale(1.05); opacity: 1;   }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        @keyframes sl-dot-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        .sl-brand    { animation: sl-fade-in 1s ease 0.4s both; }
        .sl-divider  { animation: sl-fade-in 0.8s ease 0.7s both; }
        .sl-tagline  { animation: sl-fade-in 0.8s ease 1s both; }
        .sl-progress { animation: sl-fade-in 0.6s ease 1.2s both; }
        .sl-shimmer-bar {
          background: linear-gradient(90deg,
            transparent 0%,
            #c9a84c 30%,
            #f0d080 50%,
            #c9a84c 70%,
            transparent 100%);
          background-size: 300% 100%;
          animation: sl-shimmer 2s linear infinite;
        }
        .sl-dot-1 { animation: sl-dot-pulse 1.6s ease 0s infinite; }
        .sl-dot-2 { animation: sl-dot-pulse 1.6s ease 0.26s infinite; }
        .sl-dot-3 { animation: sl-dot-pulse 1.6s ease 0.52s infinite; }
        .sl-canvas-glow {
          animation: sl-pulse-ring 3.5s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #fdfcf8 0%, #f5f0e8 45%, #faf7f2 100%)',
          transition: 'opacity 0.75s ease',
          opacity: fadeOut ? 0 : 1,
          pointerEvents: fadeOut ? 'none' : 'all',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grain texture overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.018, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }} />

        {/* Corner hairlines */}
        {(['tl','tr','bl','br'] as const).map((p) => (
          <div key={p} style={{
            position: 'absolute',
            width: 28, height: 28,
            top:    p[0] === 't' ? 32 : undefined,
            bottom: p[0] === 'b' ? 32 : undefined,
            left:   p[1] === 'l' ? 32 : undefined,
            right:  p[1] === 'r' ? 32 : undefined,
            borderColor: 'rgba(180,145,80,0.28)',
            borderStyle: 'solid',
            borderWidth: [
              p[0]==='t'?'1px':'0',
              p[1]==='r'?'1px':'0',
              p[0]==='b'?'1px':'0',
              p[1]==='l'?'1px':'0',
            ].join(' '),
          }} />
        ))}

        {/* Ambient light bloom behind gem */}
        <div style={{
          position: 'absolute',
          width: 380, height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.10) 0%, rgba(184,150,110,0.05) 50%, transparent 75%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -54%)',
          pointerEvents: 'none',
        }} />

        {/* Three.js canvas container */}
        <div
          className="sl-canvas-glow"
          style={{
            position: 'relative',
            width: 320, height: 320,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: -12,
          }}
        >
          <div ref={canvasRef} style={{ borderRadius: '50%', overflow: 'hidden' }} />
        </div>

        {/* Brand name */}
        <div className="sl-brand" style={{ textAlign: 'center', marginBottom: 10 }}>
          <h1 style={{
            fontFamily: '"Google Sans Flex", sans-serif',
            fontWeight: 400,
            fontSize: 26,
            letterSpacing: '0.45em',
            textTransform: 'uppercase',
            color: '#1a1814',
            margin: 0,
            lineHeight: 1,
          }}>
            Alpha Imports
          </h1>
        </div>

        {/* Ornamental divider */}
        <div className="sl-divider" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: 240, marginBottom: 10,
        }}>
          <div style={{ flex: 1, height: '0.5px', background: 'linear-gradient(to right, transparent, rgba(180,145,80,0.5))' }} />
          <div style={{ width: 4, height: 4, background: '#c9a84c', transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: '0.5px', background: 'linear-gradient(to left, transparent, rgba(180,145,80,0.5))' }} />
        </div>

        {/* Tagline */}
        <p className="sl-tagline" style={{
          fontFamily: '"Google Sans Flex", sans-serif',
          fontWeight: 300,
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: '#9c9690',
          margin: '0 0 36px',
        }}>
          Fine Diamonds &amp; Gemstones
        </p>

        {/* Progress bar */}
        <div className="sl-progress" style={{ width: 180, textAlign: 'center' }}>
          <div style={{
            width: '100%', height: '1px',
            background: 'rgba(180,145,80,0.12)',
            borderRadius: 1,
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            <div
              className="sl-shimmer-bar"
              style={{
                height: '100%',
                width: `${progress}%`,
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: 1,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
            {['sl-dot-1', 'sl-dot-2', 'sl-dot-3'].map((cls) => (
              <div
                key={cls}
                className={cls}
                style={{
                  width: 3, height: 3, borderRadius: '50%',
                  background: '#c9a84c',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}