import MetabaseProviderWrapper from "@/components/MetabaseProvider";
import ProgramMetricsSummary from "@/components/ProgramMetricsSummary";

export default function ProgramMetricsPage() {
  return (
    <MetabaseProviderWrapper>
      <ProgramMetricsSummary />
    </MetabaseProviderWrapper>
  );
}
