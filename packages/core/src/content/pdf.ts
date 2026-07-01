import { PDFParse } from "pdf-parse";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`PDF too large (max ${MAX_PDF_BYTES / 1024 / 1024} MB).`);
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\s+/g, " ").trim();
    if (!text) throw new Error("No extractable text found in PDF.");
    return text;
  } finally {
    await parser.destroy();
  }
}

export const MAX_PDF_SIZE = MAX_PDF_BYTES;
