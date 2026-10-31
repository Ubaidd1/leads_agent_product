import { NextResponse } from "next/server";
import { alerts } from "@/data/alerts";
export async function GET() { return NextResponse.json({ count: alerts.length, data: alerts }); }
