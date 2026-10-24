"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  LockKeyhole,
  LoaderCircle,
  MapPin,
  PackageSearch,
  SearchCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ItemCategory } from "@/lib/lost-items/categories";
import type { LostItemMatch } from "@/lib/lost-reports/matching";

type PrivateReportSummary = {
  id: string;
  title: string;
  category: ItemCategory;
  location: string;
  lostDate: string;
  description?: string;
  photoCount: number;
};

type MatchResponse = {
  report: PrivateReportSummary;
  matches: LostItemMatch[];
};

type LostReportMatchesViewProps = {
  reportId: string;
};

function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

export default function LostReportMatchesView({ reportId }: LostReportMatchesViewProps) {
  const [data, setData] = useState<MatchResponse | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<LostItemMatch | null>(null);
  const [resolvedItemIds, setResolvedItemIds] = useState<string[]>([]);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`/api/lost-reports/${encodeURIComponent(reportId)}/matches`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("신고를 찾을 수 없거나 이 브라우저에서 조회할 수 없습니다.");
        return (await response.json()) as MatchResponse;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "매칭 결과를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportId]);

  async function markItemFound() {
    if (!selectedMatch) return;
    setIsResolving(true);
    setActionError("");

    try {
      const response = await fetch(`/api/lost-reports/${encodeURIComponent(reportId)}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: selectedMatch.itemId }),
      });
      if (!response.ok) throw new Error("게시물을 완료 처리할 수 없습니다.");

      const resolvedId = selectedMatch.itemId;
      setResolvedItemIds((current) => [...current, resolvedId]);
      setData((current) => current
        ? { ...current, matches: current.matches.filter((match) => match.itemId !== resolvedId) }
        : current);
      setSelectedMatch(null);
      setConfirmResolve(false);
      setNotice("찾은 물건을 습득물 목록에서 숨겼습니다.");
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "완료 처리에 실패했습니다.");
    } finally {
      setIsResolving(false);
    }
  }

  const visibleMatches = data?.matches.filter((match) => !resolvedItemIds.includes(match.itemId)) ?? [];

  return (
    <main className="app-shell match-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="찾았어요 홈">
          <span className="brand-mark"><PackageSearch size={21} strokeWidth={2.2} /></span>
          <span className="brand-name">찾았어요</span>
          <span className="brand-divider" />
          <span className="brand-subtitle">PRIVATE MATCH RESULTS</span>
        </Link>
        <span className="private-label"><LockKeyhole size={15} /> 비공개 신고</span>
      </header>

      <section className="intro-band match-intro">
        <div className="intro-inner">
          <div className="intro-copy">
            <p className="eyebrow"><span>분실 신고</span><span className="eyebrow-dot" /> MATCH RESULTS</p>
            <h1>비슷한 습득물을<br /><em>찾아봤어요.</em></h1>
            <p className="intro-caption">카테고리와 날짜를 확인하고, 장소와 특징이 가까운 순서로 정리했습니다.</p>
          </div>
          <div className="intro-summary" aria-label="매칭 후보 수">
            <span className="summary-label">매칭 후보</span>
            <strong>{data ? visibleMatches.length.toString().padStart(2, "0") : "--"}</strong>
            <span className="summary-foot">POSSIBLE MATCHES</span>
          </div>
        </div>
      </section>

      <div className="content-wrap match-content">
        <Link className="back-link" href="/"><ArrowLeft size={15} /> 게시판으로 돌아가기</Link>
      {notice && <p className="notice-banner" role="status"><Check size={16} />{notice}</p>}
        {isLoading ? (
          <div className="loading-state" role="status"><LoaderCircle className="spin" size={27} /><span>매칭 결과를 불러오는 중</span></div>
        ) : error ? (
          <div className="empty-state match-error">
            <div className="empty-illustration"><LockKeyhole size={34} strokeWidth={1.5} /></div>
            <p className="empty-kicker">PRIVATE REPORT</p>
            <h2>신고를 확인할 수 없어요.</h2>
            <p role="alert">{error}</p>
            <Link className="button button-primary" href="/"><ArrowLeft size={16} /> 게시판으로</Link>
          </div>
        ) : data ? (
          <>
            <section className="report-summary" aria-label="내 분실 신고">
              <div className="report-summary-heading">
                <span className="report-summary-label"><LockKeyhole size={14} /> 내 분실 신고</span>
                <span className="report-category">{data.report.category}</span>
              </div>
              <h2>{data.report.title}</h2>
              <div className="report-facts">
                <span><MapPin size={15} />{data.report.location}</span>
                <span><CalendarDays size={15} />{formatDate(data.report.lostDate)}</span>
              </div>
              {data.report.description && <p>{data.report.description}</p>}
            </section>

            <div className="match-section-heading">
              <div>
                <p className="section-kicker">FOUND ITEMS · 30 DAYS</p>
                <h2>비슷한 습득물 <span>{visibleMatches.length}</span></h2>
              </div>
              <span className="match-sort"><SearchCheck size={16} /> 관련도순</span>
            </div>

            {visibleMatches.length > 0 ? (
              <div className="item-grid match-grid">
                {visibleMatches.map((match, index) => (
                  <article className="item-card match-card" key={match.itemId} style={{ "--card-index": index } as React.CSSProperties}>
                    <div className="item-image">
                      {match.thumbnailUrl ? (
                        <Image
                          src={match.thumbnailUrl}
                          alt={`${match.title} 사진`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                          unoptimized
                        />
                      ) : (
                        <div className="image-placeholder placeholder-other">
                          <PackageSearch size={34} strokeWidth={1.5} />
                          <span>사진 미등록</span>
                        </div>
                      )}
                      <span className="item-date-chip"><CalendarDays size={13} />{formatDate(match.foundDate)}</span>
                      <span className="match-score">일치도 <strong>{match.score}</strong></span>
                    </div>
                    <div className="item-card-body">
                      <span className="item-category">{match.category}</span>
                      <h3>{match.title}</h3>
                      <p className="item-description">{match.description}</p>
                      <div className="item-location"><MapPin size={15} /><span>{match.location}</span></div>
                      <div className="match-reasons" aria-label="매칭 근거">
                        {match.reasons.map((reason) => <span key={reason}><Check size={12} />{reason}</span>)}
                      </div>
                      <button className="button button-outline match-confirm" onClick={() => setSelectedMatch(match)}>
                        후보 확인 <ChevronRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state match-empty">
                <div className="empty-illustration"><SearchCheck size={38} strokeWidth={1.4} /></div>
                <p className="empty-kicker">NO MATCHES, YET</p>
                <h2>아직 비슷한 습득물이 없어요.</h2>
                <p>새 습득물이 등록되면 이 브라우저에서 다시 확인할 수 있어요.</p>
                <Link className="button button-outline" href="/"><ArrowLeft size={16} /> 게시판으로 돌아가기</Link>
              </div>
            )}
          </>
        ) : null}
      </div>

      <footer className="page-footer">
        <span>찾았어요 <span className="footer-dot">●</span> 분실 신고 결과</span>
        <span>PRIVATE TO THIS BROWSER</span>
      </footer>

      {selectedMatch && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedMatch(null)}>
          <section className="registration-dialog match-dialog" role="dialog" aria-modal="true" aria-labelledby="match-detail-title">
            <div className="dialog-header">
              <div>
                <p className="section-kicker">POSSIBLE MATCH</p>
                <h2 id="match-detail-title">후보 상세</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedMatch(null)} aria-label="후보 상세 닫기"><X size={20} /></button>
            </div>
            <div className="match-detail-body">
              {selectedMatch.thumbnailUrl && (
                <div className="match-detail-image">
                  <Image src={selectedMatch.thumbnailUrl} alt={`${selectedMatch.title} 사진`} fill sizes="540px" unoptimized />
                </div>
              )}
              <span className="item-category">{selectedMatch.category}</span>
              <h3>{selectedMatch.title}</h3>
              <p>{selectedMatch.description}</p>
              <div className="report-facts">
                <span><MapPin size={15} />{selectedMatch.location}</span>
                <span><CalendarDays size={15} />{formatDate(selectedMatch.foundDate)}</span>
              </div>
              <div className="match-detail-reasons">
                <strong>매칭 정보</strong>
                {selectedMatch.reasons.map((reason) => <span key={reason}><Check size={14} />{reason}</span>)}
              </div>
            </div>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            {confirmResolve ? (
              <div className="resolve-confirm">
                <p>확인하면 이 습득물 게시물이 전체 목록에서 사라집니다.</p>
                <div className="dialog-actions">
                  <button className="button button-quiet" type="button" onClick={() => setConfirmResolve(false)}>취소</button>
                  <button className="button button-primary" type="button" onClick={markItemFound} disabled={isResolving}>
                    {isResolving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
                    {isResolving ? "처리 중" : "목록에서 숨기기"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="dialog-actions match-dialog-actions">
                <button className="button button-outline" type="button" onClick={() => setConfirmResolve(true)}>찾았어요</button>
                <button className="button button-primary" type="button" onClick={() => setSelectedMatch(null)}>닫기</button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
