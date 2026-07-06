"use client";

import { useState, useTransition } from "react";
import { Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { setBookSectionVisibility } from "../actions";

// v1.24.0: section-level visibility toggle. Mirrors the per-page
// SubsectionEditor toggle (C1, v1.14.0) but operates on the parent
// BookSection — flipping it hides the whole section from non-couple
// users, not just one page within it. Couple-only at every layer
// (server action throws for non-couple regardless).
export function SectionVisibilityToggle({
  sectionId,
  initial,
}: {
  sectionId: string;
  initial: "EVERYONE" | "COUPLE_ONLY";
}) {
  const [visibility, setVisibility] = useState(initial);
  const [pending, startTransition] = useTransition();
  const isCouple = visibility === "COUPLE_ONLY";

  function toggle() {
    const next = isCouple ? "EVERYONE" : "COUPLE_ONLY";
    const prev = visibility;
    setVisibility(next);
    startTransition(async () => {
      try {
        await setBookSectionVisibility(sectionId, next);
        notify(
          "success",
          next === "COUPLE_ONLY"
            ? "Section hidden from non-couple users"
            : "Section visible to everyone",
        );
      } catch (err) {
        setVisibility(prev);
        notify("error", err instanceof Error ? err.message : "Couldn't change visibility");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={pending}
      title={
        isCouple
          ? "Currently couple-only — click to make visible to everyone"
          : "Currently visible to everyone — click to make couple-only"
      }
    >
      <span className="inline-flex items-center gap-1.5">
        {isCouple ? <Lock aria-hidden className="w-4 h-4" /> : <Users aria-hidden className="w-4 h-4" />}
        {isCouple ? "Couple-only" : "Public"}
      </span>
    </Button>
  );
}
