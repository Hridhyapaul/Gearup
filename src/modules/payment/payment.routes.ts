import { Router } from "express";

import { auth } from "../../middlewares/auth";
import { UserRole } from "../../generated/prisma/enums";

import { paymentController } from "./payment.controller";

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
