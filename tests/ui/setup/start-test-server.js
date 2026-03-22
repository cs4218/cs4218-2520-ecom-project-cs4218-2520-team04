import dotenv from "dotenv";
import { getTestMongoUrl } from "./testMongoUrl.js";

dotenv.config();

process.env.MONGO_URL = getTestMongoUrl();

await import("../../../server.js");
