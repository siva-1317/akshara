import PDFDocument from "pdfkit";
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

    const meta = certificate.certificate_data || {};
    const recipient = safeText(meta.recipientName || meta.name || "Learner");
    const title = safeText(meta.title || "Certificate of Completion");
    const body =
      safeText(meta.body) ||
      `This certifies that ${recipient} has successfully completed the assessment: ${safeText(
        certificate?.task?.title || "AKSHARA Test"
      )}.`;
    const score = meta.score != null ? safeText(`${meta.score}%`) : "";
    const issuedAt = certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString() : "";
    const issuer = safeText(meta.issuer || "AKSHARA");

    const filenameBase = safeText(certificate?.task?.title || "certificate").replace(/[^a-z0-9-_ ]/gi, "");
    const filename = `${filenameBase || "certificate"}-${certificate.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 56 });
    doc.pipe(res);

    doc.fontSize(10).fillColor("#666").text(issuer.toUpperCase(), { align: "center" });
    doc.moveDown(0.6);

    doc.fontSize(26).fillColor("#111").text(title, { align: "center" });
    doc.moveDown(1.4);

    doc
      .fontSize(14)
      .fillColor("#111")
      .text("Presented to", { align: "center" });
    doc.moveDown(0.6);

    doc.fontSize(22).fillColor("#0b5ed7").text(recipient, { align: "center" });
    doc.moveDown(1.2);

    doc.fontSize(12).fillColor("#222").text(body, {
      align: "center",
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right
    });

    if (score) {
      doc.moveDown(1.4);
      doc.fontSize(12).fillColor("#111").text(`Score: ${score}`, { align: "center" });
    }

    doc.moveDown(2.2);
    doc.fontSize(10).fillColor("#444").text(`Issued on: ${issuedAt}`, { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#444").text(`Certificate ID: ${certificate.id}`, { align: "center" });

    doc.end();
  } catch (error) {
    next(error);
  }
};

