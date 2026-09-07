import { Response } from "express";

type TMeta = {
  page: number;
  limit: number;
  total: number;
};

type TResponseData<TData> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: TData;
  meta?: TMeta;
};

export const sendResponse = <TData>(res: Response, data: TResponseData<TData>) => {
  res.status(data.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    data: data.data,
    meta: data.meta,
  });
};
