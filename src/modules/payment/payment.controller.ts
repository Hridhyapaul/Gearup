import { Request, Response } from "express";
import httpStatus from "http-status";

import AppError from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { paymentService } from "./payment.service";
import { paymentValidation } from "./payment.validation";
import config from "../../config";
import { stripe } from "../../lib/stripe";
import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { PaymentStatus, UserRole } from "../../generated/prisma/enums";

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
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    throw new AppError(httpStatus.BAD_REQUEST, "Stripe signature is missing");
  }

  const webhookSecret = config.stripe_webhook_secret;

  if (!webhookSecret) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe webhook secret is not configured",
    );
  }

  const event = stripe.webhooks.constructEvent(
    req.body,
    signature,
    webhookSecret,
  );

  console.log("Stripe webhook event:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const rentalOrderId = session.metadata?.rentalOrderId;

    if (!rentalOrderId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Rental order ID is missing from Stripe session metadata",
      );
    }

    const payment = await prisma.payment.findUnique({
      where: {
        rentalOrderId,
      },
    });

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionId: session.id,
        },
      }),

      prisma.rentalOrder.update({
        where: {
          id: rentalOrderId,
        },
        data: {
          status: "PAID",
        },
      }),
    ]);
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Stripe webhook received successfully",
    data: {
      eventType: event.type,
    },
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
