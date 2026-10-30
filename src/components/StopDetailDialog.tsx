// 장소 상세 모달: 설명·비용·주차·출처와 편집/삭제 버튼.
// (순서 변경은 목록의 "순서 편집" 모드에서 드래그로 합니다)

import { formatTime } from '../lib/datetime';
import { gmaps } from '../lib/links';
import { ExternalLink, Fact, SourceLink } from './common';
import { Modal, ModalHead } from './Modal';
import type { Stop } from '../types';

interface StopDetailDialogProps {
    /** 표시할 장소. null 이면 모달이 닫힙니다. */
    stop: Stop | null;
    /** 정보 확인일 (출처 옆에 표시) */
    checkedAt?: string;
    onClose: () => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

export function StopDetailDialog({ stop, checkedAt, onClose, onEdit, onDelete }: StopDetailDialogProps) {
    return (
        <Modal open={!!stop} onClose={onClose} labelledBy="detail-title">
            {stop && (
                <>
                    <ModalHead
                        id="detail-title"
                        eyebrow={`${formatTime(stop.start, stop.end, stop.timeNote)} · ${stop.kind}`}
                        title={stop.title}
                        onClose={onClose}
                    />
                    <div className="px-[25px] py-5 text-[13px] max-phone:p-[18px]">
                        <p className="whitespace-pre-wrap">{stop.note}</p>
                        <div className="my-[18px] grid gap-[7px]">
                            <Fact label="체류">{stop.duration}</Fact>
                            <Fact label="비용">{stop.fee}</Fact>
                            <Fact label="주차">{stop.parking}</Fact>
                            <Fact label="검색">{stop.query}</Fact>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <ExternalLink href={gmaps(stop.query, true, stop.mode)} className="navlink">구글지도 길찾기 ↗</ExternalLink>
                            {/* 주차장 검색어가 있을 때만 주차장 길찾기 제공 */}
                            {stop.parkingQuery && (
                                <ExternalLink href={gmaps(stop.parkingQuery, true)} className="btn btn-outline">주차장 길찾기 ↗</ExternalLink>
                            )}
                        </div>
                        <p className="mt-3 text-[11px] text-muted">
                            <SourceLink url={stop.source} /> · {checkedAt ? `${checkedAt.replace(/-/g, '.')} 확인` : '확인일 미기재'} / 비용·운영은 현장 공지 우선
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-line px-[25px] py-[18px] max-phone:p-[15px]">
                        <button type="button" className="btn btn-primary" onClick={() => onEdit(stop.id)}>편집</button>
                        <button type="button" className="btn btn-danger" onClick={() => onDelete(stop.id)}>삭제</button>
                    </div>
                </>
            )}
        </Modal>
    );
}
