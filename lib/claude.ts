import type { PortfolioSummary, Recommendation, Insurance, BudgetCategory, Expense, RecurringExpense, FinancialGoal } from "./types";

export interface BudgetContext {
  monthlyIncome: number;
  topCategories: { name: string; icon: string; monthlyAvg: number; limit: number }[];
  largeExpenses: { description: string; amount: number; category: string; date: string }[];
}

export interface GoalContext {
  name: string;
  targetAmount: number;
  currency: string;
  progress: number;
  daysLeft: number | null;
}

const CLAUDE_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

/** Extracts the first balanced [...] block from a string. */
function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start);
}

export function buildGoalContexts(goals: FinancialGoal[], totalEur: number, rates: Record<string, number>): GoalContext[] {
  return goals.map((g) => {
    const rate = rates[g.currency] ?? 1;
    const currentEur = g.currentAmount != null ? g.currentAmount / rate : totalEur;
    const progress = Math.min(100, ((currentEur * rate) / g.targetAmount) * 100);
    const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
    return { name: g.name, targetAmount: g.targetAmount, currency: g.currency, progress, daysLeft };
  }).filter((g) => g.progress < 100);
}

export interface ProfileContext {
  age: number;
  yearsToRetirement: number;
}

function buildPrompt(
  summary: PortfolioSummary,
  budget?: BudgetContext,
  goalContexts?: GoalContext[],
  profile?: ProfileContext,
  insurance?: Insurance[]
): string {
  const lines = summary.assets.map(
    (a) => `- ${a.label} (${a.category}): €${a.valueEur.toFixed(2)}`
  );
  const allocations = summary.assets.map((a) => {
    const pct = ((a.valueEur / summary.totalEur) * 100).toFixed(1);
    return `${a.label}: ${pct}%`;
  });

  let budgetSection = "";
  if (budget && budget.topCategories.length > 0) {
    const monthlyExpenses = budget.topCategories.reduce((s, c) => s + c.monthlyAvg, 0);
    const savings = budget.monthlyIncome - monthlyExpenses;
    const savingsRate = budget.monthlyIncome > 0 ? ((savings / budget.monthlyIncome) * 100).toFixed(0) : "?";
    const catLines = budget.topCategories.map(
      (c) => `  - ${c.icon} ${c.name}: €${c.monthlyAvg.toFixed(0)}/mes${c.limit > 0 ? ` (limit €${c.limit})` : ""}`
    );
    const largeExpLines = budget.largeExpenses?.length
      ? `\n\nNajvyššie jednotlivé výdavky (posl. 3 mesiace):\n${budget.largeExpenses.map(
          (e) => `  - ${e.description}: €${e.amount.toFixed(0)} (${e.category}, ${e.date})`
        ).join("\n")}`
      : "";
    budgetSection = `

Mesačný rozpočet:
- Príjmy: €${budget.monthlyIncome.toFixed(0)}/mes
- Výdavky (priemer posl. 3 mesiace): €${monthlyExpenses.toFixed(0)}/mes
- Úspora: €${savings.toFixed(0)}/mes (${savingsRate}% miera úspor)

Výdavky podľa kategórií (mes. priemer):
${catLines.join("\n")}${largeExpLines}`;
  }

  let goalsSection = "";
  if (goalContexts && goalContexts.length > 0) {
    const goalLines = goalContexts.map((g) => {
      const deadline = g.daysLeft !== null ? ` · deadline o ${g.daysLeft}d` : "";
      return `  - ${g.name}: ${g.progress.toFixed(0)}% z ${g.targetAmount.toLocaleString()} ${g.currency}${deadline}`;
    });
    goalsSection = `\n\nFinančné ciele (nedosiahnuté):\n${goalLines.join("\n")}`;
  }

  let profileSection = "";
  if (profile) {
    profileSection = `\n\nProfil investora:\n- Vek: ${profile.age} rokov\n- Roky do dôchodku: ${profile.yearsToRetirement}`;
  }

  let insuranceSection = "";
  if (insurance !== undefined) {
    const TYPE_LABELS_INS: Record<Insurance["type"], string> = {
      car_liability: "PZP", car_comprehensive: "Havarijné", property: "Nehnuteľnosť",
      life: "Životné", health: "Zdravotné/úrazové", travel: "Cestovné", other: "Iné",
    };
    const existing = insurance.map((ins) => `  - ${TYPE_LABELS_INS[ins.type]}: ${ins.provider}, ${ins.annualPremium} ${ins.currency}/rok`);
    const coveredTypes = new Set(insurance.map((ins) => ins.type));
    const missing: string[] = [];
    if (!coveredTypes.has("life")) missing.push("Životné poistenie");
    if (!coveredTypes.has("health")) missing.push("Zdravotné/úrazové poistenie");
    if (!coveredTypes.has("property")) missing.push("Poistenie nehnuteľnosti");
    const missingLine = missing.length > 0 ? `\nChýbajúce krycie: ${missing.join(", ")}` : "";
    insuranceSection = `\n\nPoistenie:\n${existing.length > 0 ? existing.join("\n") : "  Žiadne poistenie"}${missingLine}`;
  }

  const taxSection = `\n\nSlovenský daňový kontext:\n- Akcie/ETF: oslobodenie od dane z príjmu po 1 roku držania (§ 9 ods. 1 písm. k zákona o dani z príjmov)\n- Dividendy: zrážková daň 7% (tuzemské), zahraničné dividendy + 14% zdravotný odvod\n- Kryptomeny: žiadne oslobodenie, zisk = príjem z ostatných zdrojov, sadzba 19%/25%\n- II. pilier: povinné dôchodkové sporenie, peniaze viazané do dôchodku`;

  const catTypes = budget && budget.topCategories.length > 0
    ? ` | "budget"`
    : "";

  return `Si osobný finančný poradca. Analyzuj nasledujúce portfólio${budget ? " a rozpočet" : ""}${goalContexts?.length ? " a finančné ciele" : ""} a poskytni konkrétne odporúčania v slovenčine.

Celková hodnota portfólia: €${summary.totalEur.toFixed(2)}
Posledná aktualizácia: ${summary.lastUpdated}

Rozloženie aktív:
${lines.join("\n")}

Alokácia:
${allocations.join("\n")}${budgetSection}${goalsSection}${profileSection}${insuranceSection}${taxSection}

Poskytni 5–8 konkrétnych odporúčaní vo formáte JSON. Každé odporúčanie musí obsahovať:
- category: "allocation" | "risk" | "opportunity" | "warning"${catTypes}
- title: krátky nadpis (max 10 slov, po slovensky)
- description: konkrétna rada (2–3 vety, po slovensky)
- priority: "high" | "medium" | "low"

Zohľadni:
1. Diverzifikáciu naprieč triedami aktív
2. Riziko (volatilita krypta, koncentrácia komodít)
3. Likviditu (hotovosť vs. nelikvidné aktíva)
4. Slovenský kontext: "pension" = II. pilier (NIE III. pilier) — viazaný do dôchodku, nie je to doplnkové dôchodkové sporenie
5. Ochranu pred infláciou${budget ? "\n6. Mieru úspor, kategórie kde sa míňa najviac, prekročené limity, jednotlivé veľké výdavky" : ""}${goalContexts?.length ? "\n7. Pokrok k finančným cieľom, realistickosť termínov" : ""}${profile ? "\n8. Vek, horizont investovania, vhodnosť rizikovosti portfólia" : ""}${insurance !== undefined ? "\n9. Krytie poistením — upozorni na chýbajúce životné/zdravotné/majetkové poistenie" : ""}
10. Daňovú optimalizáciu: 1-ročné oslobodenie akcií/ETF, daňová efektivita krypta vs. akcií

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
      system: "Odpovedaj VÝHRADNE po slovensky. Vráť LEN validné JSON pole bez akéhokoľvek ďalšieho textu, markdown ani vysvetlení.",
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
  const arrayMatch = text.match(/(\[[\s\S]*\])/);
  if (arrayMatch) text = arrayMatch[1];

  try {
    return JSON.parse(text) as InsuranceAlternative[];
  } catch {
    throw new Error("Nepodarilo sa spracovať odpoveď AI. Skús to znova.");
  }
}

export function buildBudgetContext(
  expenses: Expense[],
  categories: BudgetCategory[],
  recurring: RecurringExpense[]
): BudgetContext {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const recent = expenses.filter((e) => new Date(e.date) >= threeMonthsAgo);

  const catTotals: Record<string, number> = {};
  for (const e of recent) {
    if (e.type === "income") continue; // exclude manual income entries from expense totals
    catTotals[e.categoryId] = (catTotals[e.categoryId] ?? 0) + e.amount;
  }

  const topCategories = categories
    .filter((c) => (catTotals[c.id] ?? 0) > 0)
    .map((c) => ({ name: c.name, icon: c.icon, monthlyAvg: catTotals[c.id] / 3, limit: c.monthlyLimit }))
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
    .slice(0, 10);

  // Recurring income: monthly entries + annual entries prorated
  const recurringMonthlyIncome = recurring
    .filter((r) => r.active && r.type === "income")
    .reduce((sum, r) => sum + (r.frequency === "monthly" ? r.amount : r.amount / 12), 0);

  // Manual income: average of last 3 months from expense entries with type === "income"
  const manualMonthlyIncome = recent
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0) / 3;

  const monthlyIncome = recurringMonthlyIncome + manualMonthlyIncome;

  // Top 5 largest individual expenses from the last 3 months
  const largeExpenses = [...recent]
    .filter((e) => e.type !== "income")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((e) => {
      const cat = categories.find((c) => c.id === e.categoryId);
      return { description: e.description, amount: e.amount, category: cat?.name ?? "Iné", date: e.date };
    });

  return { monthlyIncome, topCategories, largeExpenses };
}

export async function fetchRecommendations(
  summary: PortfolioSummary,
  claudeApiKey: string,
  budget?: BudgetContext,
  goals?: GoalContext[],
  profile?: ProfileContext,
  insurance?: Insurance[]
): Promise<Recommendation[]> {
  const prompt = buildPrompt(summary, budget, goals, profile, insurance);

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
      max_tokens: 2048,
      system: "Odpovedaj VÝHRADNE po slovensky. Vráť LEN validné JSON pole bez akéhokoľvek ďalšieho textu, markdown ani vysvetlení.",
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

  // 1. Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // 2. Extract outermost balanced JSON array (handles trailing text)
  text = extractJsonArray(text);

  try {
    return JSON.parse(text) as Recommendation[];
  } catch {
    throw new Error(`JSON parse zlyhalo. Claude vrátil: ${text.slice(0, 300)}`);
  }
}
