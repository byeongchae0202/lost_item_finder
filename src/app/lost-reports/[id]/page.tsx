import { Suspense } from "react";
import LostReportMatchesView from "@/app/lost-report-matches-view";

export default function LostReportMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="loading-state" role="status">신고 경로를 확인하는 중</div>}>
      <ResolvedLostReportMatchesPage params={params} />
    </Suspense>
  );
}

async function ResolvedLostReportMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LostReportMatchesView reportId={id} />;
}
