import { Request, Response } from "express";
import httpStatus from "http-status";

import AppError from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";

import { paymentService } from "./payment.service.js";
import { paymentValidation } from "./payment.validation.js";
import { UserRole } from "../../generated/prisma/enums.js";

const createPayment = catchAsync(async (req: Request, res: Response) => {
  const validationResult = paymentValidation.createPaymentSchema.safeParse(
    req.body,
  );

  if (!validationResult.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment validation failed",
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

  const payment = await paymentService.createPayment(
    validationResult.data,
    customerId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Payment created successfully",
    data: { payment },
  });
});

const createStripeCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const rentalOrderId = req.body.rentalOrderId;

    if (!rentalOrderId) {
      throw new AppError(httpStatus.BAD_REQUEST, "Rental order ID is required");
    }

    const customerId = req.user?.userId;

    if (!customerId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "User authentication is required",
      );
    }

    const checkoutSession = await paymentService.createStripeCheckoutSession(
      rentalOrderId,
      customerId,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Stripe checkout session created successfully",
      data: {
        sessionId: checkoutSession.id,
        checkoutUrl: checkoutSession.url,
      },
    });
  },
);

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const signatureHeader = req.headers["stripe-signature"];
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;

  if (!signature) {
    throw new AppError(httpStatus.BAD_REQUEST, "Stripe signature is missing");
  }

  const result = await paymentService.handleStripeWebhook(req.body, signature);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Stripe webhook received successfully",
    data: result,
  });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User authentication is required",
    );
  }

  const isAdmin = userRole === "ADMIN";

  const result = await paymentService.getAllPayments(
    req.query,
    isAdmin ? undefined : userId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Payments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const paymentIdParam = req.params.paymentId;

  const paymentId = Array.isArray(paymentIdParam)
    ? paymentIdParam[0]
    : paymentIdParam;

  if (!paymentId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment ID is required");
  }

  const customerId =
    req.user?.role === UserRole.CUSTOMER ? req.user.userId : undefined;

  const payment = await paymentService.getPaymentById(paymentId, customerId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Payment retrieved successfully",
    data: payment,
  });
});

export const paymentController = {
  createPayment,
  createStripeCheckoutSession,
  handleStripeWebhook,
  getAllPayments,
  getPaymentById,
};
