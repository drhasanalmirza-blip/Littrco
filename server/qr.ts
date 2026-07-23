import QRCode from "qrcode";

// Pure QR-matrix builder (PHASE3_SERVER.md §3.3). Encodes `text` as a QR code and
// packs its module matrix into a compact 1-bpp bitmap the HMI can blit directly.
//
// Packing: row-major, MSB-first, each row padded to a whole byte. Bit `col` of a
// row is module (row, col); the MSB (0x80) of a row's first byte is col 0. Rows
// start on byte boundaries, so a row of `size` modules occupies ceil(size/8) bytes.
//
// This module deliberately imports only the `qrcode` lib (no server/db.ts), so the
// unit test stays importable without DATABASE_URL.
export function qrMatrix(text: string): { size: number; modules: string } {
  const qr = QRCode.create(text);
  // qr.modules.data is a row-major Uint8Array of 0/1, length size*size.
  const { size, data } = qr.modules;
  const bytesPerRow = Math.ceil(size / 8);
  const packed = new Uint8Array(bytesPerRow * size);
  for (let row = 0; row < size; row++) {
    const rowBase = row * bytesPerRow;
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) {
        packed[rowBase + (col >> 3)] |= 0x80 >> (col & 7);
      }
    }
  }
  return { size, modules: Buffer.from(packed).toString("base64") };
}

export default qrMatrix;
