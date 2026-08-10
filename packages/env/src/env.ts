import { array, boolean, enumOf, json, number, port, string, url } from "./schema/primitives.js";
import { object } from "./schema/object.js";

// Zero-dependency default schema builder — implements the same Standard Schema interface a
// third-party validator (zod, valibot, arktype) would, so swapping to one later means changing
// this import, not `loadEnv` or anything that calls it.
export const env = {
  string,
  number,
  boolean,
  enum: enumOf,
  object,
  array,
  url,
  port,
  json,
};
