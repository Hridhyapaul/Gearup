import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import { notFound } from "./middlewares/notFound.js";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { categoryRoutes } from "./modules/category/category.routes.js";
import { gearItemRoutes } from "./modules/gearItem/gearItem.routes.js";
import { rentalOrderRoutes } from "./modules/rentalOrder/rentalOrder.routes.js";
import { paymentRoutes } from "./modules/payment/payment.routes.js";
import { paymentController } from "./modules/payment/payment.controller.js";
import { reviewRoutes } from "./modules/review/review.route.js";
import { userRoutes } from "./modules/user/user.route.js";

const app: Application = express();

app.use(cors());

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleStripeWebhook,
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "GearUp API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/gear-items", gearItemRoutes);
app.use("/api/rental-orders", rentalOrderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
