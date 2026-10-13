import app from "../src/app.js";

// Required so Stripe webhook signature verification receives the raw body on Vercel.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
