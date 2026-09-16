import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { gearItemValidation } from "./gearItem.validation";
import AppError from "../../errors/AppError";
import { gearItemService } from "./gearItem.service";
import { sendResponse } from "../../utils/sendResponse";



const createGearItem = catchAsync(async (req: Request, res: Response) => {
  const validationResult =
    gearItemValidation.createGearItemSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Gear item validation failed",
      validationResult.error.issues,
    );
  }

  const providerId = req.user?.userId;

  if (!providerId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User authentication is required",
    );
  }

  const gearItem = await gearItemService.createGearItem(
    validationResult.data,
    providerId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Gear item created successfully",
    data: { gearItem },
  });
});

const getAllGearItems = catchAsync(async (req: Request, res: Response) => {
  const result = await gearItemService.getAllGearItems(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Gear items fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getGearItemById = catchAsync(async (req: Request, res: Response) => {
  const gearItem = await gearItemService.getGearItemById(
    req.params.gearItemId as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Gear item fetched successfully",
    data: { gearItem },
  });
});

const updateGearItem = catchAsync(async (req: Request, res: Response) => {
  const validationResult =
    gearItemValidation.updateGearItemSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Gear item validation failed",
      validationResult.error.issues,
    );
  }

  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User authentication is required",
    );
  }

  const gearItem = await gearItemService.updateGearItem(
    req.params.gearItemId as string,
    validationResult.data,
    userId,
    userRole === "ADMIN",
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Gear item updated successfully",
    data: { gearItem },
  });
});

const deleteGearItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User authentication is required",
    );
  }

  const gearItem = await gearItemService.deleteGearItem(
    req.params.gearItemId as string,
    userId,
    userRole === "ADMIN",
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Gear item deleted successfully",
    data: { gearItem },
  });
});

export const gearItemController = {
  createGearItem,
  getAllGearItems,
  getGearItemById,
  updateGearItem,
  deleteGearItem,
};
