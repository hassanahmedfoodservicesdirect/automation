"use client";

import { useState } from "react";

interface AcceptProposalButtonProps {
  leadId: string;
  alreadyAccepted: boolean;
}

export function AcceptProposalButton({
  leadId,
  alreadyAccepted
}: AcceptProposalButtonProps) {
  const [accepted, setAccepted] = useState(alreadyAccepted);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/${leadId}/accept`, {
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to accept proposal.");
        return;
      }
      setAccepted(true);
    } catch {
      setError("Unable to accept proposal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="primary"
        disabled={accepted || loading}
        onClick={() => void onAccept()}
      >
        {accepted ? "Proposal Accepted" : loading ? "Accepting..." : "Accept Proposal"}
      </button>
      {error ? (
        <p className="muted" style={{ marginTop: "0.55rem", color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
