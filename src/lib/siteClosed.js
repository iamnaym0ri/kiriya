// The website is closed for now (Josh, 2026-11-27): in a browser, kiriya.love shows only
// src/public/ClosedPage.jsx. The iPhone app keeps everything (it runs from its own bundle and only
// talks to /api), and so does local development. To open the website again, set this to false and
// deploy.
import { isNativeApp } from "./native.js";

export const WEBSITE_CLOSED = true;

export const showClosedPage = () => WEBSITE_CLOSED && !isNativeApp() && !import.meta.env.DEV;
