import { NextResponse } from "next/server";
import { leads } from "@/data/leads";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("search") || "").toLowerCase();
  const minScore = Number(searchParams.get("minScore") || 0);
  const result = leads.filter((lead) => `${lead.companyName} ${lead.jobTitle} ${lead.technologies.join(" ")}`.toLowerCase().includes(query) && lead.leadScore >= minScore);
  return NextResponse.json({ count: result.length, data: result });
}
