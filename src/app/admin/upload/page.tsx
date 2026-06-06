'use client';
import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

/* ── Inline styles ─────────────────────────────────────────────────────────── */
const css = `

  .bu-root { font-family: 'DM Sans', sans-serif; color: #0f172a; background: #f8f7f4; min-height: 100vh; padding: 2rem; }
  .bu-root * { box-sizing: border-box; }

  .bu-breadcrumb { font-size: 0.78rem; color: #94a3b8; font-weight: 500; text-decoration: none; letter-spacing: 0.06em; text-transform: uppercase; transition: color 0.15s; }
  .bu-breadcrumb:hover { color: #b45309; }

  .bu-header { margin-bottom: 2rem; }
  .bu-title { font-family: 'Playfair Display', serif; font-size: 2rem; color: #0f172a; letter-spacing: -0.02em; margin: 0.3rem 0 0.25rem; line-height: 1.1; }
  .bu-subtitle { font-size: 0.85rem; color: #64748b; }

  .bu-layout { display: grid; grid-template-columns: 1fr 360px; gap: 1.5rem; align-items: start; }
  @media (max-width: 900px) { .bu-layout { grid-template-columns: 1fr; } }

  .bu-card { background: #fff; border: 1px solid #e2e0da; border-radius: 14px; overflow: hidden; }
  .bu-card-head { padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f0ec; display: flex; align-items: center; gap: 0.6rem; }
  .bu-card-title { font-family: 'Playfair Display', serif; font-size: 1rem; color: #0f172a; margin: 0; }
  .bu-card-body { padding: 1.5rem; }

  .bu-dropzone { border: 2px dashed #d1cec7; border-radius: 12px; padding: 3rem 2rem; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafaf8; position: relative; }
  .bu-dropzone:hover, .bu-dropzone.drag { border-color: #b45309; background: #fef3c7; }
  .bu-dropzone.has-file { border-color: #16a34a; border-style: solid; background: #f0fdf4; cursor: default; }
  .bu-dropzone-icon { font-size: 2.5rem; margin-bottom: 0.75rem; display: block; }
  .bu-dropzone-title { font-size: 0.95rem; font-weight: 600; color: #0f172a; margin-bottom: 0.25rem; }
  .bu-dropzone-sub { font-size: 0.8rem; color: #94a3b8; }
  .bu-file-info { display: flex; align-items: center; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  .bu-file-name { font-family: 'DM Mono', monospace; font-size: 0.82rem; color: #15803d; font-weight: 500; }
  .bu-file-size { font-size: 0.75rem; color: #64748b; }
  .bu-file-change { font-size: 0.72rem; color: #b45309; text-decoration: underline; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; padding: 0; }

  .bu-progress-wrap { margin-top: 1.25rem; }
  .bu-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; color: #475569; margin-bottom: 0.4rem; font-weight: 500; }
  .bu-progress-bar { height: 6px; background: #f1f0ec; border-radius: 99px; overflow: hidden; }
  .bu-progress-fill { height: 100%; background: linear-gradient(90deg, #b45309, #d97706); border-radius: 99px; transition: width 0.4s ease; }

  .bu-steps { display: flex; gap: 0; margin-bottom: 1.5rem; }
  .bu-step { flex: 1; padding: 0.6rem 0.75rem; text-align: center; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8; border-bottom: 2px solid #e2e0da; transition: all 0.2s; }
  .bu-step.active { color: #b45309; border-bottom-color: #b45309; }
  .bu-step.done { color: #15803d; border-bottom-color: #16a34a; }

  .bu-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; height: 48px; background: #0f172a; color: #fff; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; letter-spacing: 0.02em; margin-top: 1.25rem; }
  .bu-btn:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
  .bu-btn:active { transform: scale(0.98); }
  .bu-btn:disabled { background: #94a3b8; cursor: not-allowed; transform: none; }
  .bu-btn.amber { background: #b45309; }
  .bu-btn.amber:hover:not(:disabled) { background: #92400e; }
  .bu-btn-outline { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; background: transparent; color: #475569; border: 1.5px solid #d1cec7; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .bu-btn-outline:hover { border-color: #b45309; color: #b45309; background: #fef3c7; }

  .bu-result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; }
  .bu-result-stat { border-radius: 10px; padding: 1.1rem; text-align: center; }
  .bu-result-stat.success { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .bu-result-stat.fail { background: #fef2f2; border: 1px solid #fecaca; }
  .bu-result-num { font-family: 'Playfair Display', serif; font-size: 2.25rem; font-weight: 600; line-height: 1; }
  .bu-result-num.green { color: #15803d; }
  .bu-result-num.red { color: #dc2626; }
  .bu-result-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 0.3rem; color: #475569; }

  .bu-error-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #475569; margin-bottom: 0.6rem; }
  .bu-error-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; }
  .bu-error-item { display: flex; gap: 0.6rem; align-items: baseline; background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; padding: 0.5rem 0.75rem; }
  .bu-error-row { font-family: 'DM Mono', monospace; font-size: 0.68rem; color: #b91c1c; font-weight: 500; white-space: nowrap; }
  .bu-error-msg { font-size: 0.75rem; color: #dc2626; line-height: 1.4; }

  .bu-schema-section { margin-bottom: 0.75rem; }
  .bu-schema-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 0.5rem; }
  .bu-schema-fields { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .bu-field-tag { font-family: 'DM Mono', monospace; font-size: 0.7rem; padding: 3px 8px; border-radius: 5px; }
  .bu-field-tag.required { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
  .bu-field-tag.optional { background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b; }

  .bu-hint { background: #fafaf8; border: 1px solid #e2e0da; border-radius: 10px; padding: 1rem 1.1rem; font-size: 0.78rem; color: #475569; line-height: 1.7; }
  .bu-hint strong { color: #0f172a; font-weight: 600; }
  .bu-hint code { font-family: 'DM Mono', monospace; background: #f1f0ec; padding: 1px 5px; border-radius: 4px; font-size: 0.72rem; color: #b45309; }

  .bu-download-bar { display: flex; align-items: center; justify-content: space-between; background: #f8f7f4; border: 1px solid #e2e0da; border-radius: 10px; padding: 0.875rem 1.1rem; margin-bottom: 1.25rem; }
  .bu-download-text { font-size: 0.82rem; color: #475569; }
  .bu-download-text strong { color: #0f172a; }

  .bu-error-alert { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.84rem; color: #dc2626; font-weight: 500; margin-top: 1rem; }

  @keyframes bu-spin { to { transform: rotate(360deg); } }
  .bu-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: bu-spin 0.7s linear infinite; }

  .bu-success-banner { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 12px; padding: 1.25rem 1.5rem; text-align: center; margin-bottom: 1.25rem; }
  .bu-success-icon { font-size: 2rem; margin-bottom: 0.4rem; }
  .bu-success-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #15803d; margin-bottom: 0.25rem; }
  .bu-success-sub { font-size: 0.8rem; color: #16a34a; }

  .bu-reset { display: block; width: 100%; margin-top: 0.75rem; padding: 0.6rem; background: none; border: 1.5px solid #d1cec7; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s; }
  .bu-reset:hover { border-color: #b45309; color: #b45309; }

  .bu-error-list::-webkit-scrollbar { width: 4px; }
  .bu-error-list::-webkit-scrollbar-track { background: transparent; }
  .bu-error-list::-webkit-scrollbar-thumb { background: #fecaca; border-radius: 99px; }
`;

interface UploadResult {
  inserted: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

type Step = 'select' | 'uploading' | 'done' | 'error';

const REQUIRED_FIELDS = ['name', 'category', 'price', 'shape', 'size', 'color', 'clarity', 'images'];
const OPTIONAL_FIELDS = ['subcategory', 'certification', 'stock', 'description'];

function stepClass(current: Step, forStep: 'select' | 'uploading' | 'done'): string {
  const order: Step[] = ['select', 'uploading', 'done'];
  const currentIdx = order.indexOf(current === 'error' ? 'uploading' : current);
  const forIdx = order.indexOf(forStep);
  if (currentIdx === forIdx) return 'bu-step active';
  if (currentIdx > forIdx) return 'bu-step done';
  return 'bu-step';
}

export default function AdminUploadPage() {
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    setStep('select');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setResult(null);
    setStep('uploading');
    setProgress(10);

    const formData = new FormData();
    formData.append('file', file);

    const tick = setInterval(() => setProgress((p) => Math.min(p + 12, 85)), 400);

    try {
      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      clearInterval(tick);
      setProgress(100);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setResult(data.data);
      setStep('done');
    } catch (err) {
      clearInterval(tick);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('error');
    }
  };

  const handleDownloadTemplate = async () => {
    const res = await fetch('/api/admin/bulk-upload', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setStep('select');
    setProgress(0);
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const isUploading = step === 'uploading';
  const isDone = step === 'done';

  return (
    <div className="bu-root">
      <style>{css}</style>

      <div className="bu-header">
        <Link href="/admin" className="bu-breadcrumb">← Admin</Link>
        <h1 className="bu-title">Bulk Import</h1>
        <p className="bu-subtitle">Upload a CSV or Excel file to import multiple products at once</p>
      </div>

      <div className="bu-layout">
        {/* Main panel */}
        <div>
          {/* Steps */}
          <div className="bu-steps">
            <div className={stepClass(step, 'select')}>
              {step !== 'select' ? '✓ ' : '1. '}Select File
            </div>
            <div className={stepClass(step, 'uploading')}>
              {isDone ? '✓ ' : '2. '}Upload
            </div>
            <div className={stepClass(step, 'done')}>
              3. Results
            </div>
          </div>

          <div className="bu-card">
            <div className="bu-card-body">

              {/* Download template */}
              <div className="bu-download-bar">
                <span className="bu-download-text">
                  <strong>First time?</strong> Download the CSV template to see the exact format required.
                </span>
                <button className="bu-btn-outline" onClick={handleDownloadTemplate}>
                  ↓ Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                className={`bu-dropzone${drag ? ' drag' : ''}${file ? ' has-file' : ''}`}
                onClick={() => { if (!file) fileRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="bu-file-info">
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <div>
                      <div className="bu-file-name">{file.name}</div>
                      <div className="bu-file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      className="bu-file-change"
                      onClick={(e) => { e.stopPropagation(); reset(); }}
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="bu-dropzone-icon">⬆</span>
                    <div className="bu-dropzone-title">Drop your file here or click to browse</div>
                    <div className="bu-dropzone-sub">.csv or .xlsx · max 10MB</div>
                  </>
                )}
              </div>

              {/* Progress bar */}
              {isUploading && (
                <div className="bu-progress-wrap">
                  <div className="bu-progress-label">
                    <span>Processing rows…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="bu-progress-bar">
                    <div className="bu-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Error alert */}
              {error && <div className="bu-error-alert">⚠ {error}</div>}

              {/* Upload button */}
              {!isDone && (
                <button
                  className="bu-btn amber"
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                >
                  {isUploading
                    ? <><div className="bu-spinner" /> Processing…</>
                    : '↑ Upload & Import'
                  }
                </button>
              )}

              {/* Results */}
              {isDone && result && (
                <div style={{ marginTop: '1.5rem' }}>
                  {result.inserted > 0 && (
                    <div className="bu-success-banner">
                      <div className="bu-success-icon">✦</div>
                      <div className="bu-success-title">Import Complete</div>
                      <div className="bu-success-sub">
                        {result.inserted} product{result.inserted !== 1 ? 's' : ''} added to your catalogue
                      </div>
                    </div>
                  )}

                  <div className="bu-result-grid">
                    <div className="bu-result-stat success">
                      <div className="bu-result-num green">{result.inserted}</div>
                      <div className="bu-result-label">Inserted</div>
                    </div>
                    <div className="bu-result-stat fail">
                      <div className="bu-result-num red">{result.failed}</div>
                      <div className="bu-result-label">Failed</div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <>
                      <div className="bu-error-title">
                        {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} found
                      </div>
                      <div className="bu-error-list">
                        {result.errors.map((e, i) => (
                          <div key={i} className="bu-error-item">
                            <span className="bu-error-row">Row {e.row}</span>
                            <span className="bu-error-msg">{e.error}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <button className="bu-reset" onClick={reset}>
                    ↺ Upload another file
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="bu-card">
            <div className="bu-card-head">
              <span>📋</span>
              <h3 className="bu-card-title">Column Reference</h3>
            </div>
            <div className="bu-card-body" style={{ paddingTop: '1rem' }}>
              <div className="bu-schema-section">
                <div className="bu-schema-label">Required</div>
                <div className="bu-schema-fields">
                  {REQUIRED_FIELDS.map((f) => (
                    <span key={f} className="bu-field-tag required">{f}</span>
                  ))}
                </div>
              </div>
              <div className="bu-schema-section">
                <div className="bu-schema-label">Optional</div>
                <div className="bu-schema-fields">
                  {OPTIONAL_FIELDS.map((f) => (
                    <span key={f} className="bu-field-tag optional">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bu-card">
            <div className="bu-card-head">
              <span>💡</span>
              <h3 className="bu-card-title">Format Guide</h3>
            </div>
            <div className="bu-card-body" style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="bu-hint">
                <strong>Images</strong> — 1 to 4 URLs, pipe-separated<br />
                <code>https://img1.jpg|https://img2.jpg</code>
              </div>
              <div className="bu-hint">
                <strong>Shape / Color / Clarity</strong> — single or multiple, pipe-separated<br />
                <code>round|oval</code> · <code>D|E|F</code> · <code>VS1|VS2</code>
              </div>
              <div className="bu-hint">
                <strong>Certification</strong> — pipe-separated<br />
                <code>GIA</code> · <code>GIA|AGS</code> · <code>none</code>
              </div>
              <div className="bu-hint">
                <strong>Category</strong> — use the slug, not the display name<br />
                <code>diamonds</code> · <code>gemstones</code>
              </div>
              <div className="bu-hint">
                <strong>Valid Shapes</strong><br />
                <code>round oval princess cushion emerald pear marquise radiant asscher heart other</code>
              </div>
              <div className="bu-hint">
                <strong>Valid Clarities</strong><br />
                <code>FL IF VVS1 VVS2 VS1 VS2 SI1 SI2 I1 I2 I3</code>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}