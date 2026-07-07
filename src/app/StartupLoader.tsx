'use client';

import { useEffect, useRef, useState } from 'react';

const GEM_PALETTE = [
  { name: 'ruby',      color: '#e0115f' },
  { name: 'emerald',   color: '#2ecc71' },
  { name: 'sapphire',  color: '#2e6fdb' },
  { name: 'amethyst',  color: '#9b59d0' },
  { name: 'citrine',   color: '#f0b90b' },
  { name: 'aqua',      color: '#3fd9c7' },
];

export default function StartupLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // ── Three.js diamond + colored gem satellites ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let animId: number;
    let renderer: any, scene: any, camera: any, gem: any, envGroup: any, satelliteGroup: any;

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
      const key = new THREE.DirectionalLight('#ffe4a0', 3.2);
      key.position.set(2, 3, 2);
      key.castShadow = true;
      scene.add(key);

      const fill = new THREE.DirectionalLight('#c8e8ff', 1.6);
      fill.position.set(-2.5, 1.5, 1);
      scene.add(fill);

      const rim = new THREE.DirectionalLight('#ffd080', 1.8);
      rim.position.set(0, -2, -2.5);
      scene.add(rim);

      const top = new THREE.DirectionalLight('#ffffff', 1.1);
      top.position.set(0, 5, 0);
      scene.add(top);

      // Colored accent lights — these are what throw ruby/emerald/sapphire
      // glints onto the clear diamond's facets as the satellites orbit,
      // instead of it just reading as plain glass.
      const accentLights = GEM_PALETTE.slice(0, 4).map((g, i) => {
        const l = new THREE.PointLight(g.color, 0.9, 4);
        const a = (i / 4) * Math.PI * 2;
        l.position.set(Math.cos(a) * 2, 0.4, Math.sin(a) * 2);
        scene.add(l);
        return l;
      });

      scene.add(new THREE.AmbientLight('#f0e8d8', 0.55));

      // ── Diamond Geometry (unchanged brilliant-cut construction) ────────────
      const verts: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];

      const SEGS = 16;
      const crown_r = 1.0;
      const table_r = 0.55;
      const gir_r = 1.0;
      const crown_h = 0.38;
      const gir_y = 0;
      const table_y = crown_h;
      const culet_y = -1.12;

      function addTri(
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
      ) {
        const base = verts.length / 3;
        verts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        indices.push(base, base + 1, base + 2);
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

        addTri(0, table_y, 0, t0x, table_y, t0z, t1x, table_y, t1z);
        addTri(t0x, table_y, t0z, g0x, gir_y, g0z, t1x, table_y, t1z);
        addTri(t1x, table_y, t1z, g0x, gir_y, g0z, g1x, gir_y, g1z);

        if (i % 2 === 0) {
          addTri(g0x, gir_y, g0z, c0x, gir_y * 0.5, c0z, g1x, gir_y, g1z);
        }

        addTri(g0x, gir_y, g0z, 0, culet_y, 0, g1x, gir_y, g1z);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setIndex(indices);

      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f0f8ff'),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 0.9,
        thickness: 1.8,
        ior: 2.42,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        envMapIntensity: 2.5,
      });

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

      // ── Colored gem satellites orbiting the main diamond ────────────────────
      satelliteGroup = new THREE.Group();
      const satMeshes: any[] = [];
      GEM_PALETTE.forEach((g, i) => {
        const size = 0.13 + (i % 3) * 0.02;
        const satGeo = new THREE.OctahedronGeometry(size, 0);
        const satMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(g.color),
          metalness: 0.0,
          roughness: 0.08,
          transmission: 0.75,
          thickness: 0.8,
          ior: 1.77,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          transparent: true,
          opacity: 0.95,
          envMapIntensity: 2.0,
        });
        const mesh = new THREE.Mesh(satGeo, satMat);
        const angle = (i / GEM_PALETTE.length) * Math.PI * 2;
        const radius = 1.9 + (i % 2) * 0.25;
        const height = Math.sin(i * 1.7) * 0.5;
        mesh.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        mesh.userData = { angle, radius, height, spinSpeed: 0.6 + Math.random() * 0.6 };
        satMeshes.push(mesh);
        satelliteGroup.add(mesh);
      });
      scene.add(satelliteGroup);

      // ── Colorful floating sparkle particles ─────────────────────────────────
      envGroup = new THREE.Group();
      const sparkGeo = new THREE.BufferGeometry();
      const sparkCount = 36;
      const sparkPos = new Float32Array(sparkCount * 3);
      const sparkColor = new Float32Array(sparkCount * 3);
      const tmpColor = new THREE.Color();
      for (let i = 0; i < sparkCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 1.6 + Math.random() * 1.3;
        sparkPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        sparkPos[i * 3 + 1] = r * Math.cos(phi);
        sparkPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        tmpColor.set(GEM_PALETTE[i % GEM_PALETTE.length].color);
        sparkColor[i * 3] = tmpColor.r;
        sparkColor[i * 3 + 1] = tmpColor.g;
        sparkColor[i * 3 + 2] = tmpColor.b;
      }
      sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPos, 3));
      sparkGeo.setAttribute('color', new THREE.Float32BufferAttribute(sparkColor, 3));
      const sparkMat = new THREE.PointsMaterial({
        size: 0.05,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        vertexColors: true,
      });
      envGroup.add(new THREE.Points(sparkGeo, sparkMat));
      scene.add(envGroup);

      // ── Thin gold ring orbit ───────────────────────────────────────────────
      const ringGeo = new THREE.TorusGeometry(1.55, 0.008, 6, 80);
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#c9a84c',
        transparent: true,
        opacity: 0.3,
      });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.x = Math.PI / 2.8;
      scene.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(1.72, 0.005, 6, 80),
        new THREE.MeshBasicMaterial({ color: '#b8966e', transparent: true, opacity: 0.18 })
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

        gem.rotation.y = t * 0.55;
        gem.rotation.x = Math.sin(t * 0.3) * 0.18;
        gem.position.y = Math.sin(t * 0.6) * 0.08;

        envGroup.rotation.y = -t * 0.12;
        envGroup.rotation.z = t * 0.07;

        ring1.rotation.z = t * 0.25;
        ring2.rotation.y = t * 0.18;

        // Orbit the colored satellites around the diamond, each spinning
        // on its own axis so their facets catch the light independently.
        satelliteGroup.rotation.y = t * 0.35;
        satMeshes.forEach((m) => {
          m.rotation.x += 0.01 * m.userData.spinSpeed;
          m.rotation.y += 0.014 * m.userData.spinSpeed;
          m.position.y = m.userData.height + Math.sin(t * 1.2 + m.userData.angle * 3) * 0.12;
        });

        // Slowly swing the accent point lights so the colored glints
        // drift across the diamond's facets instead of sitting static.
        accentLights.forEach((l, i) => {
          const a = t * 0.4 + (i / accentLights.length) * Math.PI * 2;
          l.position.set(Math.cos(a) * 2, 0.4 + Math.sin(a * 0.6) * 0.4, Math.sin(a) * 2);
        });

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
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
        @keyframes sl-blob-drift {
          0%   { transform: translate(-50%, -50%) scale(1);    }
          50%  { transform: translate(-46%, -54%) scale(1.08); }
          100% { transform: translate(-50%, -50%) scale(1);    }
        }
        .sl-brand    { animation: sl-fade-in 1s ease 0.4s both; }
        .sl-divider  { animation: sl-fade-in 0.8s ease 0.7s both; }
        .sl-tagline  { animation: sl-fade-in 0.8s ease 1s both; }
        .sl-progress { animation: sl-fade-in 0.6s ease 1.2s both; }
        .sl-shimmer-bar {
          background: linear-gradient(90deg,
            transparent 0%,
            #e0115f 16%,
            #f0b90b 34%,
            #2ecc71 52%,
            #2e6fdb 70%,
            #9b59d0 86%,
            transparent 100%);
          background-size: 300% 100%;
          animation: sl-shimmer 2.2s linear infinite;
        }
        .sl-dot-1 { animation: sl-dot-pulse 1.6s ease 0s infinite; }
        .sl-dot-2 { animation: sl-dot-pulse 1.6s ease 0.26s infinite; }
        .sl-dot-3 { animation: sl-dot-pulse 1.6s ease 0.52s infinite; }
        .sl-dot-4 { animation: sl-dot-pulse 1.6s ease 0.78s infinite; }
        .sl-canvas-glow {
          animation: sl-pulse-ring 3.5s ease-in-out infinite;
        }
        .sl-blob {
          animation: sl-blob-drift 7s ease-in-out infinite;
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
          background: '#ffffff',
          transition: 'opacity 0.75s ease',
          opacity: fadeOut ? 0 : 1,
          pointerEvents: fadeOut ? 'none' : 'all',
          overflow: 'hidden',
        }}
      >
        {/* Colorful bokeh glow blobs behind the gem — this is what carries
            the "colourful gems" feel onto the white background without
            tinting the whole page. */}
        {[
          { color: '#e0115f', top: '38%', left: '34%', size: 260, delay: '0s' },
          { color: '#2ecc71', top: '62%', left: '66%', size: 240, delay: '1.4s' },
          { color: '#2e6fdb', top: '30%', left: '68%', size: 220, delay: '2.8s' },
          { color: '#f0b90b', top: '68%', left: '32%', size: 200, delay: '4.2s' },
        ].map((b, i) => (
          <div
            key={i}
            className="sl-blob"
            style={{
              position: 'absolute',
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: b.color,
              opacity: 0.10,
              filter: 'blur(50px)',
              animationDelay: b.delay,
              pointerEvents: 'none',
            }}
          />
        ))}

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
            fontFamily: '"Elms Sans", sans-serif',
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

        {/* Ornamental divider — now four tiny gem-colored dots instead of
            a single gold diamond, echoing the palette used in the scene. */}
        <div className="sl-divider" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: 240, marginBottom: 10, justifyContent: 'center',
        }}>
          <div style={{ flex: 1, height: '0.5px', background: 'linear-gradient(to right, transparent, rgba(180,145,80,0.4))' }} />
          {['#e0115f', '#f0b90b', '#2ecc71', '#2e6fdb'].map((c, i) => (
            <div key={c} className={`sl-dot-${i + 1}`} style={{
              width: 4, height: 4, borderRadius: '50%', background: c,
            }} />
          ))}
          <div style={{ flex: 1, height: '0.5px', background: 'linear-gradient(to left, transparent, rgba(180,145,80,0.4))' }} />
        </div>

        {/* Tagline */}
        <p className="sl-tagline" style={{
          fontFamily: '"Elms Sans", sans-serif',
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
            width: '100%', height: '2px',
            background: 'rgba(20,20,20,0.06)',
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
        </div>
      </div>
    </>
  );
}