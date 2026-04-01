import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  setTimeout(() => {
    process.exit(0);
  }, 500);

  return NextResponse.json({ status: "restarting" });
}
