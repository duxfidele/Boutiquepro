import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface ExportPdfOptions {
  filename: string;
  widthPx?: number;
  pdfFormat?: [number, number] | "a4";
  orientation?: "portrait" | "landscape";
  scale?: number;
}

export async function exportElementToPdf(
  element: HTMLElement,
  options: ExportPdfOptions
): Promise<void> {
  let clone: HTMLElement | null = null;
  try {
    const targetWidth = options.widthPx || element.offsetWidth || 320;
    clone = element.cloneNode(true) as HTMLElement;
    
    // Positionner le clone en dehors de l'écran visible mais avec opacité pleine (100% visible pour html2canvas)
    clone.style.position = "fixed";
    clone.style.left = "-9999px";
    clone.style.top = "0px";
    clone.style.width = `${targetWidth}px`;
    clone.style.maxWidth = "none";
    clone.style.height = "auto";
    clone.style.overflow = "visible";
    clone.style.zIndex = "-9999";
    clone.style.opacity = "1";
    clone.style.visibility = "visible";
    clone.style.backgroundColor = "#ffffff";
    clone.style.color = "#000000";

    const images = clone.querySelectorAll("img");
    images.forEach((img) => {
      img.crossOrigin = "anonymous";
    });

    document.body.appendChild(clone);
    // Laisser le temps au DOM et aux styles de se calculer
    await new Promise((resolve) => setTimeout(resolve, 150));

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(clone, {
        scale: options.scale ?? 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: targetWidth,
        logging: false,
      });
    } catch (corsErr) {
      console.warn("Retrying html2canvas without images due to CORS issue:", corsErr);
      const imgs = clone.querySelectorAll("img");
      imgs.forEach((img) => img.remove());
      canvas = await html2canvas(clone, {
        scale: options.scale ?? 2,
        useCORS: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: targetWidth,
        logging: false,
      });
    }

    const imgData = canvas.toDataURL("image/png");
    const isA4 = options.pdfFormat === "a4";

    if (isA4) {
      const pdf = new jsPDF({
        orientation: options.orientation || "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", margin, margin, contentWidth, Math.min(pageHeight - (margin * 2), contentHeight));
      pdf.save(options.filename);
    } else {
      // Format ticket de caisse (largeur 80mm standard, hauteur calculée dynamiquement)
      const ticketWidth = 80;
      const ticketHeight = Math.max(100, Math.round((canvas.height * ticketWidth) / canvas.width) + 10);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [ticketWidth, ticketHeight],
      });
      const imgHeight = (canvas.height * ticketWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 4, ticketWidth, imgHeight);
      pdf.save(options.filename);
    }
  } finally {
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
  }
}
