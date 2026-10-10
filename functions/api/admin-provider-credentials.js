import { runVercelHandler } from "../_shared/vercel-adapter.js";
import handler from "../../api/admin-provider-credentials.js";

export function onRequest(context) {
    return runVercelHandler(handler, context.request, context);
}
