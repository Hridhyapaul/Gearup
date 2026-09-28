import { Router } from "express";

import { auth } from "../../middlewares/auth.js";
import { UserRole } from "../../generated/prisma/enums.js";

import { paymentController } from "./payment.controller.js";

const router = Router();

router.post("/", auth(UserRole.CUSTOMER), paymentController.createPayment);

router.post(
  "/stripe-checkout",
  auth(UserRole.CUSTOMER),
  paymentController.createStripeCheckoutSession,
);

router.get(
  "/:paymentId",
  auth(UserRole.CUSTOMER, UserRole.ADMIN),
  paymentController.getPaymentById,
);

router.get(
  "/",
  auth(UserRole.CUSTOMER, UserRole.ADMIN),
  paymentController.getAllPayments,
);

export const paymentRoutes = router;
