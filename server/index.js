import "./config/env.js";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import testRoutes from "./routes/test.js";
import geminiRoutes from "./routes/gemini.js";
import userRoutes from "./routes/user.js";
import taskRoutes from "./routes/tasks.js";
import certificateRoutes from "./routes/certificates.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "AKSHARA API is running" });
});

app.use("/", authRoutes);
app.use("/", geminiRoutes);
app.use("/", testRoutes);
app.use("/", userRoutes);
app.use("/", taskRoutes);
app.use("/", certificateRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: err.message || "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`AKSHARA server running on port ${port}`);
});
