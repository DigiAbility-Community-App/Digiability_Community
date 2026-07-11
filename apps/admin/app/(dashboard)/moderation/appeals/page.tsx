"use client";

// ─────────────────────────────────────────────────────
// Appeals / Dismissed Items Page (Tier E)
//
// Shows DISMISSED UserReports and ModerationFlags so a senior
// moderator can reconsider false-positive dismissals and
// re-open them (resets status back to PENDING).
// ─────────────────────────────────────────────────────

import { ReviewQueue } from "../ReviewQueue";

export default function AppealsPage() {
  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#1A1C1C]">Appeals &amp; Dismissed Items</h1>
        <p className="text-sm text-[#7D7387] mt-1">
          Items dismissed by moderators appear here for senior review.
          Use the action menu to re-open (dismiss → the item resets to Pending).
        </p>
      </div>
      {/* Reuse the ReviewQueue with the DISMISSED filter pre-selected */}
      <ReviewQueue defaultStatus="DISMISSED" />
    </div>
  );
}
