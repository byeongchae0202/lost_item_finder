"use client";

import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/lost-items/categories";

type LostReportFields = {
  title: string;
  category: ItemCategory | "";
  location: string;
  lostDate: string;
  description: string;
};

function localDateValue(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

type LostReportFormProps = {
  onClose: () => void;
};

export default function LostReportForm({ onClose }: LostReportFormProps) {
  const router = useRouter();
  const [today] = useState(localDateValue);
  const [fields, setFields] = useState<LostReportFields>({
    title: "",
    category: "",
    location: "",
    lostDate: today,
    description: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedCategory = ITEM_CATEGORIES.find((category) => category.label === fields.category);

  function updateField<Key extends keyof LostReportFields>(key: Key, value: LostReportFields[Key]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function selectPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (photos.length + selected.length > 3) {
      setError("사진은 최대 3장까지 첨부할 수 있습니다.");
      return;
    }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("사진 한 장의 크기는 5 MB 이하여야 합니다.");
      return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("JPG, PNG, WEBP 사진만 첨부할 수 있습니다.");
      return;
    }

    setError("");
    setPhotos((current) => [...current, ...selected]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) formData.set(key, value);
      for (const photo of photos) formData.append("photos", photo);

      const response = await fetch("/api/lost-reports", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const result = (await response.json()) as { reportId?: string; error?: string };
      if (!response.ok || !result.reportId) {
        throw new Error(result.error ?? "분실 신고를 등록하지 못했습니다.");
      }

      router.push(`/lost-reports/${result.reportId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "분실 신고에 실패했습니다.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="registration-dialog" role="dialog" aria-modal="true" aria-labelledby="lost-report-title">
        <div className="dialog-header">
          <div>
            <p className="section-kicker">PRIVATE LOST REPORT</p>
            <h2 id="lost-report-title">분실 신고</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="분실 신고 창 닫기">
            <X size={20} />
          </button>
        </div>
        <p className="dialog-intro">신고와 매칭 결과는 이 브라우저에서만 확인할 수 있어요.</p>
        <form className="registration-form" onSubmit={submit}>
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
              <span>분실 날짜 <b>필수</b></span>
              <input type="date" required max={today} value={fields.lostDate} onChange={(event) => updateField("lostDate", event.target.value)} />
            </label>
          </div>
          {selectedCategory && <p className="category-example">예시: {selectedCategory.examples}</p>}
          <label className="form-field">
            <span>분실 장소 <b>필수</b></span>
            <input required maxLength={120} value={fields.location} onChange={(event) => updateField("location", event.target.value)} placeholder="마지막으로 본 건물이나 장소" />
          </label>
          <label className="form-field">
            <span>특징 설명 <small>선택</small></span>
            <textarea maxLength={1000} rows={3} value={fields.description} onChange={(event) => updateField("description", event.target.value)} placeholder="색상, 브랜드, 케이스 등 기억나는 특징" />
          </label>
          <div className="form-field">
            <span className="upload-label">사진 <small>선택 · 최대 3장 · 장당 5 MB 이하</small></span>
            <input id="lost-photo-upload" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectPhotos} />
            <label className="upload-drop" htmlFor="lost-photo-upload">
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
          {error && <p className="form-error" role="alert"><AlertCircle size={16} />{error}</p>}
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>취소</button>
            <button className="button button-primary submit-register" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <CalendarDays size={17} />}
              {isSubmitting ? "분실 신고 중" : "분실 신고"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
