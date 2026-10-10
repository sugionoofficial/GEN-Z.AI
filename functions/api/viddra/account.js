import { runVercelHandler } from "../../_shared/vercel-adapter.js";
import handler from "../../../api/viddra/account.js";

export function onRequest(context) {
    return runVercelHandler(handler, context.request, context);
}
