import { toPng } from "html-to-image";

// html2canvas can't parse the lab()/oklch() colors Tailwind v4 emits, so this
// renders through the browser (SVG foreignObject) instead.
export async function exportDivToPng(el: HTMLElement, filename: string) {
  const options = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true };
  // Safari can return a blank image on the first pass; the second is reliable.
  await toPng(el, options);
  const dataUrl = await toPng(el, options);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
}
