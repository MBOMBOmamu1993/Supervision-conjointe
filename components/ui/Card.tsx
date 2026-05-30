import { cn } from "@/lib/client/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("card", className)}>{children}</section>;
}

export function CardHeader({ title, subtitle, right, icon }: { title: string; subtitle?: string; right?: React.ReactNode; icon?: IconName }) {
  return (
    <header className="card-header">
      <div className="min-w-0 flex items-start gap-2">
        {icon ? (
          <span className="mt-px w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0 text-navy-700" style={{ background: "rgba(0,32,92,0.08)" }}>
            <Icon name={icon} className="w-[15px] h-[15px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {subtitle ? <div className="card-subtitle mt-0.5">{subtitle}</div> : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2 shrink-0">{right}</div> : null}
    </header>
  );
}

/** Bandeau de section bleu marine OMS (cf. maquette). */
export function SectionBar({ children, icon }: { children: React.ReactNode; icon?: IconName }) {
  return (
    <div className="section-bar">
      {icon ? <Icon name={icon} /> : null}
      {children}
    </div>
  );
}
