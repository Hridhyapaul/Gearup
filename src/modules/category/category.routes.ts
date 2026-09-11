import { Router } from "express";
import { categoryController } from "./category.controller";


const router = Router();

router.post("/", categoryController.createCategory);
router.get("/", categoryController.getAllCategories);
router.get("/:categoryId", categoryController.getCategoryById);
router.patch("/:categoryId", categoryController.updateCategory);
router.delete("/:categoryId", categoryController.deleteCategory);

export const categoryRoutes = router;
