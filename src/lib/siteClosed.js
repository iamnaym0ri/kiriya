// The website is closed for now (Josh, 2026-11-27): in a browser, kiriya.love shows only
// src/public/ClosedPage.jsx. The iPhone app keeps everything (it runs from its own bundle and only
// talks to /api), and so does local development. The switch lives in shared/siteClosed.js (it also
// keeps her notifications quiet).
import { isNativeApp } from "./native.js";
import { WEBSITE_CLOSED } from "../../shared/siteClosed.js";

export { WEBSITE_CLOSED };

export const showClosedPage = () => WEBSITE_CLOSED && !isNativeApp() && !import.meta.env.DEV;
