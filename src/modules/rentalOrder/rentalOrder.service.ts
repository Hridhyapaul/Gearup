import httpStatus from "http-status";
import AppError from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import {
  CreateRentalOrderInput,
  ProviderOrdersQuery,
  RentalOrderQuery,
} from "./rentalOrder.types.js";
import { RentalOrderWhereInput } from "../../generated/prisma/models.js";
import { RentalOrderStatus, UserRole } from "../../generated/prisma/enums.js";

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

const rentalOrderInclude = {
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
} as const;

/**
 * Allowed flow:
 * PLACED → CONFIRMED (provider) | CANCELLED (customer)
 * CONFIRMED → PAID (payment gateway only)
 * PAID → PICKED_UP (provider)
 * PICKED_UP → RETURNED (provider)
 */
const assertManualStatusTransition = (
  currentStatus: RentalOrderStatus,
  nextStatus: RentalOrderStatus,
  userRole: UserRole,
  isCustomerOwner: boolean,
  isProviderOwner: boolean,
) => {
  switch (nextStatus) {
    case RentalOrderStatus.CANCELLED: {
      if (currentStatus !== RentalOrderStatus.PLACED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Only placed rental orders can be cancelled",
        );
      }

      if (userRole === UserRole.CUSTOMER && !isCustomerOwner) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not allowed to cancel this rental order",
        );
      }

      if (
        userRole !== UserRole.CUSTOMER &&
        userRole !== UserRole.ADMIN
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only the customer can cancel a placed rental order",
        );
      }

      break;
    }
    case RentalOrderStatus.CONFIRMED: {
      if (currentStatus !== RentalOrderStatus.PLACED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Only placed rental orders can be confirmed",
        );
      }

      if (userRole === UserRole.PROVIDER && !isProviderOwner) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not allowed to confirm this rental order",
        );
      }

      if (
        userRole !== UserRole.PROVIDER &&
        userRole !== UserRole.ADMIN
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only the provider can confirm a rental order",
        );
      }

      break;
    }
    case RentalOrderStatus.PICKED_UP: {
      if (currentStatus !== RentalOrderStatus.PAID) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Only paid rental orders can be marked as picked up",
        );
      }

      if (userRole === UserRole.PROVIDER && !isProviderOwner) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not allowed to update this rental order",
        );
      }

      if (
        userRole !== UserRole.PROVIDER &&
        userRole !== UserRole.ADMIN
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only the provider can mark a rental order as picked up",
        );
      }

      break;
    }
    case RentalOrderStatus.RETURNED: {
      if (currentStatus !== RentalOrderStatus.PICKED_UP) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Only picked-up rental orders can be marked as returned",
        );
      }

      if (userRole === UserRole.PROVIDER && !isProviderOwner) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not allowed to update this rental order",
        );
      }

      if (
        userRole !== UserRole.PROVIDER &&
        userRole !== UserRole.ADMIN
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only the provider can mark a rental order as returned",
        );
      }

      break;
    }
    case RentalOrderStatus.PAID:
    case RentalOrderStatus.PLACED: {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This rental order status cannot be set manually",
      );
    }
    default: {
      const _exhaustive: never = nextStatus;
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Unsupported rental order status: ${_exhaustive}`,
      );
    }
  }
};

const updateRentalOrder = async (
  rentalOrderId: string,
  status: RentalOrderStatus,
  userId: string,
  userRole: UserRole,
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
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Rental order not found",
    );
  }

  const isCustomerOwner = rentalOrder.customerId === userId;
  const isProviderOwner = rentalOrder.items.some(
    (item) => item.gearItem.providerId === userId,
  );

  assertManualStatusTransition(
    rentalOrder.status,
    status,
    userRole,
    isCustomerOwner,
    isProviderOwner,
  );

  return await prisma.$transaction(async (tx) => {
    const updatedRentalOrder = await tx.rentalOrder.update({
      where: {
        id: rentalOrderId,
      },
      data: {
        status,
      },
      include: rentalOrderInclude,
    });

    // Restore stock when order is cancelled (from PLACED) or returned.
    if (
      status === RentalOrderStatus.CANCELLED ||
      status === RentalOrderStatus.RETURNED
    ) {
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

const getProviderIncomingOrders = async (
  providerId: string,
  query: ProviderOrdersQuery,
) => {
  const page = query.page !== undefined ? Number(query.page) : 1;
  const limit = query.limit !== undefined ? Number(query.limit) : 10;
  const sortOrder = query.sortOrder ?? "desc";

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid page value");
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid limit value");
  }

  if (sortOrder !== "asc" && sortOrder !== "desc") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid sortOrder value. Use 'asc' or 'desc'",
    );
  }

  const andConditions: RentalOrderWhereInput[] = [
    {
      items: {
        some: {
          gearItem: {
            providerId,
          },
        },
      },
    },
  ];

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

  const where: RentalOrderWhereInput = {
    AND: andConditions,
  };

  const skip = (page - 1) * limit;

  const [rentalOrders, total] = await Promise.all([
    prisma.rentalOrder.findMany({
      where,
      select: {
        id: true,
        customerId: true,
        startDate: true,
        endDate: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        items: {
          where: {
            gearItem: {
              providerId,
            },
          },
          select: {
            id: true,
            quantity: true,
            pricePerDay: true,
            startDate: true,
            endDate: true,
            subtotal: true,
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
        payment: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      take: limit,
      skip,
      orderBy: {
        createdAt: sortOrder,
      },
    }),
    prisma.rentalOrder.count({ where }),
  ]);

  return {
    data: rentalOrders,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const rentalOrderService = {
  createRentalOrder,
  getAllRentalOrders,
  getRentalOrderById,
  updateRentalOrder,
  getProviderIncomingOrders,
};
