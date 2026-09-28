import { Request, Response } from "express";
import httpStatus from "http-status";

import AppError from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { reviewService } from "./review.service.js";
import { reviewValidation } from "./review.validation.js";

const createReview = catchAsync(
  async (req: Request, res: Response) => {
    const validationResult =
      reviewValidation.createReviewSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Validation failed",
        validationResult.error.flatten().fieldErrors,
      );
    }

    const customerId = req.user?.userId;

    if (!customerId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Authentication required",
      );
    }

    const review = await reviewService.createReview(
      validationResult.data,
      customerId,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Review created successfully",
      data: review,
    });
  },
);

export const reviewController = {
  createReview,
};
