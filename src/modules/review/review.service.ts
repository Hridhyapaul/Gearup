import httpStatus from "http-status";
import { RentalOrderStatus } from "../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { CreateReviewInput } from "./review.types";

const createReview = async (
  payload: CreateReviewInput,
  customerId: string,
) => {
  const { gearItemId, rating, comment } = payload;

  const gearItem = await prisma.gearItem.findUnique({
    where: {
      id: gearItemId,
    },
  });

  if (!gearItem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Gear item not found",
    );
  }

  const rentalOrderItem = await prisma.rentalOrderItem.findFirst({
    where: {
      gearItemId,
      rentalOrder: {
        customerId,
        status: RentalOrderStatus.RETURNED,
      },
    },
    include: {
      rentalOrder: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!rentalOrderItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can review this gear only after returning it",
    );
  }

  const existingReview = await prisma.review.findUnique({
    where: {
      customerId_gearItemId: {
        customerId,
        gearItemId,
      },
    },
  });

  if (existingReview) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already reviewed this gear item",
    );
  }

  const review = await prisma.review.create({
    data: {
      customerId,
      gearItemId,
      rating,
      comment,
    },
    include: {
      gearItem: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return review;
};

export const reviewService = {
  createReview,
};
