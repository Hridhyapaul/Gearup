import httpStatus from "http-status";

import { PaymentMethod, PaymentStatus } from "../../generated/prisma/enums";
import { PaymentWhereInput } from "../../generated/prisma/models";

import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";

import {
  CreatePaymentInput,
  PaymentQuery,
} from "./payment.types";
import config from "../../config";
import { stripe } from "../../lib/stripe";
import Stripe from "stripe";

const createPayment = async (
  payload: CreatePaymentInput,
  customerId: string,
) => {
  const { rentalOrderId, paymentMethod } = payload;

  const rentalOrder = await prisma.rentalOrder.findUnique({
    where: {
      id: rentalOrderId,
    },
    include: {
      payment: true,
    },
  });

  if (!rentalOrder) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Rental order not found",
    );
  }

  if (rentalOrder.customerId !== customerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to make payment for this rental order",
    );
  }

  if (rentalOrder.status === "CANCELLED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment cannot be created for a cancelled rental order",
    );
  }

  if (rentalOrder.payment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment already exists for this rental order",
    );
  }

  const payment = await prisma.payment.create({
    data: {
      rentalOrderId,
      amount: rentalOrder.totalAmount,
      paymentMethod: paymentMethod as PaymentMethod,
      status: PaymentStatus.PENDING,
    },
  });

  return payment;
};

const createStripeCheckoutSession = async (
  rentalOrderId: string,
  customerId: string,
): Promise<Stripe.Checkout.Session> => {
  const rentalOrder = await prisma.rentalOrder.findUnique({
    where: { id: rentalOrderId },
    include: {
      payment: true,
      items: {
        include: {
          gearItem: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  });

  if (!rentalOrder) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Rental order not found",
    );
  }

  if (rentalOrder.customerId !== customerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to make payment for this rental order",
    );
  }

  if (rentalOrder.status === "CANCELLED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment cannot be created for a cancelled rental order",
    );
  }

  if (rentalOrder.payment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment already exists for this rental order",
    );
  }

  if (rentalOrder.items.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rental order has no items",
    );
  }

  const lineItems = rentalOrder.items.map((item) => ({
    price_data: {
      currency: config.stripe_currency as string,
      product_data: {
        name: item.gearItem.name,
        ...(item.gearItem.image
          ? { images: [item.gearItem.image] }
          : {}),
      },
      unit_amount: Math.round(
        Number(item.pricePerDay) *
          Math.ceil(
            (item.endDate.getTime() - item.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) *
          100,
      ),
    },
    quantity: item.quantity,
  }));

  const payment = await prisma.payment.create({
    data: {
      rentalOrderId: rentalOrder.id,
      amount: rentalOrder.totalAmount,
      paymentMethod: PaymentMethod.STRIPE,
      status: PaymentStatus.PENDING,
    },
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: config.stripe_success_url as string,
    cancel_url: config.stripe_cancel_url as string,
    metadata: {
      rentalOrderId: rentalOrder.id,
      customerId,
    },
  });

  await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      transactionId: checkoutSession.id,
    },
  });

  return checkoutSession;
};

const getAllPayments = async (
  query: PaymentQuery,
  customerId?: string,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: PaymentWhereInput[] = [];

  if (customerId) {
    andConditions.push({
      rentalOrder: {
        customerId,
      },
    });
  }

  if (query.status) {
    const isValidStatus = Object.values(PaymentStatus).includes(
      query.status as PaymentStatus,
    );

    if (!isValidStatus) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid payment status",
      );
    }

    andConditions.push({
      status: query.status as PaymentStatus,
    });
  }

  if (query.paymentMethod) {
    const isValidPaymentMethod = Object.values(PaymentMethod).includes(
      query.paymentMethod as PaymentMethod,
    );

    if (!isValidPaymentMethod) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid payment method",
      );
    }

    andConditions.push({
      paymentMethod: query.paymentMethod as PaymentMethod,
    });
  }

  const payments = await prisma.payment.findMany({
    where: {
      AND: andConditions,
    },
    include: {
      rentalOrder: {
        select: {
          id: true,
          customerId: true,
          startDate: true,
          endDate: true,
          totalAmount: true,
          status: true,
        },
      },
    },
    take: limit,
    skip,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const totalPaymentCount = await prisma.payment.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: payments,
    meta: {
      page,
      limit,
      total: totalPaymentCount,
      totalPages: Math.ceil(totalPaymentCount / limit),
    },
  };
};

const getPaymentById = async (
  paymentId: string,
  customerId?: string,
) => {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    include: {
      rentalOrder: {
        select: {
          id: true,
          customerId: true,
          startDate: true,
          endDate: true,
          totalAmount: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment not found",
    );
  }

  if (
    customerId &&
    payment.rentalOrder.customerId !== customerId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to view this payment",
    );
  }

  return payment;
};

export const paymentService = {
  createPayment,
  createStripeCheckoutSession,
  getAllPayments,
  getPaymentById
};
