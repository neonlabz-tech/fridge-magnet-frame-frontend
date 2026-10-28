import { CALL_STATUSES, LEAD_STATUSES, RESULTS, SOURCES, type FollowUp, type Lead, type LeadStatus } from '@/lib/crm';

/* ---------- CSV parsing (quotes, commas and line breaks inside quotes, BOM) ---------- */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ---------- column mapping ---------- */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES: Record<string, string[]> = {
  dateAdded: ['dateadded', 'date', 'created', 'createdat'],
  id: ['leadid', 'id'],
  business: ['customerbusiness', 'business', 'businessname', 'customer', 'customername', 'name'],
  phone: ['phone', 'phonenumber', 'mobile', 'contact', 'contactnumber'],
  source: ['source'],
  callStatus: ['callstatus'],
  result: ['result'],
  product: ['interestedpackage', 'interestedproduct', 'product', 'package'],
  status: ['status', 'leadstatus'],
  nextFollowUp: ['nextfollowup', 'nextfollowupdate'],
  customerId: ['convertedcustomerid', 'customerid'],
  owner: ['owner', 'assignedto', 'assignee'],
  email: ['email', 'emailaddress'],
  address: ['address'],
  notes: ['notes', 'note', 'remarks'],
};

export const TEMPLATE_HEADERS = [
  'Date Added', 'Lead ID', 'Customer / Business', 'Phone', 'Source', 'Call Status', 'Result',
  'Interested Package', 'Status', 'Next Follow-up', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Converted Customer ID',
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 05-Oct-2026, 05/10/2026 (day first), 2026-10-05 or a full ISO date -> ISO string ('' if unreadable). */
export function parseDate(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  let y = 0;
  let m = 0;
  let d = 0;
  let hit: RegExpMatchArray | null;
  if ((hit = s.match(/^(\d{1,2})[-\/. ]([A-Za-z]{3,9})[-\/. ,]+(\d{2,4})/))) {
    d = +hit[1];
    m = MONTHS.indexOf(hit[2].slice(0, 3).toLowerCase()) + 1;
    y = +hit[3];
  } else if ((hit = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) {
    y = +hit[1];
    m = +hit[2];
    d = +hit[3];
  } else if ((hit = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) {
    d = +hit[1];
    m = +hit[2];
    y = +hit[3];
  } else return '';
  if (y < 100) y += 2000;
  if (!m || m > 12 || !d || d > 31) return '';
  const dt = new Date(y, m - 1, d, 9, 0, 0);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
}

const pick = <T extends string>(raw: string, list: readonly T[]): T | '' =>
  list.find((x) => norm(x) === norm(raw)) ?? '';

export interface ImportRow {
  line: number;
  lead: Lead | null;
  problem?: string;
}

export interface ImportParse {
  rows: ImportRow[];
  missingColumns: string[];
  recognised: string[];
}

/** Turns CSV text into leads. `owner` is used when the file has no Owner column / value. */
export function buildLeads(text: string, owner: string): ImportParse {
  const table = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  if (!table.length) return { rows: [], missingColumns: ['Customer / Business'], recognised: [] };

  // Header row = first row that contains a business-like column (the sheet may have blank rows above it).
  let headIdx = table.findIndex((r) => r.some((c) => ALIASES.business.includes(norm(c))));
  if (headIdx < 0) headIdx = 0;
  const head = table[headIdx].map(norm);

  const col: Record<string, number> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const idx = head.findIndex((h) => names.includes(h));
    if (idx >= 0) col[field] = idx;
  }
  const followCols = head
    .map((h, i) => ({ i, m: h.match(/^followup(\d+)$/) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]))
    .map((x) => x.i);

  const recognised = Object.keys(col).concat(followCols.length ? ['followUps'] : []);
  const missingColumns = col.business === undefined ? ['Customer / Business'] : [];

  const rows: ImportRow[] = [];
  table.slice(headIdx + 1).forEach((r, k) => {
    const line = headIdx + k + 2;
    const get = (f: string) => (col[f] === undefined ? '' : (r[col[f]] ?? '').trim());

    const phoneDigits = get('phone').replace(/\D/g, '');
    const phone = phoneDigits.length === 9 ? `0${phoneDigits}` : phoneDigits;
    const business = get('business') || (phone ? 'Unknown' : '');
    if (!business) {
      rows.push({ line, lead: null, problem: 'Empty row (no name or phone).' });
      return;
    }

    const rowOwner = get('owner').toLowerCase() || owner;
    const callStatus = pick(get('callStatus'), CALL_STATUSES) || 'Not Contacted';
    const result = pick(get('result'), RESULTS) || '';
    const product = get('product') === '-' ? '' : get('product');
    const customerId = get('customerId');
    const nextFollowUp = parseDate(get('nextFollowUp'));

    const dates = followCols.map((i) => parseDate((r[i] ?? '').trim())).filter(Boolean);
    const history: FollowUp[] = dates.map((at, n) => ({
      n: n + 1,
      at,
      by: 'import',
      callStatus: n === dates.length - 1 ? callStatus : '',
      result: n === dates.length - 1 ? result : '',
      product,
      notes: `Follow-up ${n + 1} (imported)`,
      nextFollowUp: '',
    }));

    let status: LeadStatus =
      (LEAD_STATUSES.find((s) => norm(s) === norm(get('status'))) as LeadStatus | undefined) ?? 'New';
    if (!get('status')) {
      if (customerId) status = 'Converted';
      else if (dates.length || nextFollowUp) status = 'Follow Up';
    }

    const rawSource = get('source');
    const lead: Lead = {
      id: get('id'),
      dateAdded: parseDate(get('dateAdded')) || new Date().toISOString(),
      business,
      phone,
      source: pick(rawSource, SOURCES) || (rawSource ? 'Other' : ''),
      callStatus,
      result,
      product,
      status,
      nextFollowUp,
      owner: rowOwner,
      email: get('email'),
      address: get('address'),
      notes: get('notes'),
      history,
      ...(customerId ? { customerId } : {}),
    };
    rows.push({ line, lead });
  });

  return { rows, missingColumns, recognised };
}

export function templateCsv(): string {
  const sample = ['05-Oct-2026', 'ML001', 'Sample Shop', '0771234567', 'Facebook', 'Answered', 'Callback', 'magnet', 'Follow Up', '13-Oct-2026', '09-Oct-2026', '', '', ''];
  return [TEMPLATE_HEADERS, sample].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
