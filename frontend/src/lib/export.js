"use client";

function escapeCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function downloadLeads(leads, format = "csv") {
  const headers = ["Company", "Job Title", "Lead Score", "Hiring Intent", "Technologies", "Remote Fit", "Salary", "Relevant Roles", "Open Roles", "Freshness", "Last Verified"];
  const rows = leads.map((lead) => [
    lead.companyName,
    lead.jobTitle,
    lead.leadScore,
    lead.hiringIntent,
    lead.technologies.join(", "),
    lead.remoteFit,
    lead.salaryRange,
    lead.relevantOpenRoles,
    lead.openRolesTotal,
    lead.freshness,
    lead.lastVerified
  ]);

  let blob;
  let extension;
  if (format === "xls") {
    const tableRows = [headers, ...rows]
      .map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`)
      .join("");
    blob = new Blob([`<table>${tableRows}</table>`], { type: "application/vnd.ms-excel;charset=utf-8" });
    extension = "xls";
  } else {
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    extension = "csv";
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `qualified-hiring-leads-${new Date().toISOString().slice(0, 10)}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
