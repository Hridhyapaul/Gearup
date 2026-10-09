import httpStatus from "http-status";

import { PaymentMethod, PaymentStatus } from "../../generated/prisma/enums.js";
import { PaymentWhereInput } from "../../generated/prisma/models.js";

import AppError from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { CreatePaymentInput, PaymentQuery } from "./payment.types.js";
import config from "../../config/index.js";
import { stripe } from "../../lib/stripe.js";
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
    throw new AppError(httpStatus.NOT_FOUND, "Rental order not found");
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

const getReusableCheckoutSession = async (
  transactionId: string | null,
): Promise<Stripe.Checkout.Session | null> => {
  if (!transactionId) {
    return null;
  }

  try {
    const existingSession =
      await stripe.checkout.sessions.retrieve(transactionId);

    if (existingSession.status === "open" && existingSession.url) {
      return existingSession;
    }

    return null;
  } catch {
    return null;
  }
};

const buildCheckoutLineItems = (
  items: {
    quantity: number;
    subtotal: { toString(): string } | number;
    gearItem: {
      name: string;
      image: string | null;
    };
  }[],
) => {
  return items.map((item) => ({
    price_data: {
      currency: config.stripe_currency as string,
      product_data: {
        name: item.gearItem.name,
        ...(item.gearItem.image ? { images: [item.gearItem.image] } : {}),
      },
      // Use DB subtotal so Checkout total matches the rental order amount.
      unit_amount: Math.round((Number(item.subtotal) * 100) / item.quantity),
    },
    quantity: item.quantity,
  }));
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
    throw new AppError(httpStatus.NOT_FOUND, "Rental order not found");
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

  if (rentalOrder.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Rental order has no items");
  }

  // Schema status for a finished charge is PAID (not COMPLETED).
  if (rentalOrder.payment?.status === PaymentStatus.PAID) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment already completed for this rental order",
    );
  }

  if (rentalOrder.payment?.status === PaymentStatus.REFUNDED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment for this rental order has been refunded",
    );
  }

  const successUrl = config.stripe_success_url?.trim();
  const cancelUrl = config.stripe_cancel_url?.trim();

  // Validate Stripe URLs before any Payment write so a config error
  // does not leave an orphan PENDING row with null transactionId.
  if (!successUrl || !cancelUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe success/cancel URL is not configured",
    );
  }

  let payment = rentalOrder.payment;

  const reusableSession = await getReusableCheckoutSession(
    payment?.transactionId ?? null,
  );

  if (reusableSession) {
    return reusableSession;
  }

  const lineItems = buildCheckoutLineItems(rentalOrder.items);

  const checkoutTotalCents = lineItems.reduce(
    (sum, lineItem) =>
      sum + lineItem.price_data.unit_amount * lineItem.quantity,
    0,
  );
  const orderTotalCents = Math.round(Number(rentalOrder.totalAmount) * 100);

  if (checkoutTotalCents !== orderTotalCents) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Checkout amount does not match rental order total",
    );
  }

  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        rentalOrderId: rentalOrder.id,
        amount: rentalOrder.totalAmount,
        paymentMethod: PaymentMethod.STRIPE,
        status: PaymentStatus.PENDING,
      },
    });
  }

  let checkoutSession: Stripe.Checkout.Session;

  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        rentalOrderId: rentalOrder.id,
        customerId,
        paymentId: payment.id,
      },
    });
  } catch (error) {
    // If this Payment was just created and Stripe failed, remove the
    // orphan so a later retry starts clean. Existing PENDING rows are kept.
    if (!rentalOrder.payment) {
      await prisma.payment.delete({
        where: { id: payment.id },
      });
    }

    throw error;
  }

  await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      amount: rentalOrder.totalAmount,
      paymentMethod: PaymentMethod.STRIPE,
      status: PaymentStatus.PENDING,
      transactionId: checkoutSession.id,
    },
  });

  return checkoutSession;
};

const getAllPayments = async (query: PaymentQuery, customerId?: string) => {
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
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment status");
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
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment method");
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

const getPaymentById = async (paymentId: string, customerId?: string) => {
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
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  if (customerId && payment.rentalOrder.customerId !== customerId) {
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
  getPaymentById,
};
