import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import ArchitectureSection from "@/components/landing/ArchitectureSection";
import WhyDifferentSection from "@/components/landing/WhyDifferentSection";
import RAGOpsSection from "@/components/landing/RAGOpsSection";
import TraceSection from "@/components/landing/TraceSection";
import TechStackSection from "@/components/landing/TechStackSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata = {
  title: "DevPilot AI — AI-Powered Engineering Knowledge Platform",
  description: "Upload documents, ask questions, get answers with citations. Full RAG observability, workspace isolation, and answer evaluation for engineering teams.",
};

export default function HomePage() {
  return (
    <div className="bg-[#0a0b0e] min-h-screen overflow-x-hidden">
      <LandingNav />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ArchitectureSection />
        <WhyDifferentSection />
        <RAGOpsSection />
        <TraceSection />
        <TechStackSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
