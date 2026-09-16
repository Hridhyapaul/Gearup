import httpStatus from "http-status";


import {
  CreateGearItemInput,
  GearItemQuery,
  UpdateGearItemInput,
} from "./gearItem.types";
import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { GearItemWhereInput } from "../../generated/prisma/models";

const createGearItem = async (
  payload: CreateGearItemInput,
  providerId: string,
) => {
  const {
    name,
    slug,
    description,
    pricePerDay,
    stock,
    availableStock,
    image,
    categoryId,
  } = payload;

  const existingGearItem = await prisma.gearItem.findFirst({
    where: {
      OR: [{ name }, { slug }],
    },
  });

  if (existingGearItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Gear item with this name or slug already exists",
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  if (availableStock > stock) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Available stock cannot be greater than total stock",
    );
  }

  const gearItem = await prisma.gearItem.create({
    data: {
      name,
      slug,
      description,
      pricePerDay,
      stock,
      availableStock,
      image,
      providerId,
      categoryId,
    },
  });

  return gearItem;
};

const getAllGearItems = async (query: GearItemQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: GearItemWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          name: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (query.categoryId) {
    andConditions.push({
      categoryId: query.categoryId,
    });
  }

  if (query.providerId) {
    andConditions.push({
      providerId: query.providerId,
    });
  }

  if (query.minPrice) {
    andConditions.push({
      pricePerDay: {
        gte: Number(query.minPrice),
      },
    });
  }

  if (query.maxPrice) {
    andConditions.push({
      pricePerDay: {
        lte: Number(query.maxPrice),
      },
    });
  }

  if (query.isAvailable !== undefined) {
    andConditions.push({
      isAvailable: query.isAvailable === "true",
    });
  }

  const gearItems = await prisma.gearItem.findMany({
    where: {
      AND: andConditions,
    },
    include: {
      category: true,
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    take: limit,
    skip,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const totalGearItemCount = await prisma.gearItem.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: gearItems,
    meta: {
      page,
      limit,
      total: totalGearItemCount,
      totalPages: Math.ceil(totalGearItemCount / limit),
    },
  };
};

const getGearItemById = async (gearItemId: string) => {
  const gearItem = await prisma.gearItem.findUnique({
    where: { id: gearItemId },
    include: {
      category: true,
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!gearItem) {
    throw new AppError(httpStatus.NOT_FOUND, "Gear item not found");
  }

  return gearItem;
};

const updateGearItem = async (
  gearItemId: string,
  payload: UpdateGearItemInput,
  userId: string,
  isAdmin: boolean,
) => {
  const existingGearItem = await prisma.gearItem.findUnique({
    where: { id: gearItemId },
  });

  if (!existingGearItem) {
    throw new AppError(httpStatus.NOT_FOUND, "Gear item not found");
  }

  if (!isAdmin && existingGearItem.providerId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this gear item",
    );
  }

  if (payload.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId },
    });

    if (!category) {
      throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }
  }

  if (payload.name || payload.slug) {
    const duplicateGearItem = await prisma.gearItem.findFirst({
      where: {
        OR: [
          ...(payload.name ? [{ name: payload.name }] : []),
          ...(payload.slug ? [{ slug: payload.slug }] : []),
        ],
        NOT: {
          id: gearItemId,
        },
      },
    });

    if (duplicateGearItem) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Gear item with this name or slug already exists",
      );
    }
  }

  const updatedStock = payload.stock ?? existingGearItem.stock;
  const updatedAvailableStock =
    payload.availableStock ?? existingGearItem.availableStock;

  if (updatedAvailableStock > updatedStock) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Available stock cannot be greater than total stock",
    );
  }

  const gearItem = await prisma.gearItem.update({
    where: { id: gearItemId },
    data: payload,
  });

  return gearItem;
};

const deleteGearItem = async (
  gearItemId: string,
  userId: string,
  isAdmin: boolean,
) => {
  const existingGearItem = await prisma.gearItem.findUnique({
    where: { id: gearItemId },
  });

  if (!existingGearItem) {
    throw new AppError(httpStatus.NOT_FOUND, "Gear item not found");
  }

  if (!isAdmin && existingGearItem.providerId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this gear item",
    );
  }

  const gearItem = await prisma.gearItem.delete({
    where: { id: gearItemId },
  });

  return gearItem;
};

export const gearItemService = {
  createGearItem,
  getAllGearItems,
  getGearItemById,
  updateGearItem,
  deleteGearItem,
};
