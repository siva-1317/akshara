import express from "express";
import { downloadCertificatePdf, getMyCertificates } from "../controllers/certificateController.js";

const router = express.Router();

router.get("/certificates", getMyCertificates);
router.get("/certificates/:certificateId/pdf", downloadCertificatePdf);

export default router;

