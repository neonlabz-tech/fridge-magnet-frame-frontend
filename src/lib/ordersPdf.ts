import type { Order } from '@/types/order';

/**
 * Dependency-free A4 portrait PDF generator for the Orders "Export PDF" button.
 * Builds the PDF file directly (standard Helvetica fonts + the Magnify logo as a JPEG)
 * and triggers an automatic download – no print dialog.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 34;
const RIGHT = PAGE_W - MARGIN;
const BAND_H = 32;
const ROW_H = 38;
const BOTTOM_LIMIT = PAGE_H - 50;

type RGB = [number, number, number];

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];
const f = (n: number) => n.toFixed(2);
const fill = (c: RGB) => `${f(c[0])} ${f(c[1])} ${f(c[2])} rg`;
const stroke = (c: RGB) => `${f(c[0])} ${f(c[1])} ${f(c[2])} RG`;

/* ---------- text helpers ---------- */

let measureCtx: CanvasRenderingContext2D | null = null;
const textWidth = (text: string, size: number, bold: boolean) => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * size * 0.55;
  measureCtx.font = `${bold ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`;
  return measureCtx.measureText(text).width;
};

// Standard PDF fonts only cover Latin characters
const clean = (v: unknown) =>
  String(v ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^ -~ -ÿ]/g, '?');

const pdfString = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const fit = (text: string, size: number, bold: boolean, maxW: number) => {
  if (textWidth(text, size, bold) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}...`, size, bold) > maxW) t = t.slice(0, -1);
  return `${t}...`;
};

const toBytes = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
  return out;
};

/* ---------- page drawing ---------- */

class PdfPage {
  ops: string[] = [];

  rect(x: number, y: number, w: number, h: number, color: RGB) {
    this.ops.push(`${fill(color)} ${f(x)} ${f(PAGE_H - y - h)} ${f(w)} ${f(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB, width: number) {
    this.ops.push(
      `${stroke(color)} ${f(width)} w ${f(x1)} ${f(PAGE_H - y1)} m ${f(x2)} ${f(PAGE_H - y2)} l S`
    );
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, color: RGB) {
    const k = r * 0.5523;
    const yb = PAGE_H - y - h;
    const p = (a: number, b: number) => `${f(a)} ${f(b)}`;
    this.ops.push(
      `${fill(color)} ${p(x + r, yb)} m ${p(x + w - r, yb)} l ` +
        `${p(x + w - r + k, yb)} ${p(x + w, yb + r - k)} ${p(x + w, yb + r)} c ` +
        `${p(x + w, yb + h - r)} l ` +
        `${p(x + w, yb + h - r + k)} ${p(x + w - r + k, yb + h)} ${p(x + w - r, yb + h)} c ` +
        `${p(x + r, yb + h)} l ` +
        `${p(x + r - k, yb + h)} ${p(x, yb + h - r + k)} ${p(x, yb + h - r)} c ` +
        `${p(x, yb + r)} l ` +
        `${p(x, yb + r - k)} ${p(x + r - k, yb)} ${p(x + r, yb)} c h f`
    );
  }

  text(
    str: string,
    x: number,
    y: number,
    o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'center' | 'right' } = {}
  ) {
    const size = o.size ?? 9;
    const bold = o.bold ?? false;
    const s = clean(str);
    const w = textWidth(s, size, bold);
    const px = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf ${fill(o.color ?? [0.06, 0.09, 0.16])} ` +
        `${f(px)} ${f(PAGE_H - y)} Td (${pdfString(s)}) Tj ET`
    );
  }

  image(x: number, y: number, w: number, h: number) {
    this.ops.push(`q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(PAGE_H - y - h)} cm /Im1 Do Q`);
  }
}

/* ---------- logo ---------- */

interface Logo {
  bytes: Uint8Array;
  w: number;
  h: number;
}

async function loadLogo(): Promise<Logo | null> {
  try {
    const img = new Image();
    img.src = '/magnify-logo.png';
    await img.decode();
    const scale = Math.min(1, 360 / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const bin = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, w, h };
  } catch {
    return null;
  }
}

/* ---------- order table ---------- */

const C = {
  ink: hex('#0f172a'),
  muted: hex('#94a3b8'),
  head: hex('#475569'),
  blue: hex('#1d4ed8'),
  band: hex('#f1f5f9'),
  rowLine: hex('#e2e8f0'),
  rule: hex('#1e293b'),
};

const STATUS_COLORS: Record<string, { bg: RGB; fg: RGB }> = {
  pending: { bg: hex('#f1f5f9'), fg: hex('#475569') },
  processing: { bg: hex('#dbeafe'), fg: hex('#2563eb') },
  shipped: { bg: hex('#d1fae5'), fg: hex('#059669') },
  delivered: { bg: hex('#d1fae5'), fg: hex('#059669') },
  completed: { bg: hex('#d1fae5'), fg: hex('#059669') },
  canceled: { bg: hex('#fee2e2'), fg: hex('#dc2626') },
};
const PAY_COLORS: Record<string, { bg: RGB; fg: RGB }> = {
  paid: { bg: hex('#dcfce7'), fg: hex('#15803d') },
  pending: { bg: hex('#fef3c7'), fg: hex('#b45309') },
  failed: { bg: hex('#fee2e2'), fg: hex('#dc2626') },
  refunded: { bg: hex('#f1f5f9'), fg: hex('#475569') },
};

const COL = {
  order: MARGIN + 12,
  orderW: 150,
  dest: MARGIN + 178,
  destW: 138,
  pay: 392,
  status: 462,
  amountRight: RIGHT - 12,
};

const cap = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');
const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function drawBand(page: PdfPage, y: number) {
  page.rect(MARGIN, y, CONTENT_W, BAND_H, C.band);
  const t = { size: 7.5, bold: true, color: C.head } as const;
  page.text('ORDER ID /', COL.order, y + 14, t);
  page.text('CUSTOMER', COL.order, y + 24, t);
  page.text('DESTINATION /', COL.dest, y + 14, t);
  page.text('CONTACT', COL.dest, y + 24, t);
  page.text('PAYMENT', COL.pay, y + 19, { ...t, align: 'center' });
  page.text('STATUS', COL.status, y + 19, { ...t, align: 'center' });
  page.text('AMOUNT', COL.amountRight, y + 19, { ...t, align: 'right' });
}
const CONTENT_W = PAGE_W - MARGIN * 2;

function badge(
  page: PdfPage,
  label: string,
  cx: number,
  y: number,
  colors: { bg: RGB; fg: RGB }
) {
  const w = textWidth(label, 8, true) + 16;
  page.roundRect(cx - w / 2, y + 11, w, 16, 4, colors.bg);
  page.text(label, cx, y + 22.5, { size: 8, bold: true, color: colors.fg, align: 'center' });
}

/* ---------- main ---------- */

export async function downloadOrdersPdf(orders: Order[], fileName?: string): Promise<void> {
  const logo = await loadLogo();
  const pages: PdfPage[] = [];

  // First page header
  let page = new PdfPage();
  pages.push(page);

  if (logo) {
    const h = 40;
    page.image(MARGIN, 30, (logo.w / logo.h) * h, h);
  } else {
    page.text('Magnify', MARGIN, 56, { size: 20, bold: true, color: C.blue });
  }

  const times = orders
    .map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  const period = times.length
    ? `${fmtDate(new Date(Math.min(...times)))} - ${fmtDate(new Date(Math.max(...times)))}`
    : '-';
  page.text(`Period: ${period}`, RIGHT, 44, { size: 8.5, color: [0.39, 0.45, 0.55], align: 'right' });
  page.text(`Generated: ${new Date().toLocaleString('en-GB')}`, RIGHT, 57, {
    size: 8.5,
    color: [0.39, 0.45, 0.55],
    align: 'right',
  });

  page.text('ORDER DETAILS', PAGE_W / 2, 100, { size: 18, bold: true, color: C.blue, align: 'center' });
  page.line(MARGIN, 112, RIGHT, 112, C.rule, 1.6);

  let y = 116;
  drawBand(page, y);
  y += BAND_H;

  let total = 0;
  for (const o of orders) {
    if (y + ROW_H > BOTTOM_LIMIT) {
      page = new PdfPage();
      pages.push(page);
      y = 40;
      drawBand(page, y);
      y += BAND_H;
    }

    const status = String(o.status || 'pending').toLowerCase();
    const pay = String(o.paymentStatus || 'pending').toLowerCase();
    const amount = Number(o.totalValue || 0);
    total += amount;

    page.text(fit(o.orderId || '-', 9, true, COL.orderW), COL.order, y + 16, {
      size: 9,
      bold: true,
      color: C.blue,
    });
    page.text(fit(o.customerName || '-', 9, true, COL.orderW), COL.order, y + 29, {
      size: 9,
      bold: true,
    });

    const destination = o.district || o.city || o.shippingAddress || '-';
    page.text(fit(destination, 9, true, COL.destW), COL.dest, y + 16, { size: 9, bold: true });
    page.text(fit(o.phone || '-', 8.5, false, COL.destW), COL.dest, y + 29, {
      size: 8.5,
      color: C.muted,
    });

    badge(page, pay === 'pending' ? 'Unpaid' : cap(pay), COL.pay, y, PAY_COLORS[pay] || PAY_COLORS.pending);
    badge(page, cap(status), COL.status, y, STATUS_COLORS[status] || STATUS_COLORS.pending);

    page.text('LKR', COL.amountRight, y + 16, { size: 9, bold: true, align: 'right' });
    page.text(amount.toLocaleString('en-US'), COL.amountRight, y + 29, {
      size: 9,
      bold: true,
      align: 'right',
    });

    y += ROW_H;
    page.line(MARGIN, y, RIGHT, y, C.rowLine, 0.7);
  }

  if (y + 30 > BOTTOM_LIMIT) {
    page = new PdfPage();
    pages.push(page);
    y = 40;
  }
  page.text(`Total: LKR ${total.toLocaleString('en-US')}`, COL.amountRight, y + 22, {
    size: 10,
    bold: true,
    align: 'right',
  });

  // Footers
  pages.forEach((p, i) => {
    p.text(`Page ${i + 1} / ${pages.length}`, RIGHT, PAGE_H - 24, {
      size: 8,
      color: C.muted,
      align: 'right',
    });
  });

  /* ----- assemble the PDF file ----- */
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];
  const push = (d: string | Uint8Array) => {
    const b = typeof d === 'string' ? toBytes(d) : d;
    chunks.push(b);
    offset += b.length;
  };
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = offset;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n');
  const pageObj = (i: number) => 6 + i * 2;
  const totalObjects = 5 + pages.length * 2;

  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(
    2,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages
      .map((_, i) => `${pageObj(i)} 0 R`)
      .join(' ')}] >>`
  );
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  if (logo) {
    obj(5, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`
      );
      push(logo.bytes);
      push('\nendstream');
    });
  } else {
    obj(5, 'null');
  }

  pages.forEach((p, i) => {
    const content = p.ops.join('\n');
    obj(
      pageObj(i),
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(PAGE_W)} ${f(PAGE_H)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${logo ? ' /XObject << /Im1 5 0 R >>' : ''} >> ` +
        `/Contents ${pageObj(i) + 1} 0 R >>`
    );
    obj(pageObj(i) + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  const xrefAt = offset;
  push(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= totalObjects; n++) {
    push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  const blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `order-details_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
