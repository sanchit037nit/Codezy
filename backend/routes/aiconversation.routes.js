import express from "express";

import {
    createConversation,
    getConversations,
    getConversation,
    deleteConversation,
     updateConversation,
} from "../controllers/aiconversation.controller.js";

import { protectroute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/",protectroute,createConversation);
router.get("/",protectroute,getConversations);
router.get( "/:id",protectroute,getConversation);
router.delete("/:id",protectroute,deleteConversation)
router.put("/:id",protectroute,updateConversation);

export default router;