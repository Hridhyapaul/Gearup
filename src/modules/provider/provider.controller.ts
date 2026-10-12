import { Request, Response } from "express";
import httpStatus from "http-status";

import AppError from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { rentalOrderService } from "../rentalOrder/rentalOrder.service.js";

const getProviderOrders = catchAsync(async (req: Request, res: Response) => {
  const providerId = req.user?.userId;

  if (!providerId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User authentication is required",
    );
  }

  const result = await rentalOrderService.getProviderIncomingOrders(
    providerId,
    {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page: typeof req.query.page === "string" ? req.query.page : undefined,
      limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
      sortOrder:
        typeof req.query.sortOrder === "string"
          ? req.query.sortOrder
          : undefined,
    },
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Provider rental orders fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const providerController = {
  getProviderOrders,
};
