import type { Member } from '../api/checkup';

/** 가족 구성원 전환 (관리 탭 공통) */
export function MemberSwitch({ members, value, onChange }: { members: Member[]; value: string | null; onChange: (id: string) => void }) {
  if (members.length < 2) return null;
  return (
    <div className="segmented member-switch" role="tablist" aria-label="가족 구성원">
      {members.map((m) => (
        <button key={m.id} role="tab" aria-selected={m.id === value} className={m.id === value ? 'active' : ''} onClick={() => onChange(m.id)}>
          {m.name ?? '이름 없음'}
        </button>
      ))}
    </div>
  );
}
