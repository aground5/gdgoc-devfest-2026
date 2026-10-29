// Participant login codes: "LLLL-SSSS-SSSS". LLLL is the public login id (participant_private.login_id),
// the 8 S characters are the secret, stored by Supabase Auth only as the user's (hashed) password.

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
export const PARTICIPANT_DOMAIN = "participants.devfest.invalid";

export const participantEmail = (loginId: string) => `${loginId.toLowerCase()}@${PARTICIPANT_DOMAIN}`;

export const formatCode = (loginId: string, secret: string) => `${loginId}-${secret.slice(0, 4)}-${secret.slice(4)}`;

// Accepts any spacing/dashes/case; returns null unless it has the right shape.
export function parseCode(input: string): { loginId: string; secret: string } | null {
  const clean = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (clean.length !== 12 || [...clean].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return { loginId: clean.slice(0, 4), secret: clean.slice(4) };
}
