import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

interface Tech {
  icon: IconName;
  color: string;
  name: string;
  role: string;
}

const technologies: Tech[] = [
  { icon: "monitor",  color: "#ecedee", name: "Next.js 15",  role: "Frontend"     },
  { icon: "server",   color: "#10b981", name: "FastAPI",     role: "Backend API"  },
  { icon: "database", color: "#3b82f6", name: "PostgreSQL",  role: "Metadata"     },
  { icon: "box",      color: "#ef4444", name: "Redis",       role: "Queue/Cache"  },
  { icon: "workflow", color: "#f59e0b", name: "Celery",      role: "Workers"      },
  { icon: "sparkles", color: "#7c4dff", name: "Qdrant",      role: "Vector DB"    },
  { icon: "cpu",      color: "#3b82f6", name: "Gemini",      role: "Generation"   },
  { icon: "server",   color: "#10b981", name: "Ollama",      role: "Local AI"     },
  { icon: "layers",   color: "#a0a6b0", name: "Docker",      role: "Deployment"   },
];

export default function TechStackSection() {
  return (
    <section className="relative py-20 sm:py-28 bg-[#0a0b0e]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7c4dff] mb-3">
            Technology
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#ecedee]">
            Built on technologies
            <br />
            engineers trust
          </h2>
          <p className="text-base leading-relaxed text-[#a0a6b0] mt-4 max-w-xl mx-auto">
            Open source from top to bottom. No vendor lock-in, no black boxes.
          </p>
        </div>

        {/* Tech grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 mt-12 max-w-3xl mx-auto">
          {technologies.map((tech) => (
            <div
              key={`${tech.name}-${tech.role}`}
              className="rounded-xl border border-[#272b33] bg-[#111317] p-5 flex flex-col items-center gap-3 hover:border-[#7c4dff]/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-[#181b20] flex items-center justify-center">
                <Icon name={tech.icon} size={24} style={{ color: tech.color }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#ecedee] leading-tight">{tech.name}</p>
                <p className="text-xs text-[#6b7280] mt-0.5">{tech.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <Icon name="checkCircle" size={14} style={{ color: "#10b981" }} />
          <span className="text-sm text-[#6b7280]">Self-hostable</span>
          <span className="text-[#272b33] mx-1">·</span>
          <Icon name="checkCircle" size={14} style={{ color: "#10b981" }} />
          <span className="text-sm text-[#6b7280]">Open source</span>
          <span className="text-[#272b33] mx-1">·</span>
          <Icon name="checkCircle" size={14} style={{ color: "#10b981" }} />
          <span className="text-sm text-[#6b7280]">No vendor lock-in</span>
        </div>
      </div>
    </section>
  );
}
