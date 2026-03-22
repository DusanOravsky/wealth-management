"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Target } from "lucide-react";
import { CURRENCIES, FALLBACK_RATES, CURRENCY_SYMBOLS } from "@/lib/constants";
import type { Currency, FinancialGoal } from "@/lib/types";
import { toast } from "sonner";

const GOAL_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f97316", "#3b82f6", "#ec4899"];

const EMPTY_FORM = {
  name: "",
  targetAmount: "",
  currency: "EUR" as Currency,
  deadline: "",
  note: "",
  color: GOAL_COLORS[0],
};

export default function GoalsPage() {
  const { goals, saveGoalsData, portfolioSummary, rates } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function getProgress(goal: FinancialGoal): number {
    const totalEur = portfolioSummary?.totalEur ?? 0;
    const rate = rates[goal.currency] ?? FALLBACK_RATES[goal.currency] ?? 1;
    const currentInCurrency = totalEur * rate;
    return Math.min(100, (currentInCurrency / goal.targetAmount) * 100);
  }

  function getCurrentValue(goal: FinancialGoal): number {
    const totalEur = portfolioSummary?.totalEur ?? 0;
    const rate = rates[goal.currency] ?? FALLBACK_RATES[goal.currency] ?? 1;
    return totalEur * rate;
  }

  function handleAdd() {
    if (!form.name.trim()) { toast.error("Zadaj názov cieľa."); return; }
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      toast.error("Zadaj kladnú cieľovú sumu.");
      return;
    }
    const newGoal: FinancialGoal = {
      id: Date.now().toString(),
      name: form.name.trim(),
      targetAmount: Number(form.targetAmount),
      currency: form.currency,
      deadline: form.deadline || undefined,
      note: form.note.trim() || undefined,
      color: form.color,
    };
    saveGoalsData([...goals, newGoal]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    toast.success("Cieľ pridaný.");
  }

  function handleDelete(id: string) {
    if (!confirm("Vymazať tento cieľ?")) return;
    saveGoalsData(goals.filter((g) => g.id !== id));
    toast.success("Cieľ vymazaný.");
  }

  function daysLeft(deadline: string): number | null {
    const d = new Date(deadline);
    const diff = d.getTime() - Date.now();
    if (diff < 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ciele</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Progres je počítaný z celkového portfólia
            </p>
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
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Target className="w-12 h-12 opacity-30" />
            <p>Žiadne ciele. Klikni na &quot;Pridať cieľ&quot;.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const progress = getProgress(goal);
              const current = getCurrentValue(goal);
              const sym = CURRENCY_SYMBOLS[goal.currency] ?? goal.currency;
              const days = goal.deadline ? daysLeft(goal.deadline) : null;
              const overdue = goal.deadline && days === null;

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
                          {goal.note && (
                            <p className="text-xs text-muted-foreground">{goal.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {goal.deadline && (
                          <Badge variant={overdue ? "destructive" : "secondary"} className="text-xs">
                            {overdue
                              ? "Presiahnutý"
                              : days === 0
                              ? "Dnes!"
                              : `${days}d`}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 w-7 p-0"
                          onClick={() => handleDelete(goal.id)}
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
                          style={{
                            width: `${progress}%`,
                            background: goal.color ?? "#6366f1",
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {progress.toFixed(1)}%
                        {progress >= 100 && " — Cieľ dosiahnutý!"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
