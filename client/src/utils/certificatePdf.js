import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Brand colours (RGB) matching the design system.
const BRAND = [29, 78, 216];
const NAVY = [10, 22, 40];
const INK = [71, 85, 105];
const GOLD = [242, 183, 5];

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

/**
 * Build a landscape Letter "Certificate of Completion" and download it.
 * The QR encodes ONLY the public verify URL (passed in, no window dependency here).
 * @param {{ holder, course, code, finalScore, issuedAt, trainer, verifyUrl }} cert
 * @returns {Promise<jsPDF>} the generated doc (already saved via doc.save unless `save:false`)
 */
export async function generateCertificatePdf(cert, { save = true } = {}) {
  const { holder, course, code, finalScore, issuedAt, trainer, verifyUrl } = cert;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const center = W / 2;

  // Decorative border (double line).
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(4);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.rect(34, 34, W - 68, H - 68);

  // Brand header.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND);
  doc.text('VoiceLink Academy', center, 86, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('VoiceLink Solutions · Agent Training', center, 102, { align: 'center' });

  // Title.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...NAVY);
  doc.text('Certificate of Completion', center, 166, { align: 'center' });

  // Holder.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text('This certifies that', center, 212, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...BRAND);
  doc.text(holder || 'Agent', center, 252, { align: 'center' });

  // Course.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text('has successfully completed', center, 292, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(course || '', center, 320, { align: 'center', maxWidth: W - 160 });

  // Score + date.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(`Final score: ${finalScore}%        Issued: ${fmtDate(issuedAt)}`, center, 356, { align: 'center' });

  // Trainer signature block (bottom-left).
  const sigY = H - 96;
  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.line(90, sigY, 300, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(trainer || 'VoiceLink Academy', 195, sigY - 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('Trainer', 195, sigY + 14, { align: 'center' });

  // QR code (bottom-right) + code underneath.
  if (verifyUrl) {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 240, margin: 1 });
    const qrSize = 110;
    const qrX = W - 90 - qrSize;
    const qrY = H - 96 - qrSize + 10;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 14, { align: 'center' });
  }

  // Certificate code (centered, above the footer line).
  doc.setFont('courier', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(code || '', center, H - 70, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text('Certificate code', center, H - 56, { align: 'center' });

  if (save) doc.save(`VoiceLink-Certificate-${code}.pdf`);
  return doc;
}

export default generateCertificatePdf;
