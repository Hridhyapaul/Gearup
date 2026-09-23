import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  role: z
    .enum(
      ["CUSTOMER", "PROVIDER", "ADMIN"],
      "Role must be CUSTOMER, PROVIDER, or ADMIN",
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export const userValidation = {
  updateUserSchema,
};
