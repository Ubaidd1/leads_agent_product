import { NextResponse } from "next/server";
export async function DELETE(_request, { params }) { const { id } = await params; return NextResponse.json({ deleted: true, id }); }
