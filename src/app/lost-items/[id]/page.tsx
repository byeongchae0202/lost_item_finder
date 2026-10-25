import { Suspense } from "react";
import LostItemDetailView from "@/app/lost-item-detail-view";

export default function LostItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="loading-state" role="status">습득물 정보를 불러오는 중</div>}>
      <ResolvedLostItemDetailPage params={params} />
    </Suspense>
  );
}

async function ResolvedLostItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LostItemDetailView itemId={id} />;
}
