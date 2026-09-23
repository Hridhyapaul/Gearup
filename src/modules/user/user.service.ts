import httpStatus from "http-status";

import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { UserWhereInput } from "../../generated/prisma/models";
import { UserRole } from "../../generated/prisma/enums";
import { UpdateUserInput, UserQuery } from "./user.types";

const getAllUsers = async (query: UserQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const andConditions: UserWhereInput[] = [];

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
          email: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (query.role) {
    const isValidRole = Object.values(UserRole).includes(
      query.role as UserRole,
    );

    if (!isValidRole) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid user role",
      );
    }

    andConditions.push({
      role: query.role as UserRole,
    });
  }

  if (query.isActive !== undefined) {
    if (query.isActive !== "true" && query.isActive !== "false") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "isActive must be true or false",
      );
    }

    andConditions.push({
      isActive: query.isActive === "true",
    });
  }

  const users = await prisma.user.findMany({
    where: {
      AND: andConditions,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
    },
    take: limit,
    skip,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const totalUserCount = await prisma.user.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: users,
    meta: {
      page,
      limit,
      total: totalUserCount,
      totalPages: Math.ceil(totalUserCount / limit),
    },
  };
};

const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
    },
  });

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  return user;
};

const updateUser = async (
  userId: string,
  payload: UpdateUserInput,
) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!existingUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: payload,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
    },
  });

  return updatedUser;
};

export const userService = {
  getAllUsers,
  getUserById,
  updateUser
};
