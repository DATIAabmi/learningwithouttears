"use client";

import { StaticQuestion } from "@metabase/embedding-sdk-react";
import { useFilter } from "./FilterContext";

interface Props {
  questionId: number;
  campaignSqlKey?: string;
  districtSqlKey?: string;
  dateStartSqlKey?: string;
  dateEndSqlKey?: string;
  staticParams?: Record<string, string>;
}

export default function QuestionEmbed({
  questionId,
  campaignSqlKey,
  districtSqlKey,
  dateStartSqlKey,
  dateEndSqlKey,
  staticParams,
}: Props) {
  const { campaign, district, dateStart, dateEnd } = useFilter();

  // campaignSqlKey is a required SQL template tag — block render if value is empty
  // to avoid Metabase's "missing required parameters" error.
  if (campaignSqlKey && campaign.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 14 }}>
        Select an ABMi Campaign to load data.
      </div>
    );
  }

  // Only include params with non-empty values so Metabase's [[ ]] optional blocks
  // omit the condition instead of running IN ('') which matches zero rows.
  const sqlParameters: Record<string, string> = {};
  Object.entries(staticParams ?? {}).forEach(([k, v]) => { if (v) sqlParameters[k] = v; });
  if (campaignSqlKey)                     sqlParameters[campaignSqlKey]  = campaign.join(",");
  if (districtSqlKey && district.length)  sqlParameters[districtSqlKey]  = district.join(",");
  if (dateStartSqlKey && dateStart)       sqlParameters[dateStartSqlKey] = dateStart;
  if (dateEndSqlKey && dateEnd)           sqlParameters[dateEndSqlKey]   = dateEnd;

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <StaticQuestion
        questionId={questionId}
        sqlParameters={sqlParameters}
        height="100%"
      />
    </div>
  );
}
