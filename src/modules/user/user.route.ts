import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums";
import { auth } from "../../middlewares/auth";
import { userController } from "./user.controller";

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
