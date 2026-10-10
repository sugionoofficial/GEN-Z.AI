import { runVercelHandler } from "../_shared/vercel-adapter.js";
import handler from "../../api/generate-status.js";

export function onRequest(context) {
    return runVercelHandler(handler, context.request, context);
}
