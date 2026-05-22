// Text chunking for RAG. Splits long text into ~500-token chunks with
// ~50-token overlap so that semantic boundaries (sentences, paragraphs)
// are preserved and information at chunk edges isn't lost.
//
// We approximate tokens as words * 1.3 (English avg). Good enough for chunking;
// the LLM/embedding side counts real tokens.

const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const WORDS_PER_TOKEN = 0.77; // ≈ 1 / 1.3

function tokensToWords(t: number) {
  return Math.floor(t / WORDS_PER_TOKEN);
}

const TARGET_WORDS = tokensToWords(TARGET_TOKENS); // ~650
const OVERLAP_WORDS = tokensToWords(OVERLAP_TOKENS); // ~65

export interface Chunk {
  content: string;
  tokenCount: number;
}

export function chunkText(text: string): Chunk[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;

  const flush = () => {
    if (bufferWords === 0) return;
    const content = buffer.join("\n\n").trim();
    if (content) {
      chunks.push({
        content,
        tokenCount: Math.ceil(bufferWords / WORDS_PER_TOKEN),
      });
    }
  };

  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (bufferWords + words.length > TARGET_WORDS && bufferWords > 0) {
      flush();
      const tail = buffer.join(" ").split(/\s+/).slice(-OVERLAP_WORDS);
      buffer = tail.length > 0 ? [tail.join(" ")] : [];
      bufferWords = tail.length;
    }

    if (words.length > TARGET_WORDS) {
      for (let i = 0; i < words.length; i += TARGET_WORDS - OVERLAP_WORDS) {
        const slice = words.slice(i, i + TARGET_WORDS);
        chunks.push({
          content: slice.join(" "),
          tokenCount: Math.ceil(slice.length / WORDS_PER_TOKEN),
        });
      }
      buffer = [];
      bufferWords = 0;
      continue;
    }

    buffer.push(words.join(" "));
    bufferWords += words.length;
  }

  flush();
  return chunks;
}
