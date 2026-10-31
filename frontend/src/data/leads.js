const baseLeads = [
  ["lead-1","novastack-labs","NovaStack Labs","NS","Senior Full Stack Engineer","Software Development",91,"Strong",["React","Node.js","AWS","PostgreSQL"],"International Remote · Pakistan Allowed","$110k–$145k",3,8,"2 days ago","Today · 12 min ago"],
  ["lead-2","cloudnova-systems","CloudNova Systems","CN","Lead AI & RAG Infrastructure Engineer","AI / ML",94,"Strong",["Python","LLM","RAG","FastAPI"],"Worldwide Remote","$145k–$185k",7,15,"1 day ago","Today · 4 min ago"],
  ["lead-3","vertex-dynamics","Vertex Dynamics","VD","Senior AI Solutions Engineer","AI / ML",90,"Strong",["LLM","RAG","Python","Next.js"],"International Contractor Friendly","$120k–$160k",4,9,"Today","Today · 18 min ago"],
  ["lead-4","vectorpay-global","VectorPay Global","VP","Senior Frontend Engineer","Software Development",85,"Medium",["React","Kafka","PostgreSQL","Azure"],"US / Canada / LatAm Remote","$120k–$150k",4,12,"3 days ago","Today · 3 hr ago"],
  ["lead-5","orbit-health","Orbit Health","OH","Senior Backend Engineer","Software Development",86,"Medium",["Python","Django","AWS","PostgreSQL"],"US & Selected International","$125k–$155k",3,6,"2 days ago","Today · 45 min ago"],
  ["lead-6","aster-security","Aster Security","AS","Cloud Platform Engineer","Software Development",83,"Medium",["Go","Kubernetes","AWS","Terraform"],"Europe + Contractors","€90k–€125k",3,7,"4 days ago","Yesterday"],
  ["lead-7","lumen-commerce","Lumen Commerce","LC","Senior Next.js Engineer","Web Development",84,"Medium",["Next.js","React","Node.js","GraphQL"],"Worldwide Remote","€85k–€120k",3,5,"1 day ago","Today · 1 hr ago"],
  ["lead-8","hypergrowth-labs","HyperGrowth Labs","HG","Programmatic SEO Architect","SEO",82,"Medium",["SEO","Next.js","Python","Content"],"Worldwide Remote · Pakistan Allowed","$80k–$110k",3,5,"4 days ago","Yesterday"]
];

export const leads = baseLeads.map((row, index) => {
  const [id, companyId, companyName, companyLogo, jobTitle, serviceType, leadScore, hiringIntent, technologies, remoteFit, salaryRange, relevantOpenRoles, openRolesTotal, freshness, lastVerified] = row;
  const max = { relevance: 25, hiringIntent: 20, freshness: 15, remoteFit: 10, commercialValue: 10, companyActivity: 10, seniority: 5, dataQuality: 5 };
  const deduction = Math.max(0, 94 - leadScore);
  const breakdown = {
    relevance: Math.max(18, 25 - Math.ceil(deduction * 0.28)),
    hiringIntent: Math.max(14, 20 - Math.ceil(deduction * 0.22)),
    freshness: Math.max(11, 15 - Math.ceil(deduction * 0.15)),
    remoteFit: Math.max(7, 10 - Math.ceil(deduction * 0.1)),
    commercialValue: Math.max(7, 10 - Math.ceil(deduction * 0.1)),
    companyActivity: Math.max(7, 10 - Math.ceil(deduction * 0.08)),
    seniority: Math.max(3, 5 - Math.ceil(deduction * 0.04)),
    dataQuality: Math.max(3, 5 - Math.ceil(deduction * 0.03))
  };
  return {
    id, companyId, companyName, companyLogo, jobTitle, serviceType, leadScore, hiringIntent,
    technologies, remoteFit, salaryRange, relevantOpenRoles, openRolesTotal, freshness, lastVerified,
    seniority: index % 3 === 0 ? "Lead / Principal" : "Senior",
    confidence: leadScore >= 88 ? "High Confidence" : "Verified",
    sourcesCount: leadScore >= 88 ? 3 : 2,
    sources: ["Company Careers", "Partner Feed", "Remote Job Feed"].slice(0, leadScore >= 88 ? 3 : 2),
    canonicalUrl: `https://${companyId}.example/jobs/${id}`,
    careersUrl: `https://${companyId}.example/careers`,
    scoreBreakdown: breakdown,
    scoreMax: max,
    rationale: `${companyName} is showing ${hiringIntent.toLowerCase()} hiring intent with ${relevantOpenRoles} relevant roles, recent verified activity, and strong alignment with ${technologies.slice(0,2).join(" and ")}.`,
    timeline: [
      { date: "Today", event: `${jobTitle} verified from direct company source` },
      { date: "2 days ago", event: "New related engineering role detected" },
      { date: "7 days ago", event: "Company hiring velocity increased" },
      { date: "21 days ago", event: "Department expansion signal detected" }
    ]
  };
});

export function getLead(id) {
  return leads.find((lead) => lead.id === id);
}
