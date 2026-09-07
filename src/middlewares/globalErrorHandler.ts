import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../generated/prisma/client.js";
import AppError from "../errors/AppError.js";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let errorMessage = err.message || "Something went wrong";
  let errorCode= err.code || httpStatus.INTERNAL_SERVER_ERROR;
  let errorName = err.name || "Error";
  let errorDetails = err.errorDetails ?? null;


  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errorDetails = err.errorDetails ?? null;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    errorMessage =
      "You have provided incorrect field types or missing required fields.";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage =
        "Unique constraint failed on the fields: " + err.meta?.target;
      errorDetails = err.meta?.target ?? null;
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
    statusCode:statusCode,
    errorCode :errorCode,
    message: errorMessage,
    errorName :errorName,
    errorDetails :errorDetails,
    stack :err.stack,
  });
  next(new AppError(statusCode, errorMessage, errorDetails));
};
