import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { CreateRentalOrderInput, RentalOrderQuery } from "./rentalOrder.types";
import { RentalOrderWhereInput } from "../../generated/prisma/models";
import { RentalOrderStatus } from "../../generated/prisma/enums";

const createRentalOrder = async (
  payload: CreateRentalOrderInput,
  customerId: string,
) => {
  const { startDate, endDate, items } = payload;

  const rentalStartDate = new Date(startDate);
  const rentalEndDate = new Date(endDate);

  const rentalTime = rentalEndDate.getTime() - rentalStartDate.getTime();

  const rentalDays = Math.ceil(rentalTime / (1000 * 60 * 60 * 24));

  if (rentalDays <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rental period must be at least one day",
    );
  }

  return await prisma.$transaction(async (tx) => {
    const gearItemIds = items.map((item) => item.gearItemId);

    const gearItems = await tx.gearItem.findMany({
      where: {
        id: {
          in: gearItemIds,
        },
      },
    });

    if (gearItems.length !== gearItemIds.length) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "One or more gear items were not found",
      );
    }

    const gearItemMap = new Map(
      gearItems.map((gearItem) => [gearItem.id, gearItem]),
    );

    let totalAmount = 0;

    const orderItemsData = items.map((item) => {
      const gearItem = gearItemMap.get(item.gearItemId);

      if (!gearItem) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          `Gear item ${item.gearItemId} not found`,
        );
      }

      if (!gearItem.isAvailable) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Gear item ${gearItem.name} is currently unavailable`,
        );
      }

      if (item.quantity > gearItem.availableStock) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient stock for ${gearItem.name}`,
        );
      }

      const pricePerDay = Number(gearItem.pricePerDay);

      const subtotal = pricePerDay * item.quantity * rentalDays;

      totalAmount += subtotal;

      return {
        gearItemId: item.gearItemId,
        quantity: item.quantity,
        pricePerDay: gearItem.pricePerDay,
        startDate: rentalStartDate,
        endDate: rentalEndDate,
        subtotal,
      };
    });

    const rentalOrder = await tx.rentalOrder.create({
      data: {
        customerId,
        startDate: rentalStartDate,
        endDate: rentalEndDate,
        totalAmount,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            gearItem: true,
          },
        },
      },
    });

    for (const item of items) {
      const gearItem = gearItemMap.get(item.gearItemId);

      if (!gearItem) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          `Gear item ${item.gearItemId} not found`,
        );
      }

      await tx.gearItem.update({
        where: {
          id: item.gearItemId,
        },
        data: {
          availableStock: {
            decrement: item.quantity,
          },
        },
      });
    }

    return rentalOrder;
  });
};

const getAllRentalOrders = async (
  query: RentalOrderQuery,
  customerId?: string,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: RentalOrderWhereInput[] = [];

  if (customerId) {
    andConditions.push({
      customerId,
    });
  }

  if (query.status) {
    const isValidStatus = Object.values(RentalOrderStatus).includes(
      query.status as RentalOrderStatus,
    );

    if (!isValidStatus) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid rental order status");
    }

    andConditions.push({
      status: query.status as RentalOrderStatus,
    });
  }

  const rentalOrders = await prisma.rentalOrder.findMany({
    where: {
      AND: andConditions,
    },
    include: {
      items: {
        include: {
          gearItem: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
            },
          },
        },
      },
      payment: true,
    },
    take: limit,
    skip,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const totalRentalOrderCount = await prisma.rentalOrder.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: rentalOrders,
    meta: {
      page,
      limit,
      total: totalRentalOrderCount,
      totalPages: Math.ceil(totalRentalOrderCount / limit),
    },
  };
};

const getRentalOrderById = async (
  rentalOrderId: string,
  customerId?: string,
  isAdmin = false,
) => {
  const rentalOrder = await prisma.rentalOrder.findUnique({
    where: {
      id: rentalOrderId,
    },
    include: {
      items: {
        include: {
          gearItem: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
              pricePerDay: true,
            },
          },
        },
      },
      payment: true,
    },
  });

  if (!rentalOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "Rental order not found");
  }

  if (!isAdmin && rentalOrder.customerId !== customerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to access this rental order",
    );
  }

  return rentalOrder;
};

const updateRentalOrder = async (
  rentalOrderId: string,
  status: RentalOrderStatus,
  userId: string,
  userRole: string,
) => {
  const rentalOrder = await prisma.rentalOrder.findUnique({
    where: {
      id: rentalOrderId,
    },
    include: {
      items: {
        include: {
          gearItem: {
            select: {
              providerId: true,
            },
          },
        },
      },
    },
  });

  if (!rentalOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "Rental order not found");
  }

  if (userRole === "PROVIDER") {
    const isProviderOwner = rentalOrder.items.some(
      (item) => item.gearItem.providerId === userId,
    );

    if (!isProviderOwner) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to update this rental order",
      );
    }
  }

  if (rentalOrder.status === RentalOrderStatus.RETURNED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Returned rental order cannot be updated",
    );
  }

  if (
    rentalOrder.status === RentalOrderStatus.PAID &&
    status !== RentalOrderStatus.PICKED_UP
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A paid rental order can only be picked up",
    );
  }

  if (
    rentalOrder.status === RentalOrderStatus.PICKED_UP &&
    status !== RentalOrderStatus.RETURNED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A picked-up rental order can only be returned",
    );
  }

  return await prisma.$transaction(async (tx) => {
    const updatedRentalOrder = await tx.rentalOrder.update({
      where: {
        id: rentalOrderId,
      },
      data: {
        status,
      },
      include: {
        items: {
          include: {
            gearItem: {
              select: {
                id: true,
                name: true,
                slug: true,
                image: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    if (status === RentalOrderStatus.RETURNED) {
      for (const item of rentalOrder.items) {
        await tx.gearItem.update({
          where: {
            id: item.gearItemId,
          },
          data: {
            availableStock: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    return updatedRentalOrder;
  });
};

export const rentalOrderService = {
  createRentalOrder,
  getAllRentalOrders,
  getRentalOrderById,
  updateRentalOrder,
};
