"use client";

export function SaveModeOption({
  selected,
  onSelect,
  disabled,
  label,
  description,
  icon,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded border p-2 transition-colors ${
        selected
          ? "bg-primary/10 border-primary/30"
          : "border-transparent hover:bg-accent/30"
      } ${disabled ? "opacity-50" : "cursor-pointer"}`}
      onClick={() => !disabled && onSelect()}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full border flex items-center justify-center shrink-0 ${
            selected ? "bg-primary border-primary" : "border-muted-foreground/30"
          }`}
        >
          {selected && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
          )}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium">{label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{description}</div>
        </div>
      </div>
      {children && <div className="pl-5 mt-1">{children}</div>}
    </div>
  );
}
