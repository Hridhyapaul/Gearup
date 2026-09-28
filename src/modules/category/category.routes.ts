import { Router } from "express";
import { categoryController } from "./category.controller.js";
import { auth } from "../../middlewares/auth.js";
import { UserRole } from "../../generated/prisma/enums.js";


const router = Router();

router.post("/", auth(UserRole.ADMIN), categoryController.createCategory);
router.get("/", categoryController.getAllCategories);
router.get("/:categoryId", categoryController.getCategoryById);
router.patch("/:categoryId", auth(UserRole.ADMIN) , categoryController.updateCategory);
router.delete("/:categoryId", auth(UserRole.ADMIN) , categoryController.deleteCategory);

export const categoryRoutes = router;
