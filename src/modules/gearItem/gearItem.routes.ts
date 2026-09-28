import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { gearItemController } from "./gearItem.controller.js";

const router = Router();

router.post(
  "/",
  auth(UserRole.PROVIDER, UserRole.ADMIN),
  gearItemController.createGearItem,
);

router.get("/", gearItemController.getAllGearItems);

router.get("/:gearItemId", gearItemController.getGearItemById);

router.patch(
  "/:gearItemId",
  auth(UserRole.PROVIDER, UserRole.ADMIN),
  gearItemController.updateGearItem,
);

router.delete(
  "/:gearItemId",
  auth(UserRole.PROVIDER, UserRole.ADMIN),
  gearItemController.deleteGearItem,
);

export const gearItemRoutes = router;
