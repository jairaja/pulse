export type VoteChallenge = { challenge: string; cdata: string; expiresAt: number };
export type VerifyVote = (challenge: VoteChallenge) => Promise<string>;
