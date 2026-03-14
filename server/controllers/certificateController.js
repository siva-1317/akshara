import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "../config/supabase.js";

const isMissingTableError = (error, tableName) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const target = String(tableName || "").toLowerCase();

  return (
    error.code === "PGRST205" ||
    message.includes(`table 'public.${target}'`) ||
    details.includes(`table 'public.${target}'`)
  );
};

const safeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const resolveLogoPath = () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");
  const candidates = [
    path.resolve(repoRoot, "client", "src", "assets", "akshara.png"),
    path.resolve(repoRoot, "client", "dist", "assets", "akshara.png"),
    path.resolve(repoRoot, "client", "public", "akshara.png"),
    path.resolve(process.cwd(), "client", "src", "assets", "akshara.png"),
    path.resolve(process.cwd(), "client", "dist", "assets", "akshara.png"),
    path.resolve(process.cwd(), "client", "public", "akshara.png"),
    path.resolve(process.cwd(), "src", "assets", "akshara.png"),
    path.resolve(process.cwd(), "dist", "assets", "akshara.png")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const fitFontSize = ({ doc, text, maxWidth, maxSize = 34, minSize = 18, font = "Helvetica-Bold" }) => {
  const cleaned = safeText(text);
  if (!cleaned) {
    return minSize;
  }

  doc.font(font);
  for (let size = maxSize; size >= minSize; size -= 1) {
    doc.fontSize(size);
    if (doc.widthOfString(cleaned) <= maxWidth) {
      return size;
    }
  }

  return minSize;
};

const truncateText = ({ doc, text, maxWidth, suffix = "…" }) => {
  const cleaned = safeText(text);
  if (!cleaned) {
    return "";
  }

  if (doc.widthOfString(cleaned) <= maxWidth) {
    return cleaned;
  }

  const safeSuffix = String(suffix || "").trim() || "";
  let lo = 0;
  let hi = cleaned.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${cleaned.slice(0, mid)}${safeSuffix}`;
    if (doc.widthOfString(candidate) <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return `${cleaned.slice(0, lo)}${safeSuffix}`;
};

const drawCornerOrnament = (doc, x, y, size, variant = "tl") => {
  const s = size;
  const thickness = 2.2;
  const accent = "#ff6a00";

  doc.save();
  doc.lineWidth(thickness);
  doc.strokeColor(accent);
  doc.fillColor(accent);
  doc.opacity(0.22);

  const horizontalDir = variant.endsWith("r") ? -1 : 1;
  const verticalDir = variant.startsWith("b") ? -1 : 1;

  doc
    .moveTo(x, y + verticalDir * s * 0.38)
    .lineTo(x, y)
    .lineTo(x + horizontalDir * s * 0.38, y)
    .stroke();

  doc
    .circle(x + horizontalDir * s * 0.12, y + verticalDir * s * 0.12, s * 0.08)
    .fillAndStroke();

  doc
    .circle(x + horizontalDir * s * 0.22, y + verticalDir * s * 0.22, s * 0.04)
    .fillAndStroke();

  doc.opacity(1);
  doc.restore();
};

const drawCertificatePdf = ({ doc, certificate, meta }) => {
  const primary = "#ff6a00";
  const indigo = "#6f5bff";
  const ink = "#1b1226";
  const muted = "#5d5568";

  const w = doc.page.width;
  const h = doc.page.height;
  const margin = doc.page.margins.left;

  const frameX = margin;
  const frameY = margin;
  const frameW = w - margin * 2;
  const frameH = h - margin * 2;

  const logoPath = resolveLogoPath();

  // Background
  doc.save();
  doc.rect(0, 0, w, h).fill("#fff7f0");

  const glow = doc.radialGradient(w * 0.28, h * 0.28, 10, w * 0.28, h * 0.28, h * 0.75);
  glow.stop(0, primary, 0.18).stop(0.6, primary, 0.03).stop(1, primary, 0);
  doc.rect(0, 0, w, h).fill(glow);

  const glow2 = doc.radialGradient(w * 0.78, h * 0.25, 10, w * 0.78, h * 0.25, h * 0.7);
  glow2.stop(0, indigo, 0.12).stop(0.55, indigo, 0.03).stop(1, indigo, 0);
  doc.rect(0, 0, w, h).fill(glow2);
  doc.restore();

  // Frame
  doc.save();
  doc
    .roundedRect(frameX, frameY, frameW, frameH, 18)
    .lineWidth(3)
    .strokeColor(primary, 0.55)
    .stroke();

  doc
    .roundedRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20, 14)
    .lineWidth(1.4)
    .dash(6, { space: 6 })
    .strokeColor(indigo, 0.35)
    .stroke()
    .undash();

  drawCornerOrnament(doc, frameX + 18, frameY + 18, 54, "tl");
  drawCornerOrnament(doc, frameX + frameW - 18, frameY + 18, 54, "tr");
  drawCornerOrnament(doc, frameX + 18, frameY + frameH - 18, 54, "bl");
  drawCornerOrnament(doc, frameX + frameW - 18, frameY + frameH - 18, 54, "br");

  doc.restore();

  // Watermark
  doc.save();
  doc.opacity(0.055);
  doc.fillColor(primary);
  doc.fontSize(120).font("Helvetica-Bold");
  doc.text("AKSHARA", 0, h * 0.38, { align: "center" });
  doc.opacity(1);
  doc.restore();

  // Content
  const recipient = safeText(meta.recipientName || meta.name || "Learner");
  const testTitle = safeText(certificate?.task?.title || meta.testTitle || "AKSHARA Test");
  const scoreValue = meta.score != null ? safeText(`${meta.score}%`) : "";
  const issuedAt = certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : "";
  const certificateId = safeText(certificate.id);

  // Header row
  const headerY = frameY + 26;
  doc.save();
  if (logoPath) {
    try {
      doc.image(logoPath, frameX + 30, headerY - 4, { width: 44, height: 44 });
    } catch {
      // Ignore logo if image parsing fails.
    }
  }
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(16).text("AKSHARA", frameX + 84, headerY + 4);
  doc.fillColor(muted).font("Helvetica").fontSize(9).text("AI Powered Test & Learning Portal", frameX + 84, headerY + 24);

  doc.fillColor(muted).font("Helvetica").fontSize(9).text(`Issued: ${issuedAt || "—"}`, frameX, headerY + 10, {
    width: frameW - 34,
    align: "right"
  });
  doc.restore();

  // Title block (center)
  doc.save();
  doc.fillColor(indigo).opacity(0.18);
  doc.roundedRect(frameX + 90, frameY + 88, frameW - 180, 54, 14).fill();
  doc.opacity(1);

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(30).text("Certificate of Completion", frameX, frameY + 98, {
    width: frameW,
    align: "center"
  });
  doc.restore();

  // Recipient
  doc.save();
  doc.fillColor(muted).font("Helvetica").fontSize(12).text("Presented to", frameX, frameY + 172, {
    width: frameW,
    align: "center"
  });

  const recipientFontSize = fitFontSize({
    doc,
    text: recipient,
    maxWidth: frameW - 160,
    maxSize: 34,
    minSize: 20,
    font: "Helvetica-Bold"
  });

  doc.fillColor(primary).font("Helvetica-Bold").fontSize(recipientFontSize).text(recipient, frameX + 80, frameY + 192, {
    width: frameW - 160,
    align: "center"
  });

  // Divider
  doc
    .moveTo(frameX + frameW * 0.22, frameY + 245)
    .lineTo(frameX + frameW * 0.78, frameY + 245)
    .lineWidth(1.2)
    .strokeColor(primary, 0.22)
    .stroke();
  doc.restore();

  // Body
  doc.save();
  doc.fillColor(ink).font("Helvetica").fontSize(13);
  doc.text(`For successfully completing "${testTitle}" on AKSHARA.`, frameX + 90, frameY + 264, {
    width: frameW - 180,
    align: "center",
    lineGap: 4
  });

  // Score pill
  const pillY = frameY + 318;
  const pillX = frameX + frameW / 2 - 130;
  const pillW = 260;
  const pillH = 44;
  doc.save();
  doc.fillColor(primary);
  doc.opacity(0.12);
  doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill();
  doc.opacity(1);
  doc
    .roundedRect(pillX, pillY, pillW, pillH, pillH / 2)
    .lineWidth(1.2)
    .strokeColor(primary, 0.32)
    .stroke();

  const pillPaddingX = 18;
  const labelW = 90;
  const valueW = pillW - pillPaddingX * 2 - labelW;
  const textY = pillY + 14;

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(14).text("Score", pillX + pillPaddingX, textY, {
    width: labelW,
    align: "left"
  });

  doc.fillColor(primary).font("Helvetica-Bold").fontSize(16).text(scoreValue || "-", pillX + pillPaddingX + labelW, pillY + 12, {
    width: valueW,
    align: "right"
  });
  doc.restore();

  // Footer verification row
  const footerY = frameY + frameH - 92;
  doc.save();
  doc
    .moveTo(frameX + 28, footerY - 14)
    .lineTo(frameX + frameW - 28, footerY - 14)
    .lineWidth(1)
    .strokeColor(indigo, 0.18)
    .stroke();

  doc.fillColor(muted).font("Helvetica").fontSize(10).text("Verification", frameX + 30, footerY);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(11).text(`Certificate ID: ${certificateId}`, frameX + 30, footerY + 16);

  const rightColX = frameX + frameW * 0.55;
  const rightColW = frameX + frameW - 30 - rightColX;

  doc.fillColor(muted).font("Helvetica").fontSize(10).text("Test", rightColX, footerY, {
    width: rightColW,
    align: "right"
  });

  doc.fillColor(ink).font("Helvetica-Bold").fontSize(11);
  const truncatedTitle = truncateText({ doc, text: testTitle, maxWidth: rightColW });
  doc.text(truncatedTitle, rightColX, footerY + 16, {
    width: rightColW,
    align: "right"
  });
  doc.restore();
};

export const getMyCertificates = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ message: "Missing user context." });
    }

    const { data, error } = await supabase
      .from("certificates")
      .select("id, published_test_id, issued_at, certificate_data, task:published_tests(title,topic)")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });

    if (isMissingTableError(error, "certificates")) {
      return res.json({ certificates: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ certificates: data || [] });
  } catch (error) {
    next(error);
  }
};

export const downloadCertificatePdf = async (req, res, next) => {
  try {
    const requesterUserId = req.headers["x-user-id"];
    const requesterRole = req.headers["x-user-role"];
    const { certificateId } = req.params;

    if (!certificateId) {
      return res.status(400).json({ message: "certificateId is required." });
    }

    const { data: certificate, error } = await supabase
      .from("certificates")
      .select("id, user_id, published_test_id, issued_at, certificate_data, task:published_tests(title,topic)")
      .eq("id", certificateId)
      .single();

    if (isMissingTableError(error, "certificates")) {
      return res.status(503).json({ message: "Certificates are not configured yet. Ask admin to run schema." });
    }

    if (error) {
      throw error;
    }

    const isOwner = requesterUserId && certificate.user_id === requesterUserId;
    const isAdmin = requesterRole === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const filenameBase = safeText(certificate?.task?.title || "certificate").replace(/[^a-z0-9-_ ]/gi, "");
    const filename = `${filenameBase || "certificate"}-${certificate.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 48 });
    doc.pipe(res);

    const meta = certificate.certificate_data || {};
    drawCertificatePdf({ doc, certificate, meta });

    doc.end();
  } catch (error) {
    next(error);
  }
};
