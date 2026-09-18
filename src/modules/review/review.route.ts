import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums";
import { auth } from "../../middlewares/auth";
import { reviewController } from "./review.controller";

const router = Router();

router.post(
  "/",
  auth(UserRole.CUSTOMER),
  reviewController.createReview,
);

export const reviewRoutes = router;
