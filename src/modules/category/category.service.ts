import AppError from "../../errors/AppError";
import { CategoryWhereInput } from "../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { CategoryQuery, CreateCategoryInput, UpdateCategoryInput } from "./category.types";
import httpStatus from "http-status";

const createCategory = async (payload: CreateCategoryInput) => {
  const { name, slug, description } = payload;

  const existingCategory = await prisma.category.findFirst({
    where: {
      OR: [{ name }, { slug }],
    },
  });

  if (existingCategory) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Category with this name or slug already exists",
    );
  }

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      description,
    },
  });

  return category;
};

const getAllCategories = async (query: CategoryQuery) => {
  // Pagination
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  // Sorting
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: CategoryWhereInput[] = [];

  // Search
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

  // Filtering
  if (query.name) {
    andConditions.push({
      name: query.name,
    });
  }

  if (query.slug) {
    andConditions.push({
      slug: query.slug,
    });
  }


  const categories = await prisma.category.findMany({
    where: {
      AND: andConditions,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
    },
    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const totalCategoryCount = await prisma.category.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: categories,
    meta: {
      page: page,
      limit: limit,
      total: totalCategoryCount,
      totalPages: Math.ceil(totalCategoryCount / limit),
    },
  };
};

const getCategoryById = async (categoryId: string) => {
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
      },
    });

    if (!category) {
      throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    return category;
  };

  const updateCategory = async (
    categoryId: string,
    payload: UpdateCategoryInput,
  ) => {
    const existingCategory = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!existingCategory) {
      throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (payload.name || payload.slug) {
      const duplicateCategory = await prisma.category.findFirst({
        where: {
          OR: [
            ...(payload.name ? [{ name: payload.name }] : []),
            ...(payload.slug ? [{ slug: payload.slug }] : []),
          ],
          NOT: {
            id: categoryId,
          },
        },
      });

      if (duplicateCategory) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Category with this name or slug already exists",
        );
      }
    }

    const category = await prisma.category.update({
      where: {
        id: categoryId,
      },
      data: payload,
    });

    return category;
  };


  const deleteCategory = async (categoryId: string) => {
    const existingCategory = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!existingCategory) {
      throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    const category = await prisma.category.delete({
      where: {
        id: categoryId,
      },
    });

    return category;
  };

export const categoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
