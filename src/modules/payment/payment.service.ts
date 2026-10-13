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

const assertStripeCheckoutConfig = () => {
  const secretKey = config.stripe_secret_key?.trim();
  const currency = config.stripe_currency?.trim().toLowerCase();
  const successUrl = config.stripe_success_url?.trim();
  const cancelUrl = config.stripe_cancel_url?.trim();

  if (!secretKey) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe secret key is not configured",
    );
  }

  if (!currency) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe currency is not configured",
    );
  }

  if (!successUrl || !cancelUrl) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe success/cancel URL is not configured",
    );
  }

  return { currency, successUrl, cancelUrl };
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
  currency: string,
) => {
  return items.map((item) => ({
    price_data: {
      currency,
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
  const { currency, successUrl, cancelUrl } = assertStripeCheckoutConfig();

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

  const payment = rentalOrder.payment;

  const reusableSession = await getReusableCheckoutSession(
    payment?.transactionId ?? null,
  );

  if (reusableSession) {
    return reusableSession;
  }

  const lineItems = buildCheckoutLineItems(rentalOrder.items, currency);

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

  // Create the Stripe session before writing a new Payment row so a Stripe
  // failure cannot leave an orphan PENDING record. Never delete payments.
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      rentalOrderId: rentalOrder.id,
      customerId,
      ...(payment ? { paymentId: payment.id } : {}),
    },
  });

  if (payment) {
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
  } else {
    await prisma.payment.create({
      data: {
        rentalOrderId: rentalOrder.id,
        amount: rentalOrder.totalAmount,
        paymentMethod: PaymentMethod.STRIPE,
        status: PaymentStatus.PENDING,
        transactionId: checkoutSession.id,
      },
    });
  }

  return checkoutSession;
};

const completePaymentFromCheckoutSession = async (
  session: Stripe.Checkout.Session,
) => {
  if (session.payment_status !== "paid") {
    return;
  }

  const rentalOrderId = session.metadata?.rentalOrderId;
  const paymentId = session.metadata?.paymentId;

  const payment = paymentId
    ? await prisma.payment.findUnique({ where: { id: paymentId } })
    : rentalOrderId
      ? await prisma.payment.findUnique({ where: { rentalOrderId } })
      : await prisma.payment.findUnique({
          where: { transactionId: session.id },
        });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");
  }

  // Idempotent: repeated webhook deliveries must not re-process a paid charge.
  if (payment.status === PaymentStatus.PAID) {
    return;
  }

  if (payment.status === PaymentStatus.REFUNDED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot mark a refunded payment as paid",
    );
  }

  if (
    session.amount_total != null &&
    session.amount_total !== Math.round(Number(payment.amount) * 100)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Paid amount does not match payment record",
    );
  }

  const orderId = rentalOrderId ?? payment.rentalOrderId;

  await prisma.$transaction([
    prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        transactionId: session.id,
        paymentMethod: PaymentMethod.STRIPE,
      },
    }),
    prisma.rentalOrder.update({
      where: {
        id: orderId,
      },
      data: {
        status: "PAID",
      },
    }),
  ]);
};

const handleExpiredCheckoutSession = async (
  session: Stripe.Checkout.Session,
) => {
  const payment =
    (await prisma.payment.findUnique({
      where: { transactionId: session.id },
    })) ??
    (session.metadata?.paymentId
      ? await prisma.payment.findUnique({
          where: { id: session.metadata.paymentId },
        })
      : null) ??
    (session.metadata?.rentalOrderId
      ? await prisma.payment.findUnique({
          where: { rentalOrderId: session.metadata.rentalOrderId },
        })
      : null);

  if (!payment) {
    return;
  }

  // Only fail the matching PENDING session. Never touch paid/refunded rows.
  if (
    payment.status === PaymentStatus.PENDING &&
    payment.transactionId === session.id
  ) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
      },
    });
  }
};

const handleStripeWebhook = async (
  rawBody: Buffer | string,
  signature: string,
) => {
  const webhookSecret = config.stripe_webhook_secret?.trim();

  if (!webhookSecret) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Stripe webhook secret is not configured",
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid Stripe webhook signature",
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      await completePaymentFromCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    case "checkout.session.expired": {
      await handleExpiredCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    default: {
      break;
    }
  }

  return {
    eventType: event.type,
  };
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
  handleStripeWebhook,
  getAllPayments,
  getPaymentById,
};
