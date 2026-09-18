import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,

  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,

  stripe_secret_key: process.env.STRIPE_SECRET_KEY,
  stripe_currency: process.env.STRIPE_CURRENCY,
  stripe_success_url: process.env.STRIPE_SUCCESS_URL,
  stripe_cancel_url: process.env.STRIPE_CANCEL_URL,
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
};
