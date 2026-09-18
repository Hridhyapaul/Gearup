import { z } from "zod";

const createPaymentSchema = z.object({
  rentalOrderId: z.string().min(1, "Rental order ID is required"),

  paymentMethod: z.enum(
    ["STRIPE", "SSLCOMMERZ"],
    "Payment method must be STRIPE or SSLCOMMERZ",
  ),
});

export const paymentValidation = {
  createPaymentSchema,
};
