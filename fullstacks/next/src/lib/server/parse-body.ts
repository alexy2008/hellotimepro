import "server-only";

import type { ZodSchema } from "zod";
import { ERR } from "./errors";
import { zodIssuesToDetails } from "../validation/schemas";

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw ERR.validation("请求体不是合法 JSON");
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    throw ERR.validationDetails("请求体不合法", zodIssuesToDetails(r.error));
  }
  return r.data;
}
