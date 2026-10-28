/**
 * Dependency-free A4 portrait PDF generator for the Orders "Export PDF" button.
 * Builds the PDF file directly (standard Helvetica fonts + the Magnify logo as a JPEG)
 * and triggers an automatic download – no print dialog.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 34;
const RIGHT = PAGE_W - MARGIN;
const BOTTOM_LIMIT = PAGE_H - 46;
const CONTENT_W = PAGE_W - MARGIN * 2;

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

  polyline(pts: [number, number][], color: RGB, width: number) {
    if (pts.length < 2) return;
    const d = pts.map(([x, y], i) => `${f(x)} ${f(PAGE_H - y)} ${i ? 'l' : 'm'}`).join(' ');
    this.ops.push(`${stroke(color)} ${f(width)} w ${d} S`);
  }

  area(pts: [number, number][], baseY: number, color: RGB) {
    if (pts.length < 2) return;
    const d = pts.map(([x, y], i) => `${f(x)} ${f(PAGE_H - y)} ${i ? 'l' : 'm'}`).join(' ');
    const last = pts[pts.length - 1][0];
    this.ops.push(`${fill(color)} ${d} ${f(last)} ${f(PAGE_H - baseY)} l ${f(pts[0][0])} ${f(PAGE_H - baseY)} l h f`);
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


/* ---------- public model ---------- */

export type Tone = 'good' | 'bad' | 'warn' | 'info' | 'muted';
export type Cell = string | number | { text: string | number; tone?: Tone; bold?: boolean; sub?: string };

export interface ReportColumn {
  header: string;
  w: number; // relative width
  align?: 'left' | 'right' | 'center';
}

export type ReportBlock =
  | { type: 'stats'; items: { label: string; value: string; tone?: Tone }[] }
  | { type: 'section'; title: string }
  | { type: 'table'; columns: ReportColumn[]; rows: Cell[][]; totalRow?: Cell[]; empty?: string }
  | { type: 'bars'; items: { label: string; value: number; display: string; color?: string }[] }
  | { type: 'line'; labels: string[]; values: number[]; title?: string }
  | { type: 'summary'; title: string; rows: { label: string; value: string; tone?: Tone; bold?: boolean }[] };

export interface ReportDoc {
  title: string;
  period: string;
  fileName: string;
  blocks: ReportBlock[];
}

const C = {
  ink: hex('#0f172a'),
  muted: hex('#94a3b8'),
  head: hex('#475569'),
  blue: hex('#1d4ed8'),
  blueSoft: hex('#eff6ff'),
  band: hex('#f1f5f9'),
  rowLine: hex('#e2e8f0'),
  rule: hex('#1e293b'),
  white: hex('#ffffff'),
};
const TONE: Record<Tone, { fg: RGB; bg: RGB }> = {
  good: { fg: hex('#15803d'), bg: hex('#dcfce7') },
  bad: { fg: hex('#dc2626'), bg: hex('#fee2e2') },
  warn: { fg: hex('#b45309'), bg: hex('#fef3c7') },
  info: { fg: hex('#2563eb'), bg: hex('#dbeafe') },
  muted: { fg: hex('#475569'), bg: hex('#f1f5f9') },
};

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/* ---------- renderer ---------- */

export async function downloadReportPdf(doc: ReportDoc): Promise<void> {
  const logo = await loadLogo();
  const pages: PdfPage[] = [];
  let page = new PdfPage();
  pages.push(page);
  let y = 0;

  const drawHeader = (first: boolean) => {
    if (!first) {
      page.text(doc.title, MARGIN, 34, { size: 8, bold: true, color: C.muted });
      page.line(MARGIN, 40, RIGHT, 40, C.rowLine, 0.7);
      y = 54;
      return;
    }
    if (logo) {
      const h = 34;
      page.image(MARGIN, 28, (logo.w / logo.h) * h, h);
    } else {
      page.text('Magnify', MARGIN, 52, { size: 20, bold: true, color: C.blue });
    }
    page.text(`Period: ${doc.period}`, RIGHT, 40, { size: 8, color: [0.39, 0.45, 0.55], align: 'right' });
    page.text(`Generated: ${new Date().toLocaleString('en-GB')}`, RIGHT, 52, {
      size: 8,
      color: [0.39, 0.45, 0.55],
      align: 'right',
    });
    page.text(doc.title.toUpperCase(), PAGE_W / 2, 92, { size: 17, bold: true, color: C.blue, align: 'center' });
    page.line(MARGIN, 104, RIGHT, 104, C.rule, 1.4);
    y = 120;
  };
  drawHeader(true);

  const ensure = (h: number) => {
    if (y + h > BOTTOM_LIMIT) {
      page = new PdfPage();
      pages.push(page);
      drawHeader(false);
    }
  };

  for (const b of doc.blocks) {
    if (b.type === 'section') {
      ensure(40);
      y += 6;
      page.rect(MARGIN, y - 9, 3, 12, C.blue);
      page.text(b.title.toUpperCase(), MARGIN + 9, y, { size: 9, bold: true, color: C.blue });
      y += 12;
    }

    if (b.type === 'stats') {
      const n = b.items.length;
      const gap = 8;
      const w = (CONTENT_W - gap * (n - 1)) / n;
      ensure(52);
      b.items.forEach((it, i) => {
        const x = MARGIN + i * (w + gap);
        page.roundRect(x, y, w, 44, 6, C.blueSoft);
        page.text(it.label.toUpperCase(), x + 10, y + 16, { size: 7, bold: true, color: C.head });
        page.text(fit(it.value, 13, true, w - 20), x + 10, y + 34, {
          size: 13,
          bold: true,
          color: it.tone ? TONE[it.tone].fg : C.ink,
        });
      });
      y += 56;
    }

    if (b.type === 'summary') {
      ensure(30 + b.rows.length * 22);
      page.text(b.title.toUpperCase(), MARGIN, y + 8, { size: 8, bold: true, color: C.head });
      y += 16;
      b.rows.forEach((r) => {
        ensure(22);
        page.rect(MARGIN, y, CONTENT_W, 20, C.band);
        page.text(r.label, MARGIN + 10, y + 14, { size: 9, bold: r.bold, color: C.ink });
        page.text(r.value, RIGHT - 10, y + 14, {
          size: 9,
          bold: true,
          color: r.tone ? TONE[r.tone].fg : C.ink,
          align: 'right',
        });
        y += 23;
      });
      y += 6;
    }

    if (b.type === 'bars') {
      const max = Math.max(1, ...b.items.map((i) => i.value));
      const labelW = 120;
      const valW = 90;
      const trackW = CONTENT_W - labelW - valW - 10;
      b.items.forEach((it) => {
        ensure(22);
        page.text(fit(it.label, 8.5, true, labelW - 6), MARGIN, y + 11, { size: 8.5, bold: true });
        page.roundRect(MARGIN + labelW, y + 3, trackW, 9, 4, C.band);
        const w = Math.max(6, (it.value / max) * trackW);
        page.roundRect(MARGIN + labelW, y + 3, w, 9, 4, it.color ? hex(it.color) : C.blue);
        page.text(it.display, RIGHT, y + 11, { size: 8.5, bold: true, align: 'right' });
        y += 20;
      });
      y += 6;
    }

    if (b.type === 'line') {
      const H = 120;
      ensure(H + 40);
      if (b.title) {
        page.text(b.title, MARGIN, y + 8, { size: 8, bold: true, color: C.head });
        y += 14;
      }
      const left = MARGIN + 44;
      const w = CONTENT_W - 54;
      const max = Math.max(1, ...b.values) * 1.1;
      for (let g = 0; g <= 4; g++) {
        const gy = y + 6 + ((H - 20) * g) / 4;
        page.line(left, gy, left + w, gy, C.rowLine, 0.5);
        const v = max - (max * g) / 4;
        page.text(v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)), left - 6, gy + 3, {
          size: 7,
          color: C.muted,
          align: 'right',
        });
      }
      const n = b.values.length;
      const pts: [number, number][] = b.values.map((v, i) => [
        left + (n === 1 ? w / 2 : (i / (n - 1)) * w),
        y + 6 + (H - 20) * (1 - v / max),
      ]);
      page.area(pts, y + 6 + (H - 20), hex('#e8f0fe'));
      page.polyline(pts, C.blue, 1.6);
      const every = Math.max(1, Math.ceil(n / 8));
      b.labels.forEach((l, i) => {
        if (i % every === 0 || i === n - 1)
          page.text(l, pts[i][0], y + H + 2, { size: 7, color: C.muted, align: 'center' });
      });
      y += H + 16;
    }

    if (b.type === 'table') {
      const totalRel = b.columns.reduce((s, c) => s + c.w, 0);
      const widths = b.columns.map((c) => (c.w / totalRel) * (CONTENT_W - 16));
      const xs: number[] = [];
      let acc = MARGIN + 8;
      widths.forEach((w) => {
        xs.push(acc);
        acc += w;
      });
      const cellX = (i: number) => {
        const a = b.columns[i].align ?? 'left';
        return a === 'right' ? xs[i] + widths[i] - 6 : a === 'center' ? xs[i] + widths[i] / 2 : xs[i];
      };
      const head = () => {
        page.rect(MARGIN, y, CONTENT_W, 22, C.band);
        b.columns.forEach((c, i) =>
          page.text(c.header.toUpperCase(), cellX(i), y + 14, {
            size: 7,
            bold: true,
            color: C.head,
            align: c.align ?? 'left',
          })
        );
        y += 22;
      };
      const drawCell = (cell: Cell, i: number, ry: number, rowH: number, bold = false) => {
        const align = b.columns[i].align ?? 'left';
        const obj = typeof cell === 'object' ? cell : { text: cell };
        const text = String(obj.text ?? '');
        const maxW = widths[i] - 8;
        if (obj.tone) {
          const t = fit(text, 7.5, true, maxW - 10);
          const tw = textWidth(clean(t), 7.5, true) + 12;
          const cx = cellX(i);
          const px = align === 'right' ? cx - tw : align === 'center' ? cx - tw / 2 : cx;
          page.roundRect(px, ry + rowH / 2 - 7, tw, 14, 4, TONE[obj.tone].bg);
          page.text(t, px + tw / 2, ry + rowH / 2 + 3, { size: 7.5, bold: true, color: TONE[obj.tone].fg, align: 'center' });
          return;
        }
        if (obj.sub) {
          page.text(fit(text, 8.5, true, maxW), cellX(i), ry + 14, { size: 8.5, bold: true, align });
          page.text(fit(obj.sub, 7.5, false, maxW), cellX(i), ry + 25, { size: 7.5, color: C.muted, align });
        } else {
          page.text(fit(text, 8.5, !!(obj.bold || bold), maxW), cellX(i), ry + rowH / 2 + 3, {
            size: 8.5,
            bold: !!(obj.bold || bold),
            align,
          });
        }
      };

      ensure(60);
      head();
      if (!b.rows.length) {
        page.text(b.empty ?? 'No records for this period.', PAGE_W / 2, y + 24, { size: 9, color: C.muted, align: 'center' });
        y += 44;
      }
      for (const row of b.rows) {
        const rowH = row.some((c) => typeof c === 'object' && c.sub) ? 32 : 24;
        if (y + rowH > BOTTOM_LIMIT) {
          page = new PdfPage();
          pages.push(page);
          drawHeader(false);
          head();
        }
        row.forEach((c, i) => drawCell(c, i, y, rowH));
        y += rowH;
        page.line(MARGIN, y, RIGHT, y, C.rowLine, 0.6);
      }
      if (b.totalRow) {
        ensure(26);
        page.rect(MARGIN, y, CONTENT_W, 24, C.blueSoft);
        b.totalRow.forEach((c, i) => drawCell(c, i, y, 24, true));
        y += 24;
      }
      y += 12;
    }
  }

  pages.forEach((p, i) => {
    p.text('Magnify Creations - Confidential', MARGIN, PAGE_H - 24, { size: 7.5, color: C.muted });
    p.text(`Page ${i + 1} / ${pages.length}`, RIGHT, PAGE_H - 24, { size: 8, color: C.muted, align: 'right' });
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
  a.download = doc.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { fmtDate };
