import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { auth } from "../../middlewares/auth.js";
import { userController } from "./user.controller.js";

const router = Router();

router.get(
  "/",
  auth(UserRole.ADMIN),
  userController.getAllUsers,
);

router.get(
  "/:userId",
  auth(UserRole.ADMIN),
  userController.getUserById,
);

router.patch(
  "/:userId",
  auth(UserRole.ADMIN),
  userController.updateUser,
);

export const userRoutes = router;
