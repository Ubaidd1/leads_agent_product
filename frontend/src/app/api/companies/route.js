import { NextResponse } from "next/server";
import { companies } from "@/data/companies";
export async function GET() { return NextResponse.json({ count: companies.length, data: companies }); }
