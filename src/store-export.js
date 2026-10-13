// Guardar lo dibujado: PNG de 24 bits, JPEG y un .zip con varias imágenes.
//
// El PNG se escribe aquí, a mano, porque el del navegador siempre lleva canal
// alfa (32 bits) y Google Play pide "PNG de 24 bits (sin alfa)".

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(...parts) {
  let crc = 0xffffffff;
  for (const bytes of parts) {
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const ascii = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0));

function pngChunk(type, data) {
  const head = new Uint8Array(8);
  const view = new DataView(head.buffer);
  view.setUint32(0, data.length);
  head.set(ascii(type), 4);
  const tail = new Uint8Array(4);
  new DataView(tail.buffer).setUint32(0, crc32(head.subarray(4), data));
  return [head, data, tail];
}

/** PNG RGB de 8 bits por canal, sin alfa. Cada fila usa el filtro que mejor comprime. */
export async function png24(canvas) {
  if (typeof CompressionStream === 'undefined') throw new Error('Este navegador no puede escribir PNG de 24 bits.');
  const { width: w, height: h } = canvas;
  const { data } = canvas.getContext('2d').getImageData(0, 0, w, h);
  const stride = w * 3;
  const raw = new Uint8Array((stride + 1) * h);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  const sub = new Uint8Array(stride);
  const up = new Uint8Array(stride);
  const paeth = new Uint8Array(stride);

  for (let y = 0; y < h; y++) {
    for (let x = 0, s = y * w * 4, d = 0; x < w; x++, s += 4, d += 3) {
      cur[d] = data[s];
      cur[d + 1] = data[s + 1];
      cur[d + 2] = data[s + 2];
    }
    let sumSub = 0;
    let sumUp = 0;
    let sumPaeth = 0;
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? cur[i - 3] : 0;
      const b = prev[i];
      const c = i >= 3 ? prev[i - 3] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const vs = (cur[i] - a) & 255;
      const vu = (cur[i] - b) & 255;
      const vp = (cur[i] - predicted) & 255;
      sub[i] = vs;
      up[i] = vu;
      paeth[i] = vp;
      sumSub += vs < 128 ? vs : 256 - vs;
      sumUp += vu < 128 ? vu : 256 - vu;
      sumPaeth += vp < 128 ? vp : 256 - vp;
    }
    const at = y * (stride + 1);
    if (sumUp <= sumSub && sumUp <= sumPaeth) {
      raw[at] = 2;
      raw.set(up, at + 1);
    } else if (sumSub <= sumPaeth) {
      raw[at] = 1;
      raw.set(sub, at + 1);
    } else {
      raw[at] = 4;
      raw.set(paeth, at + 1);
    }
    [prev, cur] = [cur, prev];
  }

  const packed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, w);
  view.setUint32(4, h);
  header[8] = 8; // bits por canal
  header[9] = 2; // color verdadero, sin alfa
  return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...pngChunk('IHDR', header), ...pngChunk('IDAT', packed), ...pngChunk('IEND', new Uint8Array(0))], { type: 'image/png' });
}

export function jpeg(canvas, quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear el JPEG.'))), 'image/jpeg', quality);
  });
}

/** El gráfico en el formato pedido. Si el PNG de 24 bits no es posible, cae a JPEG y lo dice. */
export async function encode(canvas, format) {
  if (format !== 'jpeg') {
    try {
      return { blob: await png24(canvas), ext: 'png' };
    } catch (err) {
      console.warn(err);
    }
  }
  return { blob: await jpeg(canvas), ext: 'jpg' };
}

/** Un .zip sin compresión (los PNG ya vienen comprimidos). `files`: [{ name, bytes }]. */
export function zip(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin comprimir
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, file.bytes);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
