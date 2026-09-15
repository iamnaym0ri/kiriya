import { Hono } from "hono";
import { approvedMaomao } from "../content/collection.js";
export const apothecaryRoutes = new Hono();
apothecaryRoutes.get("/", (c) => c.json({ facts: approvedMaomao }));
