import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { categoryService } from "./category.service";
import { sendResponse } from "../../utils/sendResponse";
import { categoryValidation } from "./category.validation";
import AppError from "../../errors/AppError";

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const validationResult = categoryValidation.createCategorySchema.safeParse(
    req.body,
  );

  if (!validationResult.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Category validation failed",
      validationResult.error.issues,
    );
  }

  const category = await categoryService.createCategory(req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Category created successfully",
    data: {
      category,
    },
  });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.getAllCategories(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Categories fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryById(
    req.params.categoryId as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category fetched successfully",
    data: {
      category,
    },
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const validationResult = categoryValidation.updateCategorySchema.safeParse(
    req.body,
  );

  if (!validationResult.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Category validation failed",
      validationResult.error.issues,
    );
  }

  const category = await categoryService.updateCategory(
    req.params.categoryId as string,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category updated successfully",
    data: {
      category,
    },
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.deleteCategory(
    req.params.categoryId as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Category deleted successfully",
    data: {
      category,
    },
  });
});

export const categoryController = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
