import { runVercelHandler } from "../../_shared/vercel-adapter.js";
import handler from "../../../api/viddra/generate.js";

export function onRequest(context) {
    return runVercelHandler(handler, context.request, context);
}
