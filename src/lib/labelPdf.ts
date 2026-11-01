/**
 * Draws the shipping label (same design as the on-screen preview) on a canvas and saves it as a PDF.
 * Dependency-free: the canvas is exported as a JPEG and wrapped in a one-page PDF.
 */

export interface LabelData {
  orderId: string;
  customerName: string;
  phone: string;
  addressLines: string[]; // up to 3 lines
}

const W = 780;
const H = 455;
const SCALE = 3;

const FROM = {
  company: 'Magnify (Pvt) Ltd',
  lines: ['125A, KKS Road', 'Kokuvil Junction', 'Jaffna, Sri Lanka'],
  phone: '+94 75 391 2534',
  email: 'magnifyofficials@gmail.com',
};

type Ctx = CanvasRenderingContext2D;

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Black rounded box with a white symbol (24x24 icon space, offset 8px), like the on-screen icons. */
function icon(c: Ctx, x: number, y: number, draw: (c: Ctx) => void) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#000';
  rr(c, 0, 0, 40, 40, 9);
  c.fill();
  c.translate(8, 8);
  draw(c);
  c.restore();
}
const stroke = (c: Ctx, paths: string[]) => {
  c.strokeStyle = '#fff';
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  paths.forEach((d) => c.stroke(new Path2D(d)));
};
const fill = (c: Ctx, d: string) => {
  c.fillStyle = '#fff';
  c.fill(new Path2D(d));
};

const ICONS = {
  box: (c: Ctx) =>
    stroke(c, ['M12 3L3.5 7.5V16.5L12 21L20.5 16.5V7.5L12 3Z', 'M12 12L20.5 7.5', 'M12 12V21', 'M12 12L3.5 7.5']),
  building: (c: Ctx) => {
    c.fillStyle = '#fff';
    rr(c, 3, 3, 18, 18, 2);
    c.fill();
    c.fillStyle = '#000';
    [[6, 6], [14.5, 6], [6, 11], [14.5, 11]].forEach(([x, y]) => {
      rr(c, x, y, 3.5, 3, 0.5);
      c.fill();
    });
    c.fill(new Path2D('M9.5 21V17C9.5 15.6193 10.6193 14.5 12 14.5C13.3807 14.5 14.5 15.6193 14.5 17V21H9.5Z'));
  },
  phone: (c: Ctx) =>
    fill(c, 'M6.62 10.79C8.06 13.62 10.38 15.94 13.21 17.38L15.41 15.18C15.69 14.9 16.08 14.82 16.43 14.94C17.55 15.31 18.76 15.51 20 15.51C20.55 15.51 21 15.96 21 16.51V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z'),
  mail: (c: Ctx) =>
    fill(c, 'M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z'),
  pin: (c: Ctx) =>
    fill(c, 'M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z'),
  user: (c: Ctx) =>
    fill(c, 'M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z'),
  home: (c: Ctx) => fill(c, 'M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z'),
};

function fit(c: Ctx, text: string, maxW: number): string {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderLabel(d: LabelData): Promise<HTMLCanvasElement> {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts are optional */
  }
  const family = `${getComputedStyle(document.body).fontFamily || ''}, Arial, Helvetica, sans-serif`;
  const font = (weight: number | string, size: number, mono = false) =>
    `${weight} ${size}px ${mono ? "'Courier New', monospace" : family}`;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas is not supported in this browser.');
  c.scale(SCALE, SCALE);
  c.fillStyle = '#fff';
  c.fillRect(0, 0, W, H);

  // Outer border
  c.strokeStyle = '#000';
  c.lineWidth = 3;
  rr(c, 1.5, 1.5, W - 3, H - 3, 16);
  c.stroke();
  c.save();
  rr(c, 1.5, 1.5, W - 3, H - 3, 16);
  c.clip();

  const HEAD = 94;
  // Header rule + column divider
  c.fillStyle = '#000';
  c.fillRect(0, HEAD - 1.5, W, 3);
  c.fillRect(W / 2 - 1.5, HEAD, 3, H - HEAD);

  // Logo
  const logo = await loadImage('/magnify-logo.png');
  if (logo) {
    const bw = 170;
    const bh = 56;
    const s = Math.min(bw / logo.width, bh / logo.height);
    c.drawImage(logo, 20, (HEAD - logo.height * s) / 2, logo.width * s, logo.height * s);
  }

  // Title
  c.fillStyle = '#000';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.font = font(900, 29);
  (c as unknown as { letterSpacing: string }).letterSpacing = '1.5px';
  c.fillText('SHIPPING LABEL', W / 2, 45);
  (c as unknown as { letterSpacing: string }).letterSpacing = '0px';
  c.font = font(600, 13);
  c.fillText('www.magnifycreation.lk', W / 2, 66);

  // Order no. box
  const bx = W - 20 - 150;
  c.strokeStyle = '#000';
  c.lineWidth = 2.5;
  rr(c, bx, 17, 150, 58, 12);
  c.stroke();
  c.textAlign = 'left';
  c.font = font(900, 11);
  c.fillText('ORDER NO.', bx + 16, 40);
  c.font = font(900, 16, true);
  c.fillText(fit(c, d.orderId, 120), bx + 16, 62);

  const pill = (x: number, y: number, label: string) => {
    c.font = font(900, 14);
    (c as unknown as { letterSpacing: string }).letterSpacing = '1px';
    const w = c.measureText(label).width + 40;
    c.fillStyle = '#000';
    rr(c, x, y + 2, w, 36, 8);
    c.fill();
    c.fillStyle = '#fff';
    c.textBaseline = 'middle';
    c.fillText(label, x + 20, y + 21);
    c.textBaseline = 'alphabetic';
    (c as unknown as { letterSpacing: string }).letterSpacing = '0px';
  };

  // ---- LEFT: FROM
  const lx = 24;
  const t0 = HEAD + 26;
  icon(c, lx, t0, ICONS.box);
  pill(lx + 48, t0, 'FROM (SENDER)');

  const comp = t0 + 68;
  icon(c, lx, comp, ICONS.building);
  c.fillStyle = '#000';
  c.font = font(900, 18);
  c.fillText(FROM.company, lx + 52, comp + 17);
  c.font = font(600, 14);
  FROM.lines.forEach((l, i) => c.fillText(l, lx + 52, comp + 40 + i * 20));

  const ph = comp + 112;
  icon(c, lx, ph, ICONS.phone);
  c.font = font(900, 16);
  c.fillText(FROM.phone, lx + 52, ph + 26);

  const ml = ph + 62;
  icon(c, lx, ml, ICONS.mail);
  c.font = font(900, 14);
  c.fillText(FROM.email, lx + 52, ml + 25);

  // ---- RIGHT: TO
  const rx = W / 2 + 24;
  const textX = rx + 52;
  const textW = W - 24 - textX;
  icon(c, rx, t0, ICONS.pin);
  pill(rx + 48, t0, 'TO (DELIVERY ADDRESS)');

  const dotted = (y: number) => {
    c.save();
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.setLineDash([2, 3]);
    c.beginPath();
    c.moveTo(textX, y);
    c.lineTo(textX + textW, y);
    c.stroke();
    c.restore();
  };

  const name = comp;
  icon(c, rx, name, ICONS.user);
  c.fillStyle = '#000';
  c.font = font(900, 16);
  c.fillText(fit(c, d.customerName || '-', textW), textX, name + 22);
  dotted(name + 30);

  const phn = name + 64;
  icon(c, rx, phn, ICONS.phone);
  c.font = font(900, 16);
  c.fillText(fit(c, d.phone || '+94 7X XXX XXXX', textW), textX, phn + 22);
  dotted(phn + 30);

  const adr = phn + 64;
  icon(c, rx, adr + 22, ICONS.home);
  c.font = font(900, 14);
  for (let i = 0; i < 3; i++) {
    const y = adr + i * 30;
    c.fillText(fit(c, d.addressLines[i] ?? '', textW), textX, y + 20);
    dotted(y + 28);
  }

  c.restore();
  return canvas;
}

/** One-page PDF with a single JPEG image. Sizes are in PDF points. */
function jpegToPdf(jpeg: Uint8Array, wPx: number, hPx: number, pageW: number, pageH: number, margin: number): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (d: string | Uint8Array) => {
    const b = typeof d === 'string' ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach((b) => push(b));
    push('\nendobj\n');
  };
  const drawW = pageW - margin * 2;
  const drawH = (drawW * hPx) / wPx;
  const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${margin} ${(pageH - margin - drawH).toFixed(2)} cm /Im0 Do Q`;

  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(5, [
    enc.encode(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    enc.encode('\nendstream'),
  ]);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

export async function downloadShippingLabelPdf(data: LabelData, fileName: string): Promise<void> {
  const canvas = await renderLabel(data);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95));
  if (!blob) throw new Error('Could not create the label image.');
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const mm = 2.8346; // points per mm
  const pageW = 190 * mm;
  const pageH = (pageW - 20 * mm) * (H / W) + 20 * mm;
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, Math.round(pageW), Math.round(pageH), 10 * mm);
  const url = URL.createObjectURL(pdf);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
