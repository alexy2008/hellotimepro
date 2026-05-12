import type { H3Event } from "h3";
import { readBody } from "h3";
import type { ZodSchema } from "zod";
import { ERR } from "./errors";
import { zodIssuesToDetails } from "~/lib/validation/schemas";

export async function parseJson<T>(event: H3Event, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    throw ERR.validation("请求体不是合法 JSON");
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    throw ERR.validationDetails("请求体不合法", zodIssuesToDetails(r.error));
  }
  return r.data;
}
