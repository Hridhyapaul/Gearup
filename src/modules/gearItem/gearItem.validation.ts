import { z } from "zod";

const createGearItemSchema = z.object({
  name: z.string().min(2, "Gear item name must be at least 2 characters long"),

  slug: z.string().min(2, "Gear item slug must be at least 2 characters long"),

  description: z.string().optional(),

  pricePerDay: z.number().positive("Price per day must be greater than 0"),

  stock: z.number().int().positive("Stock must be greater than 0"),

  availableStock: z
    .number()
    .int()
    .nonnegative("Available stock cannot be negative"),

    image: z.url("Image must be a valid URL").optional(),

  categoryId: z.string().min(1, "Category ID is required"),
});

const updateGearItemSchema = z.object({
  name: z
    .string()
    .min(2, "Gear item name must be at least 2 characters long")
    .optional(),

  slug: z
    .string()
    .min(2, "Gear item slug must be at least 2 characters long")
    .optional(),

  description: z.string().optional(),

  pricePerDay: z
    .number()
    .positive("Price per day must be greater than 0")
    .optional(),

  stock: z
    .number()
    .int()
    .positive("Stock must be greater than 0")
    .optional(),

  availableStock: z
    .number()
    .int()
    .nonnegative("Available stock cannot be negative")
    .optional(),

  image: z.url("Image must be a valid URL").optional(),

  isAvailable: z.boolean().optional(),

  categoryId: z.string().min(1, "Category ID is required").optional(),
});

export const gearItemValidation = {
  createGearItemSchema,
  updateGearItemSchema,
};
