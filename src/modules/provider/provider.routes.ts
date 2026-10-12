import { Router } from "express";

import { auth } from "../../middlewares/auth.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { providerController } from "./provider.controller.js";

const router = Router();

router.get(
  "/orders",
  auth(UserRole.PROVIDER),
  providerController.getProviderOrders,
);

export const providerRoutes = router;
