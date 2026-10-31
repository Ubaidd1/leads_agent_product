import { NextResponse } from "next/server";
import { savedSearches } from "@/data/savedSearches";
export async function GET() { return NextResponse.json({ count: savedSearches.length, data: savedSearches }); }
export async function POST(request) { const body = await request.json(); return NextResponse.json({ id: `search-${Date.now()}`, ...body }, { status: 201 }); }
