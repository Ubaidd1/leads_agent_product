import { NextResponse } from "next/server";
export async function POST(request) { const body = await request.json(); return NextResponse.json({ id: `export-${Date.now()}`, status: "completed", format: body.format || "csv", count: body.count || 0 }, { status: 201 }); }
