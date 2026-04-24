import express from "express";
import cors from "cors";
import morgan from "morgan";
import { prisma } from "./lib/prisma";

const app = express();

app.use(cors());
app.use(morgan("tiny"));

app.use(express.json());

app.get("/plots", async (req, res) => {
    const plots = await prisma.plot.findMany();
    res.json(plots);
})

export default app;