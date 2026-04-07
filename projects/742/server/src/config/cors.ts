import cors, { CorsOptions } from "cors";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const allowedMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS"
];

const allowedHeaders = [
  "Origin",
  "X-Requested-With",
  "Content-Type",
  "Accept",
  "Authorization"
];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Allow non-browser clients (e.g., mobile apps, curl, Postman)
      return callback(null, true);
    }

    if (origin === CLIENT_ORIGIN) {
      return callback(null, true);
    }

    const error = new Error("Not allowed by CORS");
    callback(error);
  },
  credentials: true,
  methods: allowedMethods.join(","),
  allowedHeaders: allowedHeaders.join(","),
  optionsSuccessStatus: 204
};

export const createCorsMiddleware = () => cors(corsOptions);

export default corsOptions;