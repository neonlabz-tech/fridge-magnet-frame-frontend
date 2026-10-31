'use client';

import { useMemo, useRef, useState } from 'react';
import { FileUp, Download } from 'lucide-react';
import { ModalShell, btnGhost, btnPrimary, inputCls, labelCls } from '@/components/dashboard/shared/UiKit';
import { buildLeads, templateCsv, type ImportParse } from '@/lib/leadsImport';
import { importLeads, refreshLeads, type CrmUser, type Lead } from '@/lib/crm';

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  me: string;
  users: CrmUser[];
  /** Called after the import with the result (or an error message). */
  onDone: (r: { created: number; skipped: number } | { error: string }) => void;
}

const norm = (s: string) => s.replace(/\D/g, '');

export default function ImportLeadsModal({ open, onClose, isAdmin, me, users, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [existing, setExisting] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const reset = () => {
    setFileName('');
    setText('');
    setOwner('');
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const effectiveOwner = isAdmin ? owner : me;
  const parsed: ImportParse | null = useMemo(() => (text ? buildLeads(text, effectiveOwner, me || 'admin') : null), [text, effectiveOwner, me]);

  /* A row without an ID whose phone already exists is treated as a duplicate; rows with an ID are checked by the server. */
  const phones = useMemo(() => new Set(existing.map((l) => norm(l.phone)).filter(Boolean)), [existing]);

  const summary = useMemo(() => {
    if (!parsed) return null;
    const seen = new Set<string>();
    const ready: Lead[] = [];
    let empty = 0;
    let invalid = 0;
    let dup = 0;
    for (const r of parsed.rows) {
      if (!r.lead) {
        if (r.problem?.includes('10 digits')) invalid += 1;
        else empty += 1;
        continue;
      }
      const l = r.lead;
      const key = norm(l.phone);
      const isDup = phones.has(norm(l.phone));
      if (isDup || (key && seen.has(key))) {
        dup += 1;
        continue;
      }
      if (key) seen.add(key);
      ready.push(l);
    }
    return { ready, empty, dup, invalid };
  }, [parsed, phones]);

  const pickFile = async (f?: File) => {
    if (!f) return;
    setFileName(f.name);
    setText(await f.text());
    setExisting(await refreshLeads());
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async () => {
    if (!summary?.ready.length || busy) return;
    setBusy(true);
    try {
      const r = await importLeads(summary.ready, (d, t) => setProgress([d, t]));
      onDone(r);
      reset();
      onClose();
    } catch (e) {
      onDone({ error: e instanceof Error ? e.message : 'Import failed.' });
    } finally {
      setBusy(false);
    }
  };

  const preview = summary?.ready.slice(0, 5) ?? [];

  return (
    <ModalShell
      open={open}
      onClose={close}
      icon={<FileUp size={18} />}
      title="Import leads from CSV"
      subtitle="Upload your leads sheet (File > Download > CSV in Google Sheets). Leads are saved to the database."
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={close} disabled={busy} className={btnGhost}>Cancel</button>
          <button type="button" onClick={run} disabled={busy || !summary?.ready.length || !!parsed?.missingColumns.length} className={btnPrimary}>
            {busy ? `Importing ${progress ? `${progress[0]}/${progress[1]}` : '...'}` : `Import ${summary?.ready.length ?? 0} leads`}
          </button>
        </>
      }
    >
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className={btnPrimary}>
            <FileUp size={14} /> Choose CSV file
          </button>
          <button type="button" onClick={download} className={btnGhost}>
            <Download size={13} /> Download template
          </button>
          {fileName && <span className="text-xs font-semibold text-[#475569]">{fileName}</span>}
        </div>

        {isAdmin && (
          <div>
            <label className={labelCls}>Assign imported leads to</label>
            <select className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.username} value={u.username}>{u.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#94A3B8]">Used when the file has no Owner column.</p>
          </div>
        )}

        {parsed?.missingColumns.length ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600">
            Column not found: {parsed.missingColumns.join(', ')}. Use the template for the expected headers.
          </p>
        ) : null}

        {summary && !parsed?.missingColumns.length && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Ready to import', summary.ready.length, 'text-emerald-600 bg-emerald-50'],
                ['Phone already exists (skipped)', summary.dup, 'text-amber-600 bg-amber-50'],
                ['Invalid phone (skipped)', summary.invalid, 'text-rose-600 bg-rose-50'],
                ['Empty rows (skipped)', summary.empty, 'text-slate-500 bg-slate-100'],
              ].map(([l, v, tone]) => (
                <div key={String(l)} className={`rounded-lg px-3 py-2 ${tone}`}>
                  <p className="text-xs font-semibold">{l}</p>
                  <p className="text-sm font-bold">{v}</p>
                </div>
              ))}
            </div>

            {preview.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B]">
                    <tr>
                      {['Business', 'Phone', 'Source', 'Call status', 'Status'].map((h) => (
                        <th key={h} className="px-3 py-2 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {preview.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{l.business}</td>
                        <td className="px-3 py-2">{l.phone}</td>
                        <td className="px-3 py-2">{l.source || '-'}</td>
                        <td className="px-3 py-2">{l.callStatus}</td>
                        <td className="px-3 py-2">{l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs leading-5 text-[#94A3B8]">
              First {preview.length} of {summary.ready.length} rows shown. Lead IDs are created automatically. A phone number that already exists is skipped, so uploading the same file twice is safe.
            </p>
          </>
        )}
      </div>
    </ModalShell>
  );
}
