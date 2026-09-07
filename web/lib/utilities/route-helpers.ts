/**
 * Diagnowise web — Next.js Route Handler wrapper.
 *
 * Every app/api/clinical/*\/route.ts file uses this so error mapping
 * (lib/utilities/errors.ts's toErrorResponse) is applied identically
 * everywhere, instead of each route reimplementing its own try/catch.
 */

import { NextResponse } from "next/server";
import { toErrorResponse } from "./errors";

export async function handleApiRoute<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await fn();
    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
