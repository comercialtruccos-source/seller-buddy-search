import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Filter,
  X,
  AlertTriangle,
  Package,
  Zap,
  Trash2,
  RotateCcw,
} from "lucide-react";
import type {
  AnalyticsFilterState,
  AnalyticsPreset,
} from "@/lib/inventoryAnalytics";
import { EMPTY_FILTERS } from "@/lib/inventoryAnalytics";

interface AnalyticsFiltersProps {
  filters: AnalyticsFilterState;
  onFilterChange: (filters: AnalyticsFilterState) => void;
  availableBodegas: string[];
  availableTallas: string[];
  availableColors: string[];
}

const PRESETS: {
  key: AnalyticsPreset;
  label: string;
  icon: React.ElementType;
  cls: string;
}[] = [
  {
    key: "broken-sizes",
    label: "Tallas Rotas",
    icon: AlertTriangle,
    cls: "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    key: "overstock",
    label: "Sobrestock",
    icon: Package,
    cls: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  {
    key: "low-stock",
    label: "Stock Bajo",
    icon: Zap,
    cls: "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "orphans",
    label: "Huérfanos (1 ud)",
    icon: Trash2,
    cls: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300",
  },
];

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [search, setSearch] = React.useState("");

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs gap-1 ${selected.length > 0 ? "border-primary bg-primary/5" : ""}`}
        >
          <Filter className="h-3 w-3" />
          {label}
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-4 px-1 text-[9px] bg-primary text-primary-foreground"
            >
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
        <ScrollArea className="h-[200px]">
          <div className="space-y-0.5">
            {filtered.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs"
              >
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    if (checked) onChange([...selected, opt]);
                    else onChange(selected.filter((s) => s !== opt));
                  }}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sin resultados
              </p>
            )}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 h-7 text-xs"
            onClick={() => onChange([])}
          >
            <X className="h-3 w-3 mr-1" /> Limpiar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function AnalyticsFilters({
  filters,
  onFilterChange,
  availableBodegas,
  availableTallas,
  availableColors,
}: AnalyticsFiltersProps) {
  const hasActiveFilters =
    filters.searchQuery ||
    filters.selectedBodegas.length > 0 ||
    filters.selectedTallas.length > 0 ||
    filters.selectedColors.length > 0 ||
    filters.healthTiers.length > 0 ||
    filters.preset !== null;

  const applyPreset = (preset: AnalyticsPreset) => {
    if (filters.preset === preset) {
      // Toggle off
      onFilterChange({ ...EMPTY_FILTERS });
      return;
    }
    const base = { ...EMPTY_FILTERS, preset };
    switch (preset) {
      case "overstock":
        onFilterChange({ ...base, healthTiers: ["overstock"] });
        break;
      case "low-stock":
        onFilterChange({ ...base, healthTiers: ["low"] });
        break;
      case "orphans":
        // Orphans are handled at page level by filtering saldo === 1
        onFilterChange({ ...base });
        break;
      case "broken-sizes":
        // Broken sizes handled at page level
        onFilterChange({ ...base });
        break;
      default:
        onFilterChange(base);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar referencia, descripción, SKU..."
            value={filters.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filters, searchQuery: e.target.value, preset: null })
            }
            className="h-9 pl-9 text-sm"
          />
        </div>

        <MultiSelectFilter
          label="Bodega"
          options={availableBodegas}
          selected={filters.selectedBodegas}
          onChange={(v) =>
            onFilterChange({ ...filters, selectedBodegas: v, preset: null })
          }
        />
        <MultiSelectFilter
          label="Talla"
          options={availableTallas}
          selected={filters.selectedTallas}
          onChange={(v) =>
            onFilterChange({ ...filters, selectedTallas: v, preset: null })
          }
        />
        <MultiSelectFilter
          label="Color"
          options={availableColors}
          selected={filters.selectedColors}
          onChange={(v) =>
            onFilterChange({ ...filters, selectedColors: v, preset: null })
          }
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={() => onFilterChange({ ...EMPTY_FILTERS })}
          >
            <RotateCcw className="h-3 w-3" /> Limpiar todo
          </Button>
        )}
      </div>

      {/* Presets row */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const isActive = filters.preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? p.cls + " ring-2 ring-offset-1 ring-current"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="h-3 w-3" />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
