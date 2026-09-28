import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { rentalOrderController } from "./rentalOrder.controller.js";

const router = Router();

router.post(
  "/",
  auth(UserRole.CUSTOMER),
  rentalOrderController.createRentalOrder,
);

router.get(
  "/",
  auth(UserRole.CUSTOMER, UserRole.ADMIN),
  rentalOrderController.getAllRentalOrders,
);

router.get(
  "/:rentalOrderId",
  auth(UserRole.CUSTOMER, UserRole.ADMIN),
  rentalOrderController.getRentalOrderById,
);

router.patch(
  "/:rentalOrderId/status",
  auth(UserRole.PROVIDER, UserRole.ADMIN),
  rentalOrderController.updateRentalOrder,
);

export const rentalOrderRoutes = router;
