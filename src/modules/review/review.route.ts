import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { auth } from "../../middlewares/auth.js";
import { reviewController } from "./review.controller.js";

const router = Router();

router.post(
  "/",
  auth(UserRole.CUSTOMER),
  reviewController.createReview,
);

export const reviewRoutes = router;
