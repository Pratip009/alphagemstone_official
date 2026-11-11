'use client';
import { useRef, useState } from 'react';
import { X, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;
interface Contact { email: string; name: string }
interface Parsed {
  contacts: Contact[];
  duplicates: number;
  invalid: number;
  emailColumn?: string;
  nameColumn?: string;
  fileName?: string;
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const EMAIL_IN_TEXT_G = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CHUNK = 1000;

function finalize(rows: Contact[], invalid: number, extra: Partial<Parsed> = {}): Parsed {
  const seen = new Set<string>();
  const contacts: Contact[] = [];
  let duplicates = 0;
  for (const r of rows) {
    const email = r.email.toLowerCase().trim();
    if (seen.has(email)) { duplicates++; continue; }
    seen.add(email);
    contacts.push({ email, name: r.name.trim() });
  }
  return { contacts, duplicates, invalid, ...extra };
}

/** Pulls every email address out of free text (one per line, commas, "Name <email>"…). */
function parseText(text: string): Parsed {
  const rows: Contact[] = [];
  let invalid = 0;
  for (const line of text.split(/\r?\n/)) {
    const found = line.match(EMAIL_IN_TEXT_G);
    if (found) {
      // "Jane Doe <jane@x.com>" → keep the name when there's exactly one address on the line
      const name = found.length === 1 ? line.replace(found[0], '').replace(/[<>"',;]/g, ' ').replace(/\s+/g, ' ').trim() : '';
      found.forEach(e => rows.push({ email: e, name: name.length <= 80 ? name : '' }));
    } else if (line.includes('@')) {
      invalid++;
    }
  }
  return finalize(rows, invalid);
}

/** Spreadsheet rows → contacts. Finds the email column by header name, or by
 *  whichever column holds the most email-looking values. */
function parseRows(rows: string[][], fileName: string): Parsed {
  const clean = rows.filter(r => r.some(c => String(c).trim()));
  if (!clean.length) return { contacts: [], duplicates: 0, invalid: 0, fileName };

  const header = clean[0].map(c => String(c).trim().toLowerCase());
  const firstRowIsHeader = !header.some(h => EMAIL_IN_TEXT.test(h));
  let emailIdx = firstRowIsHeader ? header.findIndex(h => /e-?mail/.test(h)) : -1;

  if (emailIdx === -1) {
    const width = Math.max(...clean.slice(0, 50).map(r => r.length));
    let best = -1, bestHits = 0;
    for (let i = 0; i < width; i++) {
      const hits = clean.slice(0, 50).filter(r => EMAIL_IN_TEXT.test(String(r[i] ?? ''))).length;
      if (hits > bestHits) { best = i; bestHits = hits; }
    }
    emailIdx = best;
  }
  if (emailIdx === -1) return { contacts: [], duplicates: 0, invalid: 0, fileName };

  const hasHeader = firstRowIsHeader && !EMAIL_IN_TEXT.test(String(clean[0][emailIdx] ?? ''));
  const find = (re: RegExp) => (hasHeader ? header.findIndex((h, i) => i !== emailIdx && re.test(h)) : -1);
  const fullIdx = find(/^(full ?name|name|customer ?name|customer|display ?name|billing ?name)$/);
  const firstIdx = find(/first/);
  const lastIdx = find(/last|surname/);

  const rowsOut: Contact[] = [];
  let invalid = 0;
  for (const r of clean.slice(hasHeader ? 1 : 0)) {
    const cell = String(r[emailIdx] ?? '').trim();
    const m = cell.match(EMAIL_IN_TEXT);
    if (!m) { if (cell) invalid++; continue; }
    let name = '';
    if (fullIdx >= 0) name = String(r[fullIdx] ?? '');
    else if (firstIdx >= 0) name = `${String(r[firstIdx] ?? '')} ${lastIdx >= 0 ? String(r[lastIdx] ?? '') : ''}`;
    rowsOut.push({ email: m[0], name: name.replace(/\s+/g, ' ').trim().slice(0, 120) });
  }

  const nameColumn = fullIdx >= 0 ? clean[0][fullIdx]
    : firstIdx >= 0 ? [clean[0][firstIdx], lastIdx >= 0 ? clean[0][lastIdx] : ''].filter(Boolean).join(' + ')
    : undefined;

  return finalize(rowsOut, invalid, {
    fileName,
    emailColumn: hasHeader ? String(clean[0][emailIdx]) : `Column ${emailIdx + 1}`,
    nameColumn: nameColumn ? String(nameColumn) : undefined,
  });
}

export default function ImportContactsModal({
  authFetch,
  onClose,
  onImported,
}: {
  authFetch: AuthFetch;
  onClose: () => void;
  onImported: () => void;
}) {
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<{ added: number; alreadyListed: number; invalid: number } | null>(null);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setReading(true);
    setReadError('');
    setParsed(null);
    try {
      if (/\.txt$/i.test(file.name)) {
        setParsed({ ...parseText(await file.text()), fileName: file.name });
        return;
      }
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false });
      const p = parseRows(rows, file.name);
      if (!p.contacts.length) setReadError('No email addresses found in the first sheet of this file.');
      setParsed(p);
    } catch {
      setReadError('Couldn’t read this file. Save it as .csv or .xlsx and try again.');
    } finally {
      setReading(false);
    }
  };

  const runImport = async () => {
    if (!parsed?.contacts.length) return;
    setImporting(true);
    setImportError('');
    setDone(0);
    const total = { added: 0, alreadyListed: 0, invalid: parsed.invalid };
    try {
      for (let i = 0; i < parsed.contacts.length; i += CHUNK) {
        const res = await authFetch('/api/admin/newsletter/import', {
          method: 'POST',
          body: JSON.stringify({ contacts: parsed.contacts.slice(i, i + CHUNK) }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.message ?? 'Import failed');
        total.added += d.data.added;
        total.alreadyListed += d.data.alreadyListed;
        total.invalid += d.data.invalid;
        setDone(Math.min(parsed.contacts.length, i + CHUNK));
      }
      setResult(total);
      onImported();
    } catch (err) {
      setImportError(`${err instanceof Error ? err.message : 'Import failed'}. Contacts imported so far are saved — run the import again to finish; nobody is added twice.`);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => { setParsed(null); setResult(null); setPasted(''); setReadError(''); setImportError(''); };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Import contacts"
      onClick={e => { if (e.target === e.currentTarget && !importing) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ede9e1]">
          <div>
            <h2 className="font-['Cormorant_Garamond',serif] text-[1.3rem] font-semibold text-[#1a1714] leading-tight">Import old website contacts</h2>
            <p className="text-[0.7rem] text-[#a09a90]">They’re added as “Old website” and can be included in any campaign.</p>
          </div>
          <button onClick={onClose} disabled={importing} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a09a90] hover:bg-[#f4f1ec]"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#f0faf4] border border-[#bbf7d0]">
                <CheckCircle2 size={18} className="text-green-700 mt-0.5 shrink-0" />
                <div className="text-[0.8rem] text-green-900 space-y-0.5">
                  <p><strong>{result.added.toLocaleString()}</strong> new contacts added.</p>
                  {result.alreadyListed > 0 && <p>{result.alreadyListed.toLocaleString()} were already on your list and were left as they were (including anyone who had unsubscribed).</p>}
                  {result.invalid > 0 && <p>{result.invalid.toLocaleString()} rows didn’t contain a valid email and were skipped.</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7]">Import another list</button>
                <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-white bg-[#0f172a]">Done</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-[#f4f1ec] p-1 rounded-xl w-fit">
                {([['file', 'Upload a file'], ['paste', 'Paste emails']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setTab(k); setParsed(null); setReadError(''); }} aria-pressed={tab === k}
                    className={`px-4 py-1.5 rounded-lg text-[0.75rem] font-semibold transition-all ${tab === k ? 'bg-white text-[#1a1714] shadow-sm' : 'text-[#a09a90] hover:text-[#1a1714]'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'file' ? (
                <div>
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={reading || importing}
                    className="w-full py-8 rounded-xl border-2 border-dashed border-[#e4e4e7] flex flex-col items-center gap-2 text-[#a09a90] hover:border-[#c9a84c] hover:text-[#8a6e2a] transition-colors">
                    {reading ? <Loader2 size={22} className="animate-spin" /> : parsed?.fileName ? <FileSpreadsheet size={22} strokeWidth={1.5} /> : <Upload size={22} strokeWidth={1.5} />}
                    <span className="text-[0.78rem] font-medium">{parsed?.fileName ?? 'Choose a CSV or Excel file'}</span>
                    <span className="text-[0.68rem]">Needs an email column. A name column (or first + last name) is picked up automatically.</span>
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    value={pasted}
                    onChange={e => { setPasted(e.target.value); setParsed(e.target.value.trim() ? parseText(e.target.value) : null); }}
                    rows={8}
                    placeholder={'jane@example.com\nRavi Patel <ravi@example.com>\nmaria@example.com, tom@example.com'}
                    className="w-full px-3.5 py-2.5 text-[0.8rem] font-mono rounded-lg border-[1.5px] border-[#e4e4e7] bg-[#fafaf9] outline-none focus:border-[#c9a84c] focus:bg-white"
                  />
                  <p className="mt-1 text-[0.68rem] text-[#a09a90]">One per line, or separated by commas. “Name &lt;email&gt;” keeps the name.</p>
                </div>
              )}

              {readError && <p className="text-[0.75rem] text-red-600">{readError}</p>}

              {parsed && parsed.contacts.length > 0 && (
                <div className="rounded-xl border border-[#ede9e1] overflow-hidden">
                  <div className="px-4 py-3 bg-[#faf8f4] flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem]">
                    <span><strong className="text-[#1a1714] tabular-nums">{parsed.contacts.length.toLocaleString()}</strong> <span className="text-[#6b6560]">emails ready</span></span>
                    {parsed.duplicates > 0 && <span className="text-[#6b6560]">{parsed.duplicates.toLocaleString()} duplicates removed</span>}
                    {parsed.invalid > 0 && <span className="text-[#b45309]">{parsed.invalid.toLocaleString()} invalid skipped</span>}
                  </div>
                  {(parsed.emailColumn || parsed.nameColumn) && (
                    <p className="px-4 pt-2.5 text-[0.7rem] text-[#a09a90]">
                      Email from “{parsed.emailColumn}”{parsed.nameColumn ? `, name from “${parsed.nameColumn}”` : ', no name column found'}
                    </p>
                  )}
                  <table className="w-full text-[0.75rem]">
                    <tbody className="divide-y divide-[#f4f1ec]">
                      {parsed.contacts.slice(0, 5).map(c => (
                        <tr key={c.email}>
                          <td className="px-4 py-2 text-[#1a1714] truncate max-w-[220px]">{c.email}</td>
                          <td className="px-4 py-2 text-[#a09a90] truncate max-w-[160px]">{c.name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.contacts.length > 5 && <p className="px-4 py-2 text-[0.68rem] text-[#a09a90] border-t border-[#f4f1ec]">and {(parsed.contacts.length - 5).toLocaleString()} more</p>}
                </div>
              )}

              {importing && parsed && (
                <div>
                  <div className="h-2 rounded-full bg-[#f4f1ec] overflow-hidden">
                    <div className="h-full bg-[#c9a84c] transition-[width] duration-300" style={{ width: `${Math.max(4, (done / parsed.contacts.length) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[0.7rem] text-[#a09a90] tabular-nums">{done.toLocaleString()} of {parsed.contacts.length.toLocaleString()} imported…</p>
                </div>
              )}

              {importError && (
                <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
                  <AlertCircle size={15} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-[0.73rem] text-red-900">{importError}</p>
                </div>
              )}

              <p className="text-[0.7rem] text-[#78350f] bg-[#fef9ec] border border-[#fde68a] rounded-lg px-3 py-2.5 leading-relaxed">
                Only import people who bought from you or agreed to hear from you. Every email includes an unsubscribe link, and anyone who unsubscribes is never emailed again.
              </p>

              <div className="flex justify-end gap-2">
                <button onClick={onClose} disabled={importing} className="px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-[#64748b] border border-[#e4e4e7] hover:bg-[#f8f8f7]">Cancel</button>
                <button onClick={runImport} disabled={!parsed?.contacts.length || importing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[0.78rem] font-semibold text-white bg-[#0f172a] hover:opacity-90 disabled:opacity-50">
                  {importing && <Loader2 size={14} className="animate-spin" />}
                  {parsed?.contacts.length ? `Import ${parsed.contacts.length.toLocaleString()} contacts` : 'Import contacts'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
