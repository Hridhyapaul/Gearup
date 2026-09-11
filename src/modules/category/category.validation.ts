import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters long"),
  slug: z.string().min(2, "Category slug must be at least 2 characters long"),
  description: z.string().optional(),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters long")
    .optional(),
  slug: z
    .string()
    .min(2, "Category slug must be at least 2 characters long")
    .optional(),
  description: z.string().optional(),
});

export const categoryValidation = {
  createCategorySchema,
  updateCategorySchema,
};
