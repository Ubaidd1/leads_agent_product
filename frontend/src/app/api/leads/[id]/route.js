import { NextResponse } from "next/server";
import { getLead } from "@/data/leads";

export async function GET(_request, { params }) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}
