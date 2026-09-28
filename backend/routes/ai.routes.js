import express from "express";
import multer from "multer";
import { askAI, uploadPDF } from "../controllers/aicontroller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/ask", askAI);
router.post("/upload-pdf", upload.single("pdf"), uploadPDF);

export default router;