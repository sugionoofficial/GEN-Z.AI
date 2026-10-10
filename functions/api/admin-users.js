import { runVercelHandler } from "../_shared/vercel-adapter.js";
import handler from "../../api/admin-users.js";

export function onRequest(context) {
    return runVercelHandler(handler, context.request, context);
}
