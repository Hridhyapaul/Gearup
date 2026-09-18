import { z } from "zod";

const createReviewSchema = z.object({
  gearItemId: z.string().min(1, "Gear item ID is required"),
  rating: z
    .number()
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .optional(),
});

export const reviewValidation = {
  createReviewSchema,
};
