import { runVercelHandler } from "../_shared/vercel-adapter.js";
import handler from "../../api/generate.js";

export function onRequest(context) {
    return runVercelHandler(handler, context.request, context);
}
