export type VoteChoice = 'YES' | 'NO';
export type FinalResult = VoteChoice | 'TIE';

export type QuestionSummary = {
  askedOn: string;
  id: string;
  questionText: string;
  sourceLanguage: string;
  sponsored: boolean;
};

export type TodayQuestion = QuestionSummary & {
  serverTime: string;
  votingClosesAt: string;
};

export type FinalizedResult = QuestionSummary & {
  finalResult: FinalResult;
  finalizedAt: string;
  noCount: number;
  totalVotes: number;
  yesCount: number;
};

export type VoteReceipt = {
  alreadyCounted?: boolean;
  acceptedAt: string;
  choice: VoteChoice | null;
  questionId: string;
  receiptId: string;
};

export type ResultPage = {
  items: FinalizedResult[];
  nextCursor: string | null;
};
