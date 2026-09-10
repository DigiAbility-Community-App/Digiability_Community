-- Distinguish "left voluntarily" from "removed by an admin".
--
-- Membership previously ended by writing `leftAt` alone, so the two cases
-- were indistinguishable once stored. The server already knew which had
-- happened — conversation.service.removeMember branches on isSelf and
-- broadcasts MEMBER_LEFT vs MEMBER_REMOVED — but that distinction was
-- discarded at the database. The mobile client, having only `leftAt` to go
-- on, labelled every past member "(Removed)", including people who had
-- chosen to leave.
--
-- Values: 'LEFT' | 'REMOVED'. Nullable, and left NULL for existing rows:
-- backfilling would mean guessing, and mislabelling someone as removed when
-- they left is exactly the bug this fixes. The client treats NULL as unknown
-- and falls back to the neutral "(Past member)" wording.

ALTER TABLE "chat"."conversation_members"
  ADD COLUMN "leftReason" TEXT;
