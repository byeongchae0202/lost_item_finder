"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  MapPin,
  PackageSearch,
  Plus,
  Search,
  Shapes,
  Shirt,
  Smartphone,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/lost-items/categories";
import type { LostItemRecord } from "@/lib/lost-items/database";
import LostReportForm from "./lost-report-form";

type SearchFilters = {
  keyword: string;
  location: string;
  category: ItemCategory | "";
};

type RegistrationFields = {
  title: string;
  category: ItemCategory | "";
  location: string;
  description: string;
  foundDate: string;
};

const categoryIcons: Record<ItemCategory, LucideIcon> = {
  전자기기: Smartphone,
  "지갑/카드": CreditCard,
  "학용품/도서": BookOpen,
  "의류/잡화": Shirt,
  "열쇠/기타": KeyRound,
  "기타 물품": Shapes,
};
const categoryClassNames: Record<ItemCategory, string> = {
  전자기기: "electronics",
  "지갑/카드": "wallet-card",
  "학용품/도서": "school-supplies",
  "의류/잡화": "clothing-accessories",
  "열쇠/기타": "keys-misc",
  "기타 물품": "other",
};

const emptyFilters: SearchFilters = { keyword: "", location: "", category: "" };
const emptyFields: RegistrationFields = {
  title: "",
  category: "",
  location: "",
  description: "",
  foundDate: "",
};

function localDateValue(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function buildSearchUrl(filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
  if (filters.location.trim()) params.set("location", filters.location.trim());
  if (filters.category) params.set("category", filters.category);
  const query = params.toString();
  return query ? `/api/lost-items?${query}` : "/api/lost-items";
}

function formatDate(value: string): string {
  return value.replaceAll("-", ".");
}

export default function Home() {
  const [items, setItems] = useState<LostItemRecord[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [fields, setFields] = useState<RegistrationFields>(emptyFields);
  const [photos, setPhotos] = useState<File[]>([]);
  const [today, setToday] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLostReportOpen, setIsLostReportOpen] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/lost-items")
      .then(async (response) => {
        if (!response.ok) throw new Error("습득물 목록을 불러오지 못했습니다.");
        return (await response.json()) as LostItemRecord[];
      })
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "요청에 실패했습니다.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(buildSearchUrl(filters));
      if (!response.ok) throw new Error("검색 결과를 불러오지 못했습니다.");
      setItems((await response.json()) as LostItemRecord[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "검색에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function openRegistration() {
    const currentDate = localDateValue();
    setToday(currentDate);
    setFields({ ...emptyFields, foundDate: currentDate });
    setPhotos([]);
    setFormError("");
    setNotice("");
    setIsRegisterOpen(true);
  }

  function updateField<Key extends keyof RegistrationFields>(
    key: Key,
    value: RegistrationFields[Key],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function selectPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (photos.length + selected.length > 3) {
      setFormError("사진은 최대 3장까지 첨부할 수 있습니다.");
      return;
    }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      setFormError("사진 한 장의 크기는 5 MB 이하여야 합니다.");
      return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setFormError("JPG, PNG, WEBP 사진만 첨부할 수 있습니다.");
      return;
    }

    setFormError("");
    setPhotos((current) => [...current, ...selected]);
  }

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setFormError("");

    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        formData.set(key, value);
      }
      for (const photo of photos) formData.append("photos", photo);

      const response = await fetch("/api/lost-items", { method: "POST", body: formData });
      const result = (await response.json()) as LostItemRecord | { error: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error : "습득물을 등록하지 못했습니다.");
      }

      const listResponse = await fetch(buildSearchUrl(filters));
      if (!listResponse.ok) throw new Error("등록은 완료됐지만 목록을 새로고침하지 못했습니다.");
      setItems((await listResponse.json()) as LostItemRecord[]);
      setIsRegisterOpen(false);
      setNotice("습득물이 등록됐습니다.");
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "등록에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCategory = ITEM_CATEGORIES.find((category) => category.label === fields.category);

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="찾았어요 홈">
          <span className="brand-mark"><PackageSearch size={21} strokeWidth={2.2} /></span>
          <span className="brand-name">찾았어요</span>
          <span className="brand-divider" />
          <span className="brand-subtitle">CAMPUS LOST & FOUND</span>
        </Link>
        <div className="topbar-actions">
          <span className="open-status"><span />운영 중</span>
          <button className="button button-outline header-lost" onClick={() => setIsLostReportOpen(true)}>
            <CircleHelp size={16} /> 분실 신고
          </button>
          <button className="button button-primary header-register" onClick={openRegistration}>
            <Plus size={17} /> 습득물 등록
          </button>
        </div>
      </header>

      <section className="intro-band">
        <div className="intro-inner">
          <div className="intro-copy">
            <p className="eyebrow"><span>분실물 게시판</span><span className="eyebrow-dot" /> CAMPUS, CONNECTED</p>
            <h1>찾는 사람과<br /><em>발견한 사람</em>을 잇다.</h1>
            <p className="intro-caption">캠퍼스에서 발견된 물건을 등록하고, 주인을 함께 찾아요.</p>
          </div>
          <div className="intro-summary" aria-label="현재 게시 현황">
            <span className="summary-label">등록된 습득물</span>
            <strong>{items.length.toString().padStart(2, "0")}</strong>
            <span className="summary-foot">ITEMS ON THE BOARD <span>↗</span></span>
          </div>
          <div className="intro-stamp" aria-hidden="true"><span>FOUND</span><span>·</span><span>TOGETHER</span></div>
        </div>
      </section>

      <div className="content-wrap">
        <div className="section-heading">
          <div>
            <p className="section-kicker">THE FINDER BOARD</p>
            <h2>습득물 둘러보기 <span>{items.length}</span></h2>
          </div>
          <div className="section-actions">
            <button className="button button-outline mobile-lost" onClick={() => setIsLostReportOpen(true)}>
              <CircleHelp size={15} /> 분실 신고
            </button>
            <button className="button button-primary mobile-register" onClick={openRegistration}>
              <Plus size={16} /> 습득물 등록
            </button>
          </div>
        </div>

        <div className="board-layout">
          <aside className="filter-panel" aria-label="습득물 검색 및 필터">
            <form onSubmit={submitSearch}>
              <div className="filter-title-row">
                <h3><Search size={17} /> 검색 필터</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setFilters(emptyFilters)}
                >초기화</button>
              </div>

              <label className="field-label" htmlFor="keyword-search">키워드</label>
              <div className="input-with-icon">
                <Search size={17} aria-hidden="true" />
                <input
                  id="keyword-search"
                  value={filters.keyword}
                  onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                  placeholder="물품명이나 특징 검색"
                />
              </div>
              <p className="field-hint">물품명 · 특징 · 습득 장소에서 찾아요</p>

              <label className="field-label location-label" htmlFor="location-search">습득 장소</label>
              <div className="input-with-icon">
                <MapPin size={17} aria-hidden="true" />
                <input
                  id="location-search"
                  value={filters.location}
                  onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
                  placeholder="예: 공학관, 도서관"
                />
              </div>

              <div className="category-filter-heading">
                <span className="field-label">카테고리</span>
                <span className="optional-label">선택</span>
              </div>
              <div className="category-options">
                <label className={`category-option ${filters.category === "" ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="filter-category"
                    value=""
                    checked={filters.category === ""}
                    onChange={() => setFilters((current) => ({ ...current, category: "" }))}
                  />
                  <span className="category-option-icon all-icon"><Shapes size={16} /></span>
                  <span>전체 카테고리</span>
                  <span className="radio-indicator" />
                </label>
                {ITEM_CATEGORIES.map((category) => {
                  const Icon = categoryIcons[category.label];
                  return (
                    <label
                      className={`category-option ${filters.category === category.label ? "is-selected" : ""}`}
                      key={category.id}
                    >
                      <input
                        type="radio"
                        name="filter-category"
                        value={category.label}
                        checked={filters.category === category.label}
                        onChange={() => setFilters((current) => ({ ...current, category: category.label }))}
                      />
                      <span className={`category-option-icon category-${category.id}`}><Icon size={16} /></span>
                      <span>{category.label}</span>
                      <span className="radio-indicator" />
                    </label>
                  );
                })}
              </div>
              <button className="button button-primary filter-submit" type="submit" disabled={isLoading}>
                {isLoading ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}
                {isLoading ? "검색 중" : "결과 검색"}
              </button>
            </form>

            <div className="side-note">
              <span className="side-note-icon"><ImagePlus size={17} /></span>
              <p><strong>작은 단서도 도움이 돼요.</strong><br />색상이나 부착물처럼 기억나는 특징을 입력해 보세요.</p>
            </div>
          </aside>

          <section className="results-area" aria-label="검색 결과">
            <div className="results-toolbar">
              <div className="results-count">
                <strong>{items.length}</strong><span>개의 습득물이 있어요</span>
              </div>
              <span className="sort-indicator"><CalendarDays size={15} /> 습득일 최신순</span>
            </div>

            {notice && <p className="notice-banner" role="status"><Check size={16} />{notice}</p>}
            {error && <p className="error-banner" role="alert"><AlertCircle size={16} />{error}</p>}

            {isLoading ? (
              <div className="loading-state" role="status"><LoaderCircle className="spin" size={27} /><span>습득물을 불러오는 중</span></div>
            ) : items.length > 0 ? (
              <div className="item-grid">
                {items.map((item, index) => {
                  const Icon = categoryIcons[item.category];
                  return (
                    <article className="item-card" key={item.id} style={{ "--card-index": index } as React.CSSProperties}>
                      <div className="item-image">
                        {item.photoPaths.length > 0 ? (
                          <Image
                            src={`/api/lost-items/${item.id}/photos/0`}
                            alt={`${item.title} 사진`}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                            unoptimized
                          />
                        ) : (
                          <div className={`image-placeholder placeholder-${categoryClassNames[item.category]}`}>
                            <span className="placeholder-orbit" />
                            <Icon size={34} strokeWidth={1.5} />
                            <span>사진 미등록</span>
                          </div>
                        )}
                        <span className="item-date-chip"><CalendarDays size={13} />{formatDate(item.foundDate)}</span>
                        {item.photoPaths.length > 1 && <span className="photo-count">+{item.photoPaths.length - 1}</span>}
                      </div>
                      <div className="item-card-body">
                        <span className={`item-category category-text-${categoryClassNames[item.category]}`}>{item.category}</span>
                        <h3>{item.title}</h3>
                        <p className="item-description">{item.description}</p>
                        <div className="item-location"><MapPin size={15} /><span>{item.location}</span></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-illustration"><PackageSearch size={38} strokeWidth={1.4} /><span>?</span></div>
                <p className="empty-kicker">NOTHING HERE, YET</p>
                <h3>아직 찾는 결과가 없어요.</h3>
                <p>검색 조건을 바꾸거나 첫 습득물을 등록해 보세요.</p>
                <div className="section-actions">
                  <button className="button button-outline" onClick={() => setIsLostReportOpen(true)}><CircleHelp size={16} /> 분실 신고</button>
                  <button className="button button-primary" onClick={openRegistration}><Plus size={16} /> 습득물 등록</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <footer className="page-footer">
        <span>찾았어요 <span className="footer-dot">●</span> 함께 찾는 캠퍼스</span>
        <span>LOST IS TEMPORARY. FOUND IS TOGETHER.</span>
      </footer>

      {isRegisterOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setIsRegisterOpen(false)}>
          <section className="registration-dialog" role="dialog" aria-modal="true" aria-labelledby="register-title">
            <div className="dialog-header">
              <div>
                <p className="section-kicker">ADD TO THE BOARD</p>
                <h2 id="register-title">습득물 등록</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsRegisterOpen(false)} aria-label="등록 창 닫기">
                <X size={20} />
              </button>
            </div>
            <p className="dialog-intro">기억할 수 있는 정보를 남겨 주시면 주인을 찾는 데 도움이 돼요.</p>
            <form className="registration-form" onSubmit={submitRegistration}>
              <label className="form-field">
                <span>물품명 <b>필수</b></span>
                <input autoFocus required maxLength={80} value={fields.title} onChange={(event) => updateField("title", event.target.value)} placeholder="예: 검은색 무선 이어폰" />
              </label>
              <div className="form-field-row">
                <label className="form-field">
                  <span>카테고리 <b>필수</b></span>
                  <span className="select-wrap">
                    <select required value={fields.category} onChange={(event) => updateField("category", event.target.value as ItemCategory | "")}>
                      <option value="" disabled>카테고리 선택</option>
                      {ITEM_CATEGORIES.map((category) => <option key={category.id} value={category.label}>{category.label}</option>)}
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                <label className="form-field">
                  <span>습득 날짜 <b>필수</b></span>
                  <input type="date" required max={today} value={fields.foundDate} onChange={(event) => updateField("foundDate", event.target.value)} />
                </label>
              </div>
              {selectedCategory && <p className="category-example">예시: {selectedCategory.examples}</p>}
              <label className="form-field">
                <span>습득 장소 <b>필수</b></span>
                <input required maxLength={120} value={fields.location} onChange={(event) => updateField("location", event.target.value)} placeholder="건물명이나 주변 장소를 적어 주세요" />
              </label>
              <label className="form-field">
                <span>물건의 특징 <b>필수</b></span>
                <textarea required maxLength={1000} rows={3} value={fields.description} onChange={(event) => updateField("description", event.target.value)} placeholder="색상, 브랜드, 부착물 등 알아볼 수 있는 특징" />
              </label>
              <div className="form-field">
                <span className="upload-label">사진 <small>선택 · 최대 3장 · 5 MB 이하</small></span>
                <input ref={fileInputRef} id="photo-upload" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectPhotos} />
                <label className="upload-drop" htmlFor="photo-upload">
                  <span className="upload-icon"><ImagePlus size={21} /></span>
                  <span><strong>사진 선택하기</strong><small>JPG, PNG, WEBP</small></span>
                  <span className="upload-arrow">↗</span>
                </label>
                {photos.length > 0 && (
                  <ul className="selected-photos">
                    {photos.map((photo, index) => (
                      <li key={`${photo.name}-${photo.size}-${index}`}>
                        <span><ImagePlus size={14} />{photo.name}<small>{(photo.size / (1024 * 1024)).toFixed(1)} MB</small></span>
                        <button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`${photo.name} 제거`}><X size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {formError && <p className="form-error" role="alert"><AlertCircle size={16} />{formError}</p>}
              <div className="dialog-actions">
                <button className="button button-quiet" type="button" onClick={() => setIsRegisterOpen(false)}>취소</button>
                <button className="button button-primary submit-register" type="submit" disabled={isSaving}>
                  {isSaving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
                  {isSaving ? "등록 중" : "습득물 등록"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isLostReportOpen && <LostReportForm onClose={() => setIsLostReportOpen(false)} />}
    </main>
  );
}
