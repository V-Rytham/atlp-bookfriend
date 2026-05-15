// Lightweight token estimator for chunk sizing.
// Keeps ingestion/runtime dependency-free and works well enough for 600–900 "token-ish" chunks.
export const estimateTokenCount = (text) => {
  const s = String(text || '').trim();
  if (!s) return 0;
  const words = s.split(/\s+/).filter(Boolean).length;
  // Empirical: English tokens are often ~0.75 words/token, i.e. tokens ≈ words * 1.33
  return Math.max(1, Math.round(words * 1.33));
};

