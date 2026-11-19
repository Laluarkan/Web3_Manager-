import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import squadRoutes from "./routes/squad.routes";
import marketRoutes from "./routes/market.routes";
import packsRoutes from "./routes/packs.routes";
import socialRoutes from "./routes/social.routes";
import { getTokenMetadata } from "./controllers/market.controller";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Izinkan domain vercel.app, localhost, atau custom frontend URL
      if (
        origin === env.frontendUrl ||
        origin.includes("localhost") ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

app.get(["/api/health", "/health"], (_req, res) => {
  res.json({
    status: "ok",
    service: "W3 Football Manager API",
    chainId: env.chainId,
  });
});

// Routing standar /api
app.use("/api/auth", authRoutes);
app.use("/api/squad", squadRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/packs", packsRoutes);
app.use("/api/social", socialRoutes);
app.get("/api/metadata/:tokenId", getTokenMetadata);

// Fallback alias jika user tidak menyertakan prefix /api pada base URL
app.use("/auth", authRoutes);
app.use("/squad", squadRoutes);
app.use("/market", marketRoutes);
app.use("/packs", packsRoutes);
app.use("/social", socialRoutes);
app.get("/metadata/:tokenId", getTokenMetadata);

app.listen(env.port, () => {
  console.log(`Backend API running at http://localhost:${env.port}`);
});
