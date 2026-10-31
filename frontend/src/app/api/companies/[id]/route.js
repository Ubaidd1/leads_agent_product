import { NextResponse } from "next/server";
import { getCompany } from "@/data/companies";
export async function GET(_request, { params }) { const { id } = await params; const company = getCompany(id); if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 }); return NextResponse.json(company); }
