import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import { notFound } from "./middlewares/notFound.js";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { categoryRoutes } from "./modules/category/category.routes.js";

const app: Application = express();

app.use(cors());
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

app.use(notFound);
app.use(globalErrorHandler);

export default app;
