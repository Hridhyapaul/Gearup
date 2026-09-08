import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../generated/prisma/client.js";
import AppError from "../errors/AppError.js";

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage = err.message || "Internal Server Error";
  let errorDetails = err.stack || "No error details available";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorDetails = err.stack ?? "No error details available";
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage =
      "You have provided incorrect field types or missing required fields.";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage =
        "Unique constraint failed on the fields: " + err.meta?.target;
      errorDetails = err.meta?.target ?? {};
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage = "Foreign key constraint failed";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      errorMessage = "Record not found";
    }
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;
      errorMessage =
        "Database connection failed. Please check your database credentials.";
    } else if (err.errorCode === "P1001") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;
      errorMessage =
        "Database server is not available. Please try again later.";
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    errorMessage = "An unknown error occurred";
  }

  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    errorDetails: errorDetails,
  });
};
