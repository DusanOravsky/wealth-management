"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp, getDecryptedKey } from "@/context/AppContext";
import { loadRecommendations, saveRecommendations, loadExpenses, loadBudgetCategories, loadRecurringExpenses, loadGoals, loadInsurance } from "@/lib/store";
import { fetchRecommendations, buildBudgetContext, buildGoalContexts, buildChatSystemPrompt, sendChatMessage } from "@/lib/claude";
import type { ProfileContext, ChatMessage } from "@/lib/claude";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, AlertTriangle, TrendingUp, Shield, Lightbulb, Loader2, Wallet, Send, Bot, User } from "lucide-react";
import { toast } from "sonner";
import type { Recommendation } from "@/lib/types";

const CATEGORY_ICONS = {
  allocation: TrendingUp,
  risk: Shield,
  opportunity: Lightbulb,
  warning: AlertTriangle,
  budget: Wallet,
};

const CATEGORY_LABELS = {
  allocation: "Alokácia",
  risk: "Riziko",
  opportunity: "Príležitosť",
  warning: "Upozornenie",
  budget: "Rozpočet",
};

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const PRIORITY_LABELS = { high: "Vysoká", medium: "Stredná", low: "Nízka" };

export default function AdvisorPage() {
  const { portfolioSummary: summary, pin, settings, rates } = useApp();
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() =>
    typeof window !== "undefined" ? loadRecommendations() : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function getRecommendations() {
    if (!summary || !pin || !settings) { toast.error("Načítaj portfólio a prihlás sa."); return; }
    if (summary.totalEur === 0) { toast.error("Portfólio je prázdne. Pridaj aktíva."); return; }

    const claudeKey = await getDecryptedKey("claudeKey", pin, settings);
    if (!claudeKey) {
      toast.error("Nastav Claude API kľúč v Nastaveniach.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const budget = buildBudgetContext(loadExpenses(), loadBudgetCategories(), loadRecurringExpenses());
      const goals = buildGoalContexts(loadGoals(), summary.totalEur, rates ?? {});
      const insurance = loadInsurance();

      let profile: ProfileContext | undefined;
      if (settings.birthYear) {
        const age = new Date().getFullYear() - settings.birthYear;
        const retirementAge = settings.retirementAge ?? 65;
        profile = { age, yearsToRetirement: Math.max(0, retirementAge - age) };
      }

      const recs = await fetchRecommendations(summary, claudeKey, budget, goals, profile, insurance);
      setRecommendations(recs);
      saveRecommendations(recs);
      toast.success("Odporúčania vygenerované.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chyba pri generovaní odporúčaní.";
      setError(msg);
      toast.error("Chyba AI poradcu – pozri detail nižšie.");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    if (!summary || !pin || !settings) { toast.error("Načítaj portfólio a prihlás sa."); return; }

    const claudeKey = await getDecryptedKey("claudeKey", pin, settings);
    if (!claudeKey) { toast.error("Nastav Claude API kľúč v Nastaveniach."); return; }

    const budget = buildBudgetContext(loadExpenses(), loadBudgetCategories(), loadRecurringExpenses());
    const insurance = loadInsurance();
    let profile: ProfileContext | undefined;
    if (settings.birthYear) {
      const age = new Date().getFullYear() - settings.birthYear;
      profile = { age, yearsToRetirement: Math.max(0, (settings.retirementAge ?? 65) - age) };
    }
    const systemPrompt = buildChatSystemPrompt(summary, budget, profile, insurance);

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const reply = await sendChatMessage(newMessages, systemPrompt, claudeKey);
      setChatMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chyba";
      toast.error(msg);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Poradca</h1>
            <p className="text-muted-foreground text-sm mt-1">Personalizované odporúčania od Claude AI</p>
          </div>
          <Button onClick={getRecommendations} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? "Analyzujem..." : "Generovať odporúčania"}
          </Button>
        </div>

        {/* Portfolio snapshot */}
        {summary && (
          <Card>
            <CardHeader><CardTitle className="text-base">Portfólio snapshot</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(summary.totalEur)}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                {summary.assets.map((a, i) => (
                  <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                    <p className="text-muted-foreground text-xs truncate">{a.label}</p>
                    <p className="font-medium">
                      {new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(a.valueEur)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error detail */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">Chyba Claude API</p>
                  <p className="text-sm text-muted-foreground break-all">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!summary && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Portfólio sa načítava alebo je prázdne.
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Odporúčania</h2>
            {recommendations.map((r, i) => {
              const Icon = CATEGORY_ICONS[r.category] ?? Lightbulb;
              return (
                <Card key={i} className="border-l-4" style={{
                  borderLeftColor: r.priority === "high" ? "#ef4444" : r.priority === "medium" ? "#3b82f6" : "#6b7280"
                }}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-semibold">{r.title}</span>
                          <Badge variant="outline">{CATEGORY_LABELS[r.category] ?? r.category}</Badge>
                          <Badge variant={PRIORITY_VARIANTS[r.priority] ?? "secondary"}>
                            {PRIORITY_LABELS[r.priority] ?? r.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {recommendations.length === 0 && !loading && (
          <Card>
            <CardContent className="py-16 text-center">
              <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">Klikni na &quot;Generovať odporúčania&quot; pre AI analýzu portfólia.</p>
              <p className="text-xs text-muted-foreground mt-2">Vyžaduje Claude API kľúč (nastav v Nastaveniach).</p>
            </CardContent>
          </Card>
        )}

        {/* ── Chat panel ── */}
        <div className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-muted-foreground" />
            Chat s poradcom
          </h2>

          {/* Message history */}
          {chatMessages.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3 space-y-4 max-h-[500px] overflow-y-auto">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </CardContent>
            </Card>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Spýtaj sa poradcu... (napr. Kedy predať krypto? Ako optimalizovať daně?)"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              disabled={chatLoading}
              className="flex-1"
            />
            <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} size="icon" className="shrink-0">
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Poradca vidí tvoje portfólio, rozpočet a profil. Vyžaduje Claude API kľúč.</p>
        </div>
      </div>
    </AppShell>
  );
}
