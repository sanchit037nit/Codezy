import express from "express";
import { getContests, getContestGroup, joinGroup, postMessage } from "../controllers/contest.controller.js";
import { protectroute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getContests);
router.get("/group/:contestId", protectroute, getContestGroup);
router.post("/group/:contestId/join", protectroute, joinGroup);
router.post("/group/:contestId/message", protectroute, postMessage);

export default router;
