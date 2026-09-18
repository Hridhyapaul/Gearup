export type CreatePaymentInput = {
    rentalOrderId: string;
    paymentMethod: "STRIPE" | "SSLCOMMERZ";
  };

  export type PaymentQuery = {
    status?: string;
    paymentMethod?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
