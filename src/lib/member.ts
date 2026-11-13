import { useEffect, useState } from 'react';
import { getMyMemberId, listMembers, listRecords, type Member } from '../api/checkup';

const KEY = 'dash.viewMember';

function readKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * 관리 탭에서 보고 있는 가족 구성원. 건강 기록·아플 때 화면이 같은 사람을 보여 주도록 기기에 기억한다.
 * 처음엔 '나'(dash_profile.health_member_id), 없으면 기록이 가장 많은 사람.
 */
export function useViewedMember() {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([listMembers(), getMyMemberId(), listRecords()])
      .then(([m, me, records]) => {
        setMembers(m);
        const saved = readKey();
        const busiest = [...m].sort((a, b) => records.filter((x) => x.member_id === b.id).length - records.filter((x) => x.member_id === a.id).length)[0];
        const pick = [saved, me].find((id) => id && m.some((x) => x.id === id)) ?? busiest?.id ?? null;
        setMemberIdState(pick);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const setMemberId = (id: string) => {
    setMemberIdState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* 저장 못 해도 화면은 동작 */
    }
  };

  return { members, memberId, setMemberId, member: members.find((m) => m.id === memberId) ?? null, loading, error };
}

export function ageOf(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}
