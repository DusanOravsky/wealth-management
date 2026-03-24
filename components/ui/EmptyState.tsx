import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      {action && onAction && (
        <Button size="sm" className="mt-4" onClick={onAction}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {action}
        </Button>
      )}
    </div>
  );
}
