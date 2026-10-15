export function buildShareAttribution({
  dateLabel,
  includeNickname,
  nickname
}: {
  dateLabel: string;
  includeNickname: boolean;
  nickname: string;
}) {
  const cleanedNickname = nickname.trim();
  if (includeNickname && cleanedNickname) return `${cleanedNickname} · My PULSE · ${dateLabel}`;
  return `My PULSE · ${dateLabel}`;
}

export function buildQuestionCredit({
  creditNickname,
  nickname
}: {
  creditNickname: boolean;
  nickname: string;
}) {
  const cleanedNickname = nickname.trim();
  if (creditNickname && cleanedNickname) return `Community question · ${cleanedNickname}`;
  return 'Community question';
}
