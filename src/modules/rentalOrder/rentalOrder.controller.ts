import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { rentalOrderValidation } from "./rentalOrder.validation";
import AppError from "../../errors/AppError";
import { rentalOrderService } from "./rentalOrder.service";
import { sendResponse } from "../../utils/sendResponse";

const createRentalOrder = catchAsync(async (req: Request, res: Response) => {
  const validationResult =
    rentalOrderValidation.createRentalOrderSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rental order validation failed",
      validationResult.error.issues,
    );
  }

  const customerId = req.user?.userId;

  if (!customerId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User authentication is required",
    );
  }

  const rentalOrder = await rentalOrderService.createRentalOrder(
    validationResult.data,
    customerId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Rental order created successfully",
    data: { rentalOrder },
  });
});

const getAllRentalOrders = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "User authentication is required",
      );
    }

    const isAdmin = userRole === "ADMIN";

    const result = await rentalOrderService.getAllRentalOrders(
      req.query,
      isAdmin ? undefined : userId,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental orders fetched successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getRentalOrderById = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "User authentication is required",
      );
    }

    const rentalOrder = await rentalOrderService.getRentalOrderById(
      req.params.rentalOrderId as string,
      userId,
      userRole === "ADMIN",
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Rental order fetched successfully",
      data: { rentalOrder },
    });
  },
);

export const rentalOrderController = {
  createRentalOrder,
  getAllRentalOrders,
  getRentalOrderById,
};
