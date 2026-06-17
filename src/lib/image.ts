/**
 * 브라우저 이미지 유틸 (클라에서만 호출 — createImageBitmap/canvas 사용).
 * server-only 아님: 순수 함수이며 server action 호출 전 dataURL 생성에 쓰인다.
 */

/** 긴 변 ~1280px / JPEG ~0.8 로 리사이즈 후 dataURL (P1-40). */
export async function resizeToDataUrl(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.8);
}
