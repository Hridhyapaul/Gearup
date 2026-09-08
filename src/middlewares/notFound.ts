import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";

export const notFound = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(new AppError(httpStatus.NOT_FOUND, "Route not found", {}));
};
