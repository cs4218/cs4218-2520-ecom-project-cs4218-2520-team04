import dotenv from "dotenv";

dotenv.config();

export const getTestMongoUrl = () => {
  const mongoUrl = process.env.MONGO_URL_TEST;

  if (!mongoUrl) {
    throw new Error("MONGO_URL_TEST is required for UI spec database access.");
  }

  return mongoUrl;
};
