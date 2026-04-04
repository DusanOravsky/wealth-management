"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { groupByCategory } from "@/lib/portfolio-calc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, Trash2, Target, ChevronDown, ChevronUp, CheckCircle2, Circle, Flag } from "lucide-react";
import { CURRENCIES, FALLBACK_RATES, CURRENCY_SYMBOLS } from "@/lib/constants";
import type { Currency, FinancialGoal, GoalMilestone } from "@/lib/types";
import { loadGoalMilestones, saveGoalMilestones } from "@/lib/store";
import { toast } from "sonner";

const GOAL_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f97316", "#3b82f6", "#ec4899"];

const CATEGORY_LABELS: Record<string, string> = {
  commodity: "Komodity", cash: "Hotovosť", pension: "II. Pilier",
  bank: "Bankové účty", crypto: "Krypto", stock: "Akcie", realestate: "Nehnuteľnosti",
};

const EMPTY_FORM = {
  name: "",
  targetAmount: "",
  currency: "EUR" as Currency,
  deadline: "",
  note: "",
  color: GOAL_COLORS[0],
  linkedCategory: "" as FinancialGoal["linkedCategory"] | "",
  currentAmount: "",
};

const EMPTY_MILESTONE_FORM = { name: "", targetAmount: "" };

export default function GoalsPage() {
  const { goals, saveGoalsData, portfolioSummary, rates } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [milestoneGoalId, setMilestoneGoalId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState(EMPTY_MILESTONE_FORM);

  useEffect(() => {
    setMilestones(loadGoalMilestones());
  }, []);

  const grouped = portfolioSummary ? groupByCategory(portfolioSummary) : {};

  function saveMilestones(updated: GoalMilestone[]) {
    setMilestones(updated);
    saveGoalMilestones(updated);
  }

  function getCurrentEur(goal: FinancialGoal): number {
    if (goal.linkedCategory) {
      return grouped[goal.linkedCategory] ?? 0;
    }
    if (goal.currentAmount != null) {
      const rate = rates[goal.currency] ?? FALLBACK_RATES[goal.currency] ?? 1;
      return goal.currentAmount / rate;
    }
    return portfolioSummary?.totalEur ?? 0;
  }

  function getProgress(goal: FinancialGoal): number {
    const currentEur = getCurrentEur(goal);
    const rate = rates[goal.currency] ?? FALLBACK_RATES[goal.currency] ?? 1;
    const currentInCurrency = currentEur * rate;
    return Math.min(100, (currentInCurrency / goal.targetAmount) * 100);
  }

  function getCurrentDisplay(goal: FinancialGoal): number {
    const rate = rates[goal.currency] ?? FALLBACK_RATES[goal.currency] ?? 1;
    return getCurrentEur(goal) * rate;
  }

  function handleAdd() {
    if (!form.name.trim()) { toast.error("Zadaj názov cieľa."); return; }
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      toast.error("Zadaj kladnú cieľovú sumu."); return;
    }
    const newGoal: FinancialGoal = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      targetAmount: Number(form.targetAmount),
      currency: form.currency,
      deadline: form.deadline || undefined,
      note: form.note.trim() || undefined,
      color: form.color,
      linkedCategory: (form.linkedCategory || undefined) as FinancialGoal["linkedCategory"],
      currentAmount: form.currentAmount ? Number(form.currentAmount) : undefined,
    };
    saveGoalsData([...goals, newGoal]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    toast.success("Cieľ pridaný.");
  }

  function handleDelete(id: string) {
    saveGoalsData(goals.filter((g) => g.id !== id));
    saveMilestones(milestones.filter((m) => m.goalId !== id));
    setDeleteId(null);
    toast.success("Cieľ vymazaný.");
  }

  function handleAddMilestone() {
    if (!milestoneGoalId) return;
    if (!milestoneForm.name.trim()) { toast.error("Zadaj názov míľnika."); return; }
    const newM: GoalMilestone = {
      id: crypto.randomUUID(),
      goalId: milestoneGoalId,
      name: milestoneForm.name.trim(),
      targetAmount: milestoneForm.targetAmount ? Number(milestoneForm.targetAmount) : undefined,
    };
    saveMilestones([...milestones, newM]);
    setMilestoneForm(EMPTY_MILESTONE_FORM);
    setMilestoneGoalId(null);
    toast.success("Míľnik pridaný.");
  }

  function toggleMilestone(milestone: GoalMilestone) {
    saveMilestones(milestones.map((m) =>
      m.id === milestone.id
        ? { ...m, completedAt: m.completedAt ? undefined : new Date().toISOString() }
        : m
    ));
  }

  function deleteMilestone(id: string) {
    saveMilestones(milestones.filter((m) => m.id !== id));
  }

  function toggleExpand(goalId: string) {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }

  function daysLeft(deadline: string): number | null {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function progressSource(goal: FinancialGoal): string {
    if (goal.linkedCategory) return `z kategórie "${CATEGORY_LABELS[goal.linkedCategory] ?? goal.linkedCategory}"`;
    if (goal.currentAmount != null) return "manuálna hodnota";
    return "z celého portfólia";
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 page-enter max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ciele</h1>
            <p className="text-muted-foreground text-sm mt-1">Finančné ciele a ich progres</p>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-4 h-4 mr-2" />
            Pridať cieľ
          </Button>
        </div>

        {/* Add form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nový cieľ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Názov cieľa (napr. FIRE, dovolenka, byt)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Cieľová suma"
                  value={form.targetAmount}
                  onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                  className="flex-1"
                />
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: (v ?? "EUR") as Currency }))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Progress source */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Zdroj progresu</label>
                <Select
                  value={form.linkedCategory || "total"}
                  onValueChange={(v) => setForm((f) => ({
                    ...f,
                    linkedCategory: v === "total" || v === "manual" ? "" : v as FinancialGoal["linkedCategory"],
                    currentAmount: v === "manual" ? f.currentAmount : "",
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(() => {
                        const v: string = form.linkedCategory || "total";
                        if (v === "total") return "Celé portfólio";
                        if (v === "manual") return "Manuálna hodnota";
                        return CATEGORY_LABELS[v] ?? v;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Celé portfólio</SelectItem>
                    <SelectItem value="manual">Manuálna hodnota</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!form.linkedCategory && (
                <Input
                  type="number"
                  placeholder={`Aktuálna nasporiená suma (${form.currency}) — voliteľné`}
                  value={form.currentAmount}
                  onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
                />
              )}

              <Input
                type="date"
                placeholder="Termín (voliteľný)"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
              <Input
                placeholder="Poznámka (voliteľná)"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
              <div className="flex gap-2 flex-wrap">
                {GOAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd}>Pridať</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Zrušiť</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals list */}
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Žiadne ciele"
            description="Nastav si finančný cieľ — FIRE, byt, dovolenka alebo čokoľvek iné."
            action="Pridať cieľ"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const progress = getProgress(goal);
              const current = getCurrentDisplay(goal);
              const sym = CURRENCY_SYMBOLS[goal.currency] ?? goal.currency;
              const days = goal.deadline ? daysLeft(goal.deadline) : null;
              const overdue = goal.deadline && days === null;
              const goalMilestones = milestones.filter((m) => m.goalId === goal.id);
              const completedCount = goalMilestones.filter((m) => m.completedAt).length;
              const isExpanded = expandedGoals.has(goal.id);

              return (
                <Card key={goal.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                          style={{ background: goal.color ?? "#6366f1" }}
                        />
                        <div>
                          <p className="font-medium text-sm">{goal.name}</p>
                          <p className="text-xs text-muted-foreground">{progressSource(goal)}</p>
                          {goal.note && (
                            <p className="text-xs text-muted-foreground">{goal.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {goal.deadline && (
                          <Badge variant={overdue ? "destructive" : "secondary"} className="text-xs">
                            {overdue ? "Presiahnutý" : days === 0 ? "Dnes!" : `${days}d`}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 w-7 p-0"
                          onClick={() => setDeleteId(goal.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {sym}{Math.round(current).toLocaleString("sk-SK")}
                        </span>
                        <span className="font-medium">
                          {sym}{goal.targetAmount.toLocaleString("sk-SK")}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full transition-all"
                          style={{ width: `${progress}%`, background: goal.color ?? "#6366f1" }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {progress.toFixed(1)}%
                        {progress >= 100 && " — Cieľ dosiahnutý! 🎉"}
                      </p>
                    </div>

                    {/* Milestones section */}
                    <div className="mt-3 pt-3 border-t">
                      <button
                        type="button"
                        className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => toggleExpand(goal.id)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Flag className="w-3.5 h-3.5" />
                          Míľniky
                          {goalMilestones.length > 0 && (
                            <Badge variant="secondary" className="text-xs h-4 px-1.5">
                              {completedCount}/{goalMilestones.length}
                            </Badge>
                          )}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {goalMilestones.length === 0 && (
                            <p className="text-xs text-muted-foreground">Žiadne míľniky.</p>
                          )}
                          {goalMilestones.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 group">
                              <button
                                type="button"
                                onClick={() => toggleMilestone(m)}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {m.completedAt
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  : <Circle className="w-4 h-4" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs ${m.completedAt ? "line-through text-muted-foreground" : ""}`}>
                                  {m.name}
                                </span>
                                {m.targetAmount != null && (
                                  <span className="text-xs text-muted-foreground ml-1.5">
                                    {sym}{m.targetAmount.toLocaleString("sk-SK")}
                                  </span>
                                )}
                                {m.completedAt && (
                                  <span className="text-xs text-muted-foreground ml-1.5">
                                    · {new Date(m.completedAt).toLocaleDateString("sk-SK")}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMilestone(m.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs mt-1"
                            onClick={() => { setMilestoneGoalId(goal.id); setMilestoneForm(EMPTY_MILESTONE_FORM); }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Pridať míľnik
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete goal dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vymazať cieľ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Táto akcia vymaže aj všetky míľniky tohto cieľa. Akcia je nezvratná.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Zrušiť</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Vymazať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add milestone dialog */}
      <Dialog open={milestoneGoalId !== null} onOpenChange={(open) => { if (!open) setMilestoneGoalId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pridať míľnik</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Názov míľnika (napr. 25% dosiahnutých)"
              value={milestoneForm.name}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Cieľová suma míľnika (voliteľné)"
              value={milestoneForm.targetAmount}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, targetAmount: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneGoalId(null)}>Zrušiť</Button>
            <Button onClick={handleAddMilestone}>Pridať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
