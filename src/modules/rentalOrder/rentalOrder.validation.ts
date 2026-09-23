import { z } from "zod";

const rentalOrderItemSchema = z.object({
  gearItemId: z.string().min(1, "Gear item ID is required"),

  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than 0"),
});

const createRentalOrderSchema = z
  .object({
    startDate: z.string().datetime("Start date must be a valid date"),

    endDate: z.string().datetime("End date must be a valid date"),

    items: z
      .array(rentalOrderItemSchema)
      .min(1, "At least one gear item is required"),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

  const updateRentalOrderSchema = z.object({
    status: z.enum(
      ["PICKED_UP", "RETURNED", "CANCELLED"],
      "Status must be PICKED_UP, RETURNED, or CANCELLED",
    ),
  });

export const rentalOrderValidation = {
  createRentalOrderSchema,
  updateRentalOrderSchema
};
