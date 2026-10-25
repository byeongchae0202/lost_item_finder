"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, ChevronDown, LoaderCircle, MapPin, PackageSearch } from "lucide-react";
import { useEffect, useState } from "react";
import type { ItemCategory } from "@/lib/lost-items/categories";
import { LOST_ITEM_CUSTODY_STATUSES, type LostItemCustodyStatus } from "@/lib/lost-items/custody-status";

type ItemDetail = {
  id: string;
  title: string;
  category: ItemCategory;
  location: string;
  description: string;
  foundDate: string;
  photoPaths: string[];
  custodyStatus: LostItemCustodyStatus;
  isOwner: boolean;
};

type LostItemDetailViewProps = {
  itemId: string;
};

function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

export default function LostItemDetailView({ itemId }: LostItemDetailViewProps) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<LostItemCustodyStatus>("held_by_finder");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/lost-items/${encodeURIComponent(itemId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("습득물을 찾을 수 없습니다.");
        return (await response.json()) as ItemDetail;
      })
      .then((result) => {
        if (!active) return;
        setItem(result);
        setSelectedStatus(result.custodyStatus);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "요청에 실패했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [itemId]);

  async function saveStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item?.isOwner) return;
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/lost-items/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ custodyStatus: selectedStatus }),
      });
      const result = await response.json() as { custodyStatus?: LostItemCustodyStatus; error?: string };
      if (!response.ok || !result.custodyStatus) {
        throw new Error(result.error ?? "보관 상태를 저장하지 못했습니다.");
      }
      setItem((current) => current ? { ...current, custodyStatus: result.custodyStatus! } : current);
      setSelectedStatus(result.custodyStatus);
      setNotice(result.custodyStatus === "returned" ? "주인에게 전달 완료 처리했습니다." : "보관 상태를 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "보관 상태 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const statusLabel = (value: LostItemCustodyStatus) =>
    LOST_ITEM_CUSTODY_STATUSES.find((status) => status.value === value)?.label ?? "습득자가 보관 중";

  return (
    <main className="app-shell detail-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="습득물 목록으로">
          <span className="brand-mark"><PackageSearch size={19} /></span>
          <span className="brand-name">찾았어요</span>
        </Link>
        <Link className="detail-back-top" href="/"><ArrowLeft size={15} /> 목록</Link>
      </header>

      <div className="content-wrap detail-content">
        <Link className="back-link" href="/"><ArrowLeft size={15} /> 습득물 목록</Link>
        {isLoading ? (
          <div className="loading-state" role="status"><LoaderCircle className="spin" size={24} /><span>습득물 정보를 불러오는 중</span></div>
        ) : error || !item ? (
          <section className="detail-not-found">
            <h1>습득물을 찾을 수 없습니다.</h1>
            <Link className="button button-outline" href="/">목록으로</Link>
          </section>
        ) : (
          <article className="item-detail">
            <div className="item-detail-image">
              {item.photoPaths.length > 0 ? (
                <Image
                  src={`/api/lost-items/${item.id}/photos/0`}
                  alt={`${item.title} 사진`}
                  fill
                  sizes="(max-width: 760px) 100vw, 820px"
                  unoptimized
                />
              ) : (
                <div className={`image-placeholder placeholder-${item.category.toLowerCase()}`}>
                  <PackageSearch size={34} strokeWidth={1.5} />
                  <span>사진 미등록</span>
                </div>
              )}
            </div>
            <div className="item-detail-body">
              <div className="item-card-meta">
                <span className="item-category">{item.category}</span>
                <span className={`custody-badge custody-${item.custodyStatus} ${item.custodyStatus === "returned" ? "custody-badge-complete" : ""}`}>
                  {item.custodyStatus === "returned" && <Check size={13} />}
                  {statusLabel(item.custodyStatus)}
                </span>
              </div>
              <div className="item-detail-title-row">
                <h1>{item.title}</h1>
                <div className="detail-facts">
                  <span><MapPin size={15} />{item.location}</span>
                  <span><CalendarDays size={15} />{formatDate(item.foundDate)}</span>
                </div>
              </div>
              <p className="item-detail-description">{item.description}</p>
              {item.photoPaths.length > 1 && <p className="detail-photo-count">사진 {item.photoPaths.length}장</p>}

              {item.isOwner && item.custodyStatus !== "returned" && (
                <form className="item-detail-status-form" onSubmit={saveStatus}>
                  <label htmlFor="custody-status">보관 상태 수정</label>
                  <span className="select-wrap">
                    <select id="custody-status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as LostItemCustodyStatus)}>
                      {LOST_ITEM_CUSTODY_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                    <ChevronDown size={16} />
                  </span>
                  <button className="button button-primary" type="submit" disabled={isSaving || selectedStatus === item.custodyStatus}>
                    {isSaving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
                    상태 저장
                  </button>
                </form>
              )}
              {notice && <p className="notice-banner" role="status"><Check size={16} />{notice}</p>}
              {error && <p className="error-banner" role="alert">{error}</p>}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
