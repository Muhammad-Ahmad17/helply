import { pipeline } from "@huggingface/transformers";

const MODEL = process.env.EMBED_MODEL ?? "Xenova/bge-small-en-v1.5";
const DIM = 384;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loading: Promise<any> | null = null;

export async function getExtractor() {
  if (extractor) return extractor;
  if (!loading) {
    loading = pipeline("feature-extraction", MODEL, { dtype: "q8" });
  }
  extractor = await loading;
  return extractor;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const pipe = await getExtractor();
  const out: number[][] = [];

  for (const text of texts) {
    const result = await pipe(text, { pooling: "mean", normalize: true });
    const data = result.data as Float32Array | number[];
    const arr = Array.from(data);
    if (arr.length !== DIM) {
      throw new Error(`Expected ${DIM} dims, got ${arr.length}`);
    }
    out.push(arr);
  }

  return out;
}

export const EMBEDDING_DIM = DIM;
