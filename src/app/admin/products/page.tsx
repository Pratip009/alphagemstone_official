"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useApi } from "@/hooks/useApi";
import {
  SHAPES, COLORS, CLARITIES, CERTIFICATIONS,
  WATCH_GENDERS, WATCH_BRANDS, WATCH_MOVEMENTS,
  WATCH_STRAP_TYPES, WATCH_CASE_MATERIALS, WATCH_DIAL_COLORS,
  WATCH_FEATURES, WATCH_STYLES, WATCH_CASE_SIZES,
} from "@/models/Product";
import Link from "next/link";

/* ── Inline design tokens ─────────────────────────────────────────────────── */
const css = `
  .ap-root { font-family: 'DM Sans', sans-serif; color: #0f172a; background: #f8f7f4; min-height: 100vh; padding: 2rem; }
  .ap-root * { box-sizing: border-box; }

  .ap-display { font-family: 'Playfair Display', serif; font-size: 1.75rem; color: #0f172a; letter-spacing: -0.02em; }
  .ap-breadcrumb { font-size: 0.8rem; color: #64748b; font-weight: 500; text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; }
  .ap-breadcrumb:hover { color: #b45309; }

  .ap-card { background: #fff; border: 1px solid #e2e0da; border-radius: 12px; }
  .ap-card-inner { padding: 1.75rem; }

  .ap-section-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #0f172a; margin: 0 0 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e0da; }

  .ap-label { display: block; font-size: 0.72rem; font-weight: 600; color: #475569; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.4rem; }
  .ap-label-hint { font-size: 0.7rem; color: #94a3b8; font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 0.4rem; }

  .ap-input { width: 100%; height: 40px; padding: 0 0.875rem; border: 1.5px solid #d1cec7; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: #0f172a; background: #fafaf8; transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
  .ap-input:focus { border-color: #b45309; box-shadow: 0 0 0 3px rgba(180,83,9,0.1); background: #fff; }
  .ap-input::placeholder { color: #94a3b8; }
  .ap-textarea { height: auto; padding: 0.625rem 0.875rem; resize: none; line-height: 1.6; }
  select.ap-input { cursor: pointer; }
  .ap-input:disabled { background: #f1f0ec; color: #94a3b8; cursor: not-allowed; border-color: #e2e0da; }

  .ap-btn-primary { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0 1.25rem; height: 40px; background: #0f172a; color: #fff; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.825rem; font-weight: 600; letter-spacing: 0.03em; cursor: pointer; transition: background 0.15s, transform 0.1s; }
  .ap-btn-primary:hover { background: #1e293b; }
  .ap-btn-primary:active { transform: scale(0.98); }
  .ap-btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
  .ap-btn-primary.full { width: 100%; justify-content: center; height: 44px; font-size: 0.9rem; background: #b45309; }
  .ap-btn-primary.full:hover { background: #92400e; }

  .ap-btn-ghost { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0 1.1rem; height: 40px; background: transparent; color: #475569; border: 1.5px solid #d1cec7; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.825rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .ap-btn-ghost:hover { border-color: #b45309; color: #b45309; background: #fef3c7; }

  .ap-btn-danger { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0 1.1rem; height: 40px; background: transparent; color: #dc2626; border: 1.5px solid #fca5a5; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.825rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .ap-btn-danger:hover { background: #fef2f2; border-color: #dc2626; }
  .ap-btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Product type toggle */
  .ap-type-toggle { display: flex; background: #f1f0ec; border-radius: 10px; padding: 4px; gap: 4px; margin-bottom: 1.5rem; }
  .ap-type-btn { flex: 1; height: 38px; border: none; border-radius: 7px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.18s; color: #64748b; background: transparent; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
  .ap-type-btn.active { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.06); }
  .ap-type-btn:hover:not(.active) { color: #b45309; }

  /* Subsection divider */
  .ap-subsection { grid-column: span 2; margin: 0.5rem 0 0; padding-top: 1rem; border-top: 1px dashed #e2e0da; }
  .ap-subsection-title { font-size: 0.72rem; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1rem; }

  .ap-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
  @media (max-width: 640px) { .ap-form-grid { grid-template-columns: 1fr; } .ap-col-2 { grid-column: span 1 !important; } .ap-subsection { grid-column: span 1; } }
  .ap-col-2 { grid-column: span 2; }

  .ap-pill-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.4rem; padding: 0.75rem; background: #f8f7f4; border: 1.5px solid #d1cec7; border-radius: 8px; }
  .ap-pill { padding: 4px 11px; border-radius: 20px; border: 1.5px solid #d1cec7; font-size: 0.75rem; font-weight: 500; color: #475569; background: #fff; cursor: pointer; transition: all 0.12s; font-family: 'DM Sans', sans-serif; }
  .ap-pill:hover { border-color: #b45309; color: #b45309; }
  .ap-pill.active { background: #fef3c7; border-color: #d97706; color: #92400e; font-weight: 600; }
  .ap-pill-selected { font-size: 0.7rem; color: #b45309; font-weight: 600; margin-left: 0.5rem; }

  .ap-filter-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 0.75rem; align-items: end; }
  @media (max-width: 900px) { .ap-filter-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .ap-filter-grid { grid-template-columns: 1fr; } }

  .ap-search-wrap { position: relative; }
  .ap-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px; pointer-events: none; }
  .ap-search-wrap .ap-input { padding-left: 2.25rem; }

  .ap-table { width: 100%; border-collapse: collapse; font-size: 0.855rem; }
  .ap-table thead { background: #f8f7f4; border-bottom: 2px solid #e2e0da; }
  .ap-table th { padding: 0.75rem 1rem; text-align: left; font-size: 0.7rem; font-weight: 700; color: #475569; letter-spacing: 0.07em; text-transform: uppercase; white-space: nowrap; }
  .ap-table th.sortable { cursor: pointer; user-select: none; }
  .ap-table th.sortable:hover { color: #b45309; }
  .ap-table td { padding: 0.85rem 1rem; color: #1e293b; border-bottom: 1px solid #f1f0ec; vertical-align: middle; }
  .ap-table tbody tr:hover td { background: #fafaf8; }
  .ap-table tbody tr:last-child td { border-bottom: none; }
  .ap-table .td-name { font-weight: 600; color: #0f172a; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ap-table .td-price { font-weight: 700; color: #b45309; font-variant-numeric: tabular-nums; }
  .ap-table .td-muted { color: #64748b; font-size: 0.8rem; }

  .ap-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .ap-badge.active { background: #dcfce7; color: #15803d; }
  .ap-badge.inactive { background: #f1f5f9; color: #64748b; }
  .ap-badge.watch { background: #eff6ff; color: #1d4ed8; }
  .ap-badge.diamond { background: #fdf4ff; color: #7e22ce; }

  .ap-row-actions { display: flex; align-items: center; gap: 6px; }
  .ap-deactivate { font-size: 0.75rem; color: #94a3b8; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; white-space: nowrap; }
  .ap-deactivate:hover { color: #d97706; background: #fef3c7; }
  .ap-delete-row { font-size: 0.75rem; color: #94a3b8; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .ap-delete-row:hover { color: #dc2626; background: #fef2f2; }

  .ap-filter-summary { display: flex; align-items: center; justify-content: space-between; margin-top: 0.875rem; padding-top: 0.875rem; border-top: 1px solid #e2e0da; }
  .ap-filter-count { font-size: 0.8rem; color: #475569; }
  .ap-filter-count strong { color: #0f172a; }
  .ap-clear-btn { font-size: 0.78rem; color: #b45309; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 600; padding: 0; }
  .ap-clear-btn:hover { color: #92400e; text-decoration: underline; }

  .ap-pagination { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1rem; border-top: 1px solid #e2e0da; }
  .ap-page-info { font-size: 0.78rem; color: #64748b; }
  .ap-page-btns { display: flex; gap: 4px; }
  .ap-page-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d1cec7; border-radius: 6px; font-size: 0.78rem; font-weight: 500; color: #475569; background: #fff; cursor: pointer; transition: all 0.12s; font-family: 'DM Sans', sans-serif; }
  .ap-page-btn:hover:not(:disabled) { border-color: #b45309; color: #b45309; }
  .ap-page-btn.current { background: #0f172a; border-color: #0f172a; color: #fff; font-weight: 700; }
  .ap-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .ap-empty { text-align: center; padding: 4rem 1rem; }
  .ap-empty-icon { font-size: 2rem; margin-bottom: 0.75rem; }
  .ap-empty-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: #0f172a; margin-bottom: 0.4rem; }
  .ap-empty-sub { font-size: 0.85rem; color: #64748b; }

  .ap-success { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; color: #15803d; font-weight: 500; margin-bottom: 1rem; }
  .ap-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; color: #dc2626; font-weight: 500; }

  .ap-table-wrap { overflow-x: auto; }

  .ap-topbar { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap; }
  .ap-topbar-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  .ap-form-outer { margin-bottom: 1.5rem; }

  .ap-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.875rem; margin-bottom: 1.5rem; }
  .ap-stat { background: #fff; border: 1px solid #e2e0da; border-radius: 10px; padding: 1rem 1.25rem; }
  .ap-stat-label { font-size: 0.7rem; font-weight: 700; color: #64748b; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.35rem; }
  .ap-stat-value { font-size: 1.5rem; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1; }
  .ap-stat-value.amber { color: #b45309; }
  .ap-stat-value.green { color: #15803d; }

  .ap-modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(15,23,42,0.45); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 1rem; animation: ap-fade-in 0.15s ease; }
  @keyframes ap-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .ap-modal { background: #fff; border-radius: 14px; padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 24px 48px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08); animation: ap-slide-up 0.18s ease; }
  @keyframes ap-slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .ap-modal-icon { width: 48px; height: 48px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 1.25rem; }
  .ap-modal-title { font-family: 'Playfair Display', serif; font-size: 1.15rem; color: #0f172a; margin: 0 0 0.5rem; }
  .ap-modal-body { font-size: 0.875rem; color: #475569; line-height: 1.6; margin: 0 0 1.5rem; }
  .ap-modal-body strong { color: #dc2626; }
  .ap-modal-input-wrap { margin-bottom: 1.25rem; }
  .ap-modal-input-label { display: block; font-size: 0.72rem; font-weight: 600; color: #475569; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.4rem; }
  .ap-modal-confirm-input { width: 100%; height: 38px; padding: 0 0.75rem; border: 1.5px solid #d1cec7; border-radius: 7px; font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: #0f172a; background: #fafaf8; outline: none; transition: border-color 0.15s; }
  .ap-modal-confirm-input:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
  .ap-modal-actions { display: flex; gap: 0.625rem; }
  .ap-modal-cancel { flex: 1; height: 40px; background: #f8f7f4; border: 1.5px solid #d1cec7; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.825rem; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s; }
  .ap-modal-cancel:hover { border-color: #94a3b8; background: #f1f0ec; }
  .ap-modal-confirm-btn { flex: 1; height: 40px; background: #dc2626; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.825rem; font-weight: 600; color: #fff; cursor: pointer; transition: background 0.15s; }
  .ap-modal-confirm-btn:hover { background: #b91c1c; }
  .ap-modal-confirm-btn:disabled { background: #fca5a5; cursor: not-allowed; }

  /* ── Image Uploader ── */
  .ap-uploader { grid-column: span 2; }
  .ap-drop-zone { border: 2px dashed #d1cec7; border-radius: 10px; background: #fafaf8; padding: 1.5rem 1rem; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; position: relative; }
  .ap-drop-zone:hover, .ap-drop-zone.drag-over { border-color: #b45309; background: #fffbeb; }
  .ap-drop-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .ap-drop-icon { font-size: 1.6rem; margin-bottom: 0.4rem; }
  .ap-drop-text { font-size: 0.85rem; color: #64748b; }
  .ap-drop-text strong { color: #b45309; }
  .ap-drop-hint { font-size: 0.72rem; color: #94a3b8; margin-top: 0.25rem; }

  .ap-img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; margin-top: 0.75rem; }
  .ap-img-thumb { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1.5px solid #e2e0da; background: #f1f0ec; }
  .ap-img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ap-img-remove { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(15,23,42,0.7); border: none; color: #fff; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.12s; line-height: 1; }
  .ap-img-remove:hover { background: #dc2626; }
  .ap-img-uploading { position: absolute; inset: 0; background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; color: #b45309; flex-direction: column; gap: 4px; }
  .ap-img-spinner { width: 18px; height: 18px; border: 2px solid #fde68a; border-top-color: #b45309; border-radius: 50%; animation: ap-spin 0.7s linear infinite; }
  @keyframes ap-spin { to { transform: rotate(360deg); } }
  .ap-upload-error { font-size: 0.72rem; color: #dc2626; margin-top: 0.35rem; }
  .ap-uploading-bar { height: 3px; background: #fde68a; border-radius: 2px; margin-top: 0.5rem; overflow: hidden; }
  .ap-uploading-bar-inner { height: 100%; background: #b45309; border-radius: 2px; animation: ap-bar 1.2s ease-in-out infinite; }
  @keyframes ap-bar { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
`;

/* ── Interfaces ───────────────────────────────────────────────────────────── */
interface Product {
  _id: string;
  name: string;
  price: number;
  shape: string | string[];
  size: number;
  color: string | string[];
  clarity: string | string[];
  stock: number;
  isActive: boolean;
  category?: { _id: string; name: string } | string;
  watchBrand?: string;
  watchMovement?: string;
  watchGender?: string;
}
interface Category {
  _id: string;
  name: string;
  subcategories: Subcategory[];
}
interface Subcategory {
  _id: string;
  name: string;
  category: string;
}

type ProductType = "diamond" | "watch";

const EMPTY_DIAMOND_FORM = {
  productType: "diamond" as ProductType,
  name: "",
  category: "",
  subcategory: "",
  price: "",
  shapes: [] as string[],
  size: "",
  colors: [] as string[],
  clarities: [] as string[],
  certifications: [] as string[],
  stock: "",
  description: "",
};

const EMPTY_WATCH_FORM = {
  productType: "watch" as ProductType,
  name: "",
  category: "",
  subcategory: "",
  price: "",
  stock: "",
  description: "",
  watchGender: "",
  watchBrand: "",
  watchMovement: "",
  watchStrapType: "",
  watchCaseMaterial: "",
  watchDialColor: "",
  watchFeatures: [] as string[],
  watchStyle: "",
  watchCaseSize: "",
};

type DiamondForm = typeof EMPTY_DIAMOND_FORM;
type WatchForm = typeof EMPTY_WATCH_FORM;

/* ── ConfirmModal ─────────────────────────────────────────────────────────── */
function ConfirmDeleteModal({
  mode, productName, totalCount, onConfirm, onCancel, loading,
}: {
  mode: "single" | "all";
  productName?: string;
  totalCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const required = mode === "all" ? "DELETE ALL" : "";
  const canConfirm = mode === "single" || confirmText === required;

  return (
    <div className="ap-modal-backdrop" onClick={onCancel}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ap-modal-icon">🗑</div>
        {mode === "all" ? (
          <>
            <h2 className="ap-modal-title">Delete All Products</h2>
            <p className="ap-modal-body">
              This will permanently delete{" "}
              <strong>all {totalCount} products</strong> from the catalogue. This action{" "}
              <strong>cannot be undone</strong>.
            </p>
            <div className="ap-modal-input-wrap">
              <label className="ap-modal-input-label">
                Type <strong>DELETE ALL</strong> to confirm
              </label>
              <input
                className="ap-modal-confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE ALL"
                autoFocus
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="ap-modal-title">Delete Product</h2>
            <p className="ap-modal-body">
              Permanently delete{" "}
              <strong style={{ color: "#0f172a" }}>{productName}</strong>? This action{" "}
              <strong>cannot be undone</strong>.
            </p>
          </>
        )}
        <div className="ap-modal-actions">
          <button className="ap-modal-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="ap-modal-confirm-btn"
            onClick={onConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? "Deleting…" : mode === "all" ? "Delete All Products" : "Delete Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PillGroup ────────────────────────────────────────────────────────────── */
function PillGroup({
  options, selected, onChange, label, required,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (val: string[]) => void;
  label: string;
  required?: boolean;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  return (
    <div className="ap-col-2">
      <label className="ap-label">
        {label}{required && " *"}
        {selected.length > 0 && (
          <span className="ap-pill-selected">{selected.join(", ")}</span>
        )}
      </label>
      <div className="ap-pill-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`ap-pill${selected.includes(opt) ? " active" : ""}`}
          >
            {selected.includes(opt) ? "✓ " : ""}{opt}
          </button>
        ))}
      </div>
      {required && selected.length === 0 && (
        <p style={{ fontSize: "0.72rem", color: "#dc2626", marginTop: "0.35rem" }}>
          Select at least one
        </p>
      )}
    </div>
  );
}

/* ── ImageUploadItem ──────────────────────────────────────────────────────── */
interface UploadItem {
  id: string;           // local stable key
  previewUrl: string;   // object URL for instant preview
  cloudUrl: string | null;  // Cloudinary URL once uploaded
  status: "uploading" | "done" | "error";
  errorMsg?: string;
}

/* ── ImageUploader ────────────────────────────────────────────────────────── */
function ImageUploader({
  items,
  onChange,
  apiFetch,
}: {
  items: UploadItem[];
  onChange: (items: UploadItem[] | ((prev: UploadItem[]) => UploadItem[])) => void;  // ← updated
  apiFetch: (url: string, opts?: RequestInit) => Promise<unknown>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArr.length) return;

    // Create placeholder items immediately so previews appear right away
    const newItems: UploadItem[] = fileArr.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(f),
      cloudUrl: null,
      status: "uploading" as const,
    }));

    onChange([...items, ...newItems]);

    // Upload all files in one multipart request
    const fd = new FormData();
    fileArr.forEach((f) => fd.append("files", f));

    try {
      const res = await apiFetch("/api/admin/upload", { method: "POST", body: fd }) as {
        urls: string[];
      };

      onChange((prev: UploadItem[]) =>
        prev.map((item) => {
          const idx = newItems.findIndex((n) => n.id === item.id);
          if (idx === -1) return item;
          return { ...item, cloudUrl: res.urls[idx], status: "done" as const };
        })
      );
    } catch (err) {
      onChange((prev: UploadItem[]) =>
        prev.map((item) =>
          newItems.find((n) => n.id === item.id)
            ? { ...item, status: "error" as const, errorMsg: err instanceof Error ? err.message : "Upload failed" }
            : item
        )
      );
    }
  };

  const remove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="ap-uploader">
      <label className="ap-label">
        Product Images
        <span className="ap-label-hint">JPG, PNG, WebP · up to 10 MB each</span>
      </label>

      {/* Drop zone */}
      <div
        className={`ap-drop-zone${dragOver ? " drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
        />
        <div className="ap-drop-icon">🖼</div>
        <div className="ap-drop-text">
          <strong>Click to browse</strong> or drag &amp; drop images here
        </div>
        <div className="ap-drop-hint">Multiple files supported</div>
      </div>

      {/* Uploading progress bar */}
      {items.some((i) => i.status === "uploading") && (
        <div className="ap-uploading-bar">
          <div className="ap-uploading-bar-inner" />
        </div>
      )}

      {/* Thumbnails */}
      {items.length > 0 && (
        <div className="ap-img-grid">
          {items.map((item) => (
            <div key={item.id} className="ap-img-thumb">
              <img src={item.previewUrl} alt="" />
              {item.status === "uploading" && (
                <div className="ap-img-uploading">
                  <div className="ap-img-spinner" />
                  <span>Uploading…</span>
                </div>
              )}
              {item.status === "error" && (
                <div className="ap-img-uploading" style={{ background: "rgba(254,242,242,0.9)", color: "#dc2626" }}>
                  <span>✕ Failed</span>
                </div>
              )}
              <button
                type="button"
                className="ap-img-remove"
                onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Per-item errors */}
      {items.filter((i) => i.status === "error").map((i) => (
        <div key={i.id} className="ap-upload-error">
          ⚠ {i.errorMsg ?? "Upload failed for one image"}
        </div>
      ))}
    </div>
  );
}

type SortKey = "name" | "price" | "stock";
type SortDir = "asc" | "desc";

/* ── AddProductForm ───────────────────────────────────────────────────────── */
function AddProductForm({
  categories,
  onSuccess,
  onCancel,
  apiFetch,
}: {
  categories: Category[];
  onSuccess: () => void;
  onCancel: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<unknown>;
}) {
  const [productType, setProductType] = useState<ProductType>("diamond");
  const [diamondForm, setDiamondForm] = useState<DiamondForm>({ ...EMPTY_DIAMOND_FORM });
  const [watchForm, setWatchForm] = useState<WatchForm>({ ...EMPTY_WATCH_FORM });
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const form = productType === "diamond" ? diamondForm : watchForm;

  const handleCategoryChange = (id: string) => {
    if (productType === "diamond") {
      setDiamondForm((prev) => ({ ...prev, category: id, subcategory: "" }));
    } else {
      setWatchForm((prev) => ({ ...prev, category: id, subcategory: "" }));
    }
    setSubcategories(categories.find((c) => c._id === id)?.subcategories ?? []);
  };

  const setField = (key: string, value: string) => {
    if (productType === "diamond") {
      setDiamondForm((prev) => ({ ...prev, [key]: value }));
    } else {
      setWatchForm((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Block submit if any image is still uploading
    if (uploadItems.some((i) => i.status === "uploading")) {
      setError("Please wait for all images to finish uploading.");
      return;
    }

    if (productType === "diamond") {
      if (diamondForm.shapes.length === 0) { setError("Select at least one shape"); return; }
      if (diamondForm.colors.length === 0) { setError("Select at least one color"); return; }
      if (diamondForm.clarities.length === 0) { setError("Select at least one clarity"); return; }
    } else {
      if (!watchForm.watchBrand) { setError("Brand is required"); return; }
      if (!watchForm.watchMovement) { setError("Movement type is required"); return; }
    }

    // Collect successfully uploaded Cloudinary URLs
    const imageUrls = uploadItems
      .filter((i) => i.status === "done" && i.cloudUrl)
      .map((i) => i.cloudUrl as string);

    setLoading(true);
    try {
      let payload: Record<string, unknown>;

      if (productType === "diamond") {
        const { shapes, colors, clarities, certifications, productType: _pt, ...rest } = diamondForm;
        payload = {
          productType: "diamond",
          ...rest,
          price: Number(diamondForm.price),
          size: Number(diamondForm.size),
          stock: Number(diamondForm.stock),
          shape: shapes,
          color: colors,
          clarity: clarities,
          certification: certifications,
          images: imageUrls,
        };
      } else {
        const { productType: _pt, watchFeatures, ...rest } = watchForm;
        payload = {
          productType: "watch",
          ...rest,
          price: Number(watchForm.price),
          stock: Number(watchForm.stock),
          watchFeatures,
          images: imageUrls,
        };
        Object.keys(payload).forEach((k) => {
          if (payload[k] === "") delete payload[k];
        });
      }

      await apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
      setDiamondForm({ ...EMPTY_DIAMOND_FORM });
      setWatchForm({ ...EMPTY_WATCH_FORM });
      setUploadItems([]);
      setSubcategories([]);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const selectedCatName = categories.find((c) => c._id === form.category)?.name ?? "";
  const isUploading = uploadItems.some((i) => i.status === "uploading");

  return (
    <div className="ap-form-outer">
      <div className="ap-card">
        <div className="ap-card-inner">
          <h2 className="ap-section-title">New Product</h2>

          {/* Product type toggle */}
          <div className="ap-type-toggle">
            <button
              type="button"
              className={`ap-type-btn${productType === "diamond" ? " active" : ""}`}
              onClick={() => setProductType("diamond")}
            >
              💎 Diamond / Gemstone
            </button>
            <button
              type="button"
              className={`ap-type-btn${productType === "watch" ? " active" : ""}`}
              onClick={() => setProductType("watch")}
            >
              ⌚ Watch
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ap-form-grid">

              {/* ── Shared fields ── */}
              <div className="ap-col-2">
                <label className="ap-label">Product Name *</label>
                <input
                  className="ap-input"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={
                    productType === "diamond"
                      ? "e.g. 1.5ct Round Brilliant Diamond"
                      : "e.g. Rolex Submariner Date 41mm"
                  }
                  required
                />
              </div>

              <div>
                <label className="ap-label">
                  Category *
                  <span className="ap-label-hint">({categories.length} categories)</span>
                </label>
                <select
                  className="ap-input"
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  required
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ap-label">
                  Subcategory
                  {form.category && (
                    <span className="ap-label-hint">
                      {subcategories.length} in {selectedCatName}
                    </span>
                  )}
                </label>
                <select
                  className="ap-input"
                  value={form.subcategory}
                  onChange={(e) => setField("subcategory", e.target.value)}
                  disabled={!form.category}
                >
                  <option value="">
                    {!form.category
                      ? "Select category first"
                      : subcategories.length === 0
                        ? "No subcategories"
                        : "Select subcategory…"}
                  </option>
                  {subcategories.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ap-label">Price (USD) *</label>
                <input
                  type="number"
                  className="ap-input"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="ap-label">Stock Quantity *</label>
                <input
                  type="number"
                  className="ap-input"
                  value={form.stock}
                  onChange={(e) => setField("stock", e.target.value)}
                  placeholder="0"
                  required
                  min="0"
                />
              </div>

              {/* ── Diamond-specific fields ── */}
              {productType === "diamond" && (
                <>
                  <div>
                    <label className="ap-label">Size (Carat) *</label>
                    <input
                      type="number"
                      className="ap-input"
                      value={(diamondForm as DiamondForm).size}
                      onChange={(e) =>
                        setDiamondForm((prev) => ({ ...prev, size: e.target.value }))
                      }
                      placeholder="0.00"
                      required
                      min="0.01"
                      step="0.01"
                    />
                  </div>

                  <div />

                  <PillGroup
                    label="Shape"
                    options={SHAPES}
                    selected={(diamondForm as DiamondForm).shapes}
                    onChange={(v) => setDiamondForm((prev) => ({ ...prev, shapes: v }))}
                    required
                  />
                  <PillGroup
                    label="Color Grade"
                    options={COLORS}
                    selected={(diamondForm as DiamondForm).colors}
                    onChange={(v) => setDiamondForm((prev) => ({ ...prev, colors: v }))}
                    required
                  />
                  <PillGroup
                    label="Clarity Grade"
                    options={CLARITIES}
                    selected={(diamondForm as DiamondForm).clarities}
                    onChange={(v) => setDiamondForm((prev) => ({ ...prev, clarities: v }))}
                    required
                  />
                  <PillGroup
                    label="Certification"
                    options={CERTIFICATIONS}
                    selected={(diamondForm as DiamondForm).certifications}
                    onChange={(v) => setDiamondForm((prev) => ({ ...prev, certifications: v }))}
                  />
                </>
              )}

              {/* ── Watch-specific fields ── */}
              {productType === "watch" && (
                <>
                  <div>
                    <label className="ap-label">Gender *</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchGender}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchGender: e.target.value }))}
                      required
                    >
                      <option value="">Select gender…</option>
                      {WATCH_GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Brand *</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchBrand}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchBrand: e.target.value }))}
                      required
                    >
                      <option value="">Select brand…</option>
                      {WATCH_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Movement *</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchMovement}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchMovement: e.target.value }))}
                      required
                    >
                      <option value="">Select movement…</option>
                      {WATCH_MOVEMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Style</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchStyle}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchStyle: e.target.value }))}
                    >
                      <option value="">Select style…</option>
                      {WATCH_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Strap Type</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchStrapType}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchStrapType: e.target.value }))}
                    >
                      <option value="">Select strap…</option>
                      {WATCH_STRAP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Case Material</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchCaseMaterial}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchCaseMaterial: e.target.value }))}
                    >
                      <option value="">Select material…</option>
                      {WATCH_CASE_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Dial Color</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchDialColor}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchDialColor: e.target.value }))}
                    >
                      <option value="">Select dial color…</option>
                      {WATCH_DIAL_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="ap-label">Case Size</label>
                    <select
                      className="ap-input"
                      value={(watchForm as WatchForm).watchCaseSize}
                      onChange={(e) => setWatchForm((prev) => ({ ...prev, watchCaseSize: e.target.value }))}
                    >
                      <option value="">Select size…</option>
                      {WATCH_CASE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <PillGroup
                    label="Features"
                    options={WATCH_FEATURES}
                    selected={(watchForm as WatchForm).watchFeatures}
                    onChange={(v) => setWatchForm((prev) => ({ ...prev, watchFeatures: v }))}
                  />
                </>
              )}

              {/* ── Image uploader (replaces textarea) ── */}
              <ImageUploader
                items={uploadItems}
                onChange={setUploadItems}
                apiFetch={apiFetch}
              />

              {/* ── Description ── */}
              <div className="ap-col-2">
                <label className="ap-label">Description</label>
                <textarea
                  className="ap-input ap-textarea"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Optional product description…"
                />
              </div>

              {error && <div className="ap-col-2 ap-error">⚠ {error}</div>}

              <div className="ap-col-2" style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={onCancel}
                  className="ap-btn-ghost"
                  style={{ flex: "0 0 auto" }}
                >
                  ✕ Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isUploading}
                  className="ap-btn-primary full"
                  style={{ flex: 1 }}
                >
                  {isUploading
                    ? "⏳ Uploading images…"
                    : loading
                      ? "Saving…"
                      : productType === "diamond"
                        ? "💎 Create Diamond Product"
                        : "⌚ Create Watch Product"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function AdminProductsPage() {
  const { apiFetch } = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterShape, setFilterShape] = useState("");
  const [filterClarity, setFilterClarity] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [modal, setModal] = useState<
    | { mode: "all" }
    | { mode: "single"; id: string; name: string }
    | null
  >(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [pData, cData] = await Promise.all([
        apiFetch("/api/admin/products"),
        apiFetch("/api/categories?withSubcategories=true"),
      ]);
      setProducts((pData as { data: Product[] }).data || []);
      let cats: Category[] = [];
      const raw = cData as { data?: Category[] } | Category[];
      if (Array.isArray((raw as { data?: Category[] }).data)) cats = (raw as { data: Category[] }).data;
      else if (Array.isArray(raw)) cats = raw as Category[];
      setCategories(cats);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (filterCategory)
      list = list.filter((p) => {
        const id = typeof p.category === "object" ? p.category?._id : p.category;
        return id === filterCategory;
      });
    if (filterStatus !== "all")
      list = list.filter((p) => (filterStatus === "active" ? p.isActive : !p.isActive));
    if (filterShape)
      list = list.filter((p) =>
        Array.isArray(p.shape)
          ? (p.shape as string[]).includes(filterShape)
          : p.shape === filterShape,
      );
    if (filterClarity)
      list = list.filter((p) =>
        Array.isArray(p.clarity)
          ? (p.clarity as string[]).includes(filterClarity)
          : p.clarity === filterClarity,
      );
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return list;
  }, [products, search, filterCategory, filterStatus, filterShape, filterClarity, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, filterCategory, filterStatus, filterShape, filterClarity]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const SortArrow = ({ k }: { k: SortKey }) => (
    <span style={{ opacity: sortKey === k ? 1 : 0.3, marginLeft: 4 }}>
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const handleDeactivate = async (id: string) => {
    await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleDeleteSingle = async () => {
    if (modal?.mode !== "single") return;
    setModalLoading(true);
    try {
      await apiFetch(`/api/admin/products/${modal.id}`, { method: "DELETE" });
      setSuccess(`"${modal.name}" deleted successfully.`);
      setModal(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
      setModal(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setModalLoading(true);
    try {
      try {
        await apiFetch("/api/admin/products", { method: "DELETE" });
      } catch {
        await Promise.all(
          products.map((p) => apiFetch(`/api/admin/products/${p._id}`, { method: "DELETE" }))
        );
      }
      setSuccess(`All ${products.length} products deleted successfully.`);
      setModal(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all products");
      setModal(null);
    } finally {
      setModalLoading(false);
    }
  };

  const hasFilters = !!(search || filterCategory || filterStatus !== "all" || filterShape || filterClarity);
  const activeCount = products.filter((p) => p.isActive).length;
  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const isWatch = (p: Product) => !!(p.watchBrand || p.watchMovement || p.watchGender);

  return (
    <div className="ap-root">
      <style>{css}</style>

      {modal && (
        <ConfirmDeleteModal
          mode={modal.mode}
          productName={modal.mode === "single" ? modal.name : undefined}
          totalCount={products.length}
          onConfirm={modal.mode === "all" ? handleDeleteAll : handleDeleteSingle}
          onCancel={() => setModal(null)}
          loading={modalLoading}
        />
      )}

      {/* Top bar */}
      <div className="ap-topbar">
        <div>
          <Link href="/admin" className="ap-breadcrumb">← Admin</Link>
          <h1 className="ap-display" style={{ marginTop: "0.35rem" }}>Product Catalogue</h1>
        </div>
        <div className="ap-topbar-actions">
          {products.length > 0 && (
            <button className="ap-btn-danger" onClick={() => setModal({ mode: "all" })}>
              🗑 Delete All
            </button>
          )}
          <button
            className="ap-btn-primary"
            onClick={() => { setShowForm((v) => !v); setError(""); setSuccess(""); }}
          >
            {showForm ? "✕ Cancel" : "+ Add Product"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="ap-stats">
        <div className="ap-stat">
          <div className="ap-stat-label">Total Products</div>
          <div className="ap-stat-value">{products.length}</div>
        </div>
        <div className="ap-stat">
          <div className="ap-stat-label">Active</div>
          <div className="ap-stat-value green">{activeCount}</div>
        </div>
        <div className="ap-stat">
          <div className="ap-stat-label">Inactive</div>
          <div className="ap-stat-value">{products.length - activeCount}</div>
        </div>
        <div className="ap-stat">
          <div className="ap-stat-label">Inventory Value</div>
          <div className="ap-stat-value amber">${totalValue.toLocaleString()}</div>
        </div>
      </div>

      {success && <div className="ap-success">✓ {success}</div>}
      {error && !showForm && <div className="ap-error">⚠ {error}</div>}

      {showForm && (
        <AddProductForm
          categories={categories}
          apiFetch={apiFetch}
          onSuccess={() => {
            setSuccess("Product created successfully.");
            setShowForm(false);
            fetchData();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter bar */}
      <div className="ap-card" style={{ marginBottom: "1rem" }}>
        <div className="ap-card-inner" style={{ paddingBottom: hasFilters ? "0.75rem" : "1.75rem" }}>
          <div className="ap-filter-grid">
            <div className="ap-search-wrap">
              <span className="ap-search-icon">⌕</span>
              <input
                className="ap-input"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="ap-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select className="ap-input" value={filterShape} onChange={(e) => setFilterShape(e.target.value)}>
              <option value="">All Shapes</option>
              {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="ap-input" value={filterClarity} onChange={(e) => setFilterClarity(e.target.value)}>
              <option value="">All Clarities</option>
              {CLARITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="ap-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {hasFilters && (
            <div className="ap-filter-summary">
              <span className="ap-filter-count">
                Showing <strong>{filtered.length}</strong> of <strong>{products.length}</strong> products
              </span>
              <button
                className="ap-clear-btn"
                onClick={() => {
                  setSearch(""); setFilterCategory(""); setFilterStatus("all");
                  setFilterShape(""); setFilterClarity("");
                }}
              >
                Clear all filters ×
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="ap-card">
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("name")}>Name <SortArrow k="name" /></th>
                <th>Type</th>
                <th className="sortable" onClick={() => handleSort("price")}>Price <SortArrow k="price" /></th>
                <th>Shape / Brand</th>
                <th>Color / Movement</th>
                <th>Clarity / Gender</th>
                <th className="sortable" onClick={() => handleSort("stock")}>Stock <SortArrow k="stock" /></th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => {
                const watch = isWatch(p);
                return (
                  <tr key={p._id}>
                    <td className="td-name">{p.name}</td>
                    <td>
                      <span className={`ap-badge ${watch ? "watch" : "diamond"}`}>
                        {watch ? "⌚ Watch" : "💎 Diamond"}
                      </span>
                    </td>
                    <td className="td-price">${p.price.toLocaleString()}</td>
                    <td className="td-muted">
                      {watch
                        ? p.watchBrand || "—"
                        : Array.isArray(p.shape) ? (p.shape as string[]).join(", ") : p.shape || "—"}
                    </td>
                    <td className="td-muted">
                      {watch
                        ? p.watchMovement || "—"
                        : Array.isArray(p.color) ? (p.color as string[]).join(", ") : p.color || "—"}
                    </td>
                    <td className="td-muted">
                      {watch
                        ? p.watchGender || "—"
                        : Array.isArray(p.clarity) ? (p.clarity as string[]).join(", ") : p.clarity || "—"}
                    </td>
                    <td style={{ fontWeight: 600, color: p.stock < 5 ? "#dc2626" : "#0f172a" }}>
                      {p.stock}
                    </td>
                    <td>
                      <span className={`ap-badge ${p.isActive ? "active" : "inactive"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="ap-row-actions">
                        <button
                          className="ap-deactivate"
                          onClick={() => handleDeactivate(p._id)}
                          title="Deactivate (soft delete)"
                        >
                          Deactivate
                        </button>
                        <button
                          className="ap-delete-row"
                          onClick={() => setModal({ mode: "single", id: p._id, name: p.name })}
                          title="Permanently delete this product"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paginated.length === 0 && (
          <div className="ap-empty">
            <div className="ap-empty-icon">◇</div>
            <div className="ap-empty-title">
              {hasFilters ? "No matching products" : "No products yet"}
            </div>
            <div className="ap-empty-sub">
              {hasFilters ? "Try adjusting your filters" : "Add your first product above"}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="ap-pagination">
            <span className="ap-page-info">
              Page {page} of {totalPages} · {filtered.length} results
            </span>
            <div className="ap-page-btns">
              <button className="ap-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button className="ap-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button
                    key={p}
                    className={`ap-page-btn${p === page ? " current" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button className="ap-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              <button className="ap-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}