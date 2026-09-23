import { Request, Response } from "express";
import httpStatus from "http-status";

import AppError from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userService } from "./user.service";
import { userValidation } from "./user.validation";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllUsers(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Users fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUserById = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.params.userId as string;

    if (!userId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "User ID is required",
      );
    }

    const user = await userService.getUserById(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User fetched successfully",
      data: user,
    });
  },
);

const updateUser = catchAsync(
  async (req: Request, res: Response) => {
    const validationResult =
      userValidation.updateUserSchema.safeParse(req.body);

    if (!validationResult.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "User validation failed",
        validationResult.error.issues,
      );
    }

    const userId = req.params.userId as string;

    if (!userId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "User ID is required",
      );
    }

    const user = await userService.updateUser(
      userId,
      validationResult.data,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User updated successfully",
      data: user,
    });
  },
);

export const userController = {
  getAllUsers,
  getUserById,
  updateUser
};
