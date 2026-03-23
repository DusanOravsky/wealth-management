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

  return `Si osobný finančný poradca. Analyzuj nasledujúce portfólio a poskytni konkrétne odporúčania v slovenčine.

Celková hodnota portfólia: €${summary.totalEur.toFixed(2)}
Posledná aktualizácia: ${summary.lastUpdated}

Rozloženie aktív:
${lines.join("\n")}

Alokácia:
${allocations.join("\n")}

Poskytni 4–6 konkrétnych odporúčaní vo formáte JSON. Každé odporúčanie musí obsahovať:
- category: "allocation" | "risk" | "opportunity" | "warning"
- title: krátky nadpis (max 10 slov, po slovensky)
- description: konkrétna rada (2–3 vety, po slovensky)
- priority: "high" | "medium" | "low"

Zohľadni:
1. Diverzifikáciu naprieč triedami aktív
2. Riziko (volatilita krypta, koncentrácia komodít)
3. Likviditu (hotovosť vs. nelikvidné aktíva)
4. Slovenský kontext (II. pilier je viazaný do dôchodku)
5. Ochranu pred infláciou

Odpovedaj VÝHRADNE validným JSON poľom, žiadny markdown, žiadne vysvetlenia.`;
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
    const msg = (err as { error?: { message?: string } })?.error?.message;
    throw new Error(msg ?? `Claude API chyba ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  let text: string = data.content?.[0]?.text ?? "[]";

  // Strip markdown code fences if Claude wrapped the JSON (e.g. ```json ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text) as Recommendation[];
  } catch {
    throw new Error(`JSON parse zlyhalo. Claude vrátil: ${text.slice(0, 300)}`);
  }
}
