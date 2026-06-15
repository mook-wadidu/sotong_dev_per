/**
 * 클라이언트 이미지 리사이즈 — 긴 변 ~1280px, JPEG 0.8 로 줄여 dataURL 반환.
 * 업로드 페이로드 폭발을 막기 위해 인테이크 사진은 반드시 이걸 거친다(FEEDBACK §6 / P1-40).
 */
const MAX_EDGE = 1280;
const QUALITY = 0.8;

export async function resizeImageToDataUrl(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;
  const longEdge = Math.max(width, height);
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari 등 일부 포맷에서 실패 → <img> 폴백
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}
