import { Router } from "express";
import { authController } from "./auth.controller.js";
import { auth } from "../../middlewares/auth.js";


const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", auth(), authController.getMe);

export const authRoutes = router;
