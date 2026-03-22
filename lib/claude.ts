import type { PortfolioSummary, Recommendation, Insurance } from "./types";

const CLAUDE_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function buildPrompt(summary: PortfolioSummary): string {
  const lines = summary.assets.map(
    (a) => `- ${a.label} (${a.category}): €${a.valueEur.toFixed(2)}`
  );
  const allocations = summary.assets.map((a) => {
    const pct = ((a.valueEur / summary.totalEur) * 100).toFixed(1);
    return `${a.label}: ${pct}%`;
  });

  return `You are a personal wealth advisor. Analyze the following portfolio and provide actionable recommendations.

Portfolio total: €${summary.totalEur.toFixed(2)}
Last updated: ${summary.lastUpdated}

Asset breakdown:
${lines.join("\n")}

Allocation:
${allocations.join("\n")}

Provide 4-6 specific recommendations in JSON format. Each recommendation must have:
- category: "allocation" | "risk" | "opportunity" | "warning"
- title: short title (max 10 words)
- description: actionable advice (2-3 sentences)
- priority: "high" | "medium" | "low"

Consider:
1. Diversification across asset classes
2. Risk exposure (crypto volatility, commodity concentration)
3. Liquidity (cash vs illiquid assets)
4. Slovak context (II. pilier is illiquid until retirement)
5. Inflation protection

Respond with ONLY valid JSON array, no markdown, no explanation.`;
}

export interface InsuranceAlternative {
  provider: string;
  product: string;
  estimatedAnnualPremium: string;
  pros: string[];
  cons: string[];
  tip: string;
}

export async function fetchInsuranceAlternatives(
  insurance: Insurance,
  claudeApiKey: string
): Promise<InsuranceAlternative[]> {
  const TYPE_LABELS: Record<Insurance["type"], string> = {
    car_liability: "Povinné zmluvné poistenie (PZP)",
    car_comprehensive: "Havarijné poistenie",
    property: "Poistenie nehnuteľnosti",
    life: "Životné poistenie",
    health: "Zdravotné/úrazové poistenie",
    travel: "Cestovné poistenie",
    other: "Iné poistenie",
  };

  const prompt = `Si expertný poradca na poistenie na slovenskom trhu. Zákazník má toto poistenie:

Typ: ${TYPE_LABELS[insurance.type]}
Poskytovateľ: ${insurance.provider}
Ročné poistné: ${insurance.annualPremium} ${insurance.currency}
Popis: ${insurance.name}
${insurance.note ? `Poznámka: ${insurance.note}` : ""}

Navrhni 3 konkrétne alternatívy od iných poisťovní dostupných na Slovensku (napr. Allianz, Generali, ČSOB, Kooperativa, Union, Uniqa, NN, MetLife, Groupama).
Odpovedaj v slovenčine.

Vráť VÝHRADNE validné JSON pole, žiadny markdown, žiadne vysvetlenia:
[
  {
    "provider": "názov poisťovne",
    "product": "názov produktu",
    "estimatedAnnualPremium": "odhad ročného poistného vrátane meny",
    "pros": ["výhoda 1", "výhoda 2"],
    "cons": ["nevýhoda 1"],
    "tip": "praktická rada pre zákazníka"
  }
]`;

  const res = await fetch(CLAUDE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API chyba ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  let text: string = data.content?.[0]?.text ?? "[]";
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text) as InsuranceAlternative[];
  } catch {
    throw new Error("Nepodarilo sa spracovať odpoveď AI. Skús to znova.");
  }
}

export async function fetchRecommendations(
  summary: PortfolioSummary,
  claudeApiKey: string
): Promise<Recommendation[]> {
  const prompt = buildPrompt(summary);

  const res = await fetch(CLAUDE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  let text: string = data.content?.[0]?.text ?? "[]";

  // Strip markdown code fences if Claude wrapped the JSON (e.g. ```json ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text) as Recommendation[];
  } catch {
    throw new Error("Nepodarilo sa spracovať odpoveď AI. Skús to znova.");
  }
}
