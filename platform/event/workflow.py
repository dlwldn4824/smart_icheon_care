"""Administrative event status state machine."""

from __future__ import annotations

from typing import Any

# Operational statuses for municipal workflow
VALID_STATUS = {
    "DETECTED",
    "REVIEW_PENDING",
    "CONFIRMED",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "DISMISSED",
}

# Allowed directed transitions
TRANSITIONS: dict[str, set[str]] = {
    "DETECTED": {"REVIEW_PENDING", "DISMISSED"},
    "REVIEW_PENDING": {"CONFIRMED", "DISMISSED"},
    "CONFIRMED": {"ASSIGNED"},
    "ASSIGNED": {"IN_PROGRESS"},
    "IN_PROGRESS": {"RESOLVED"},
    "RESOLVED": set(),
    "DISMISSED": set(),
}

# Human actor required
ACTOR_REQUIRED = {"CONFIRMED", "ASSIGNED", "RESOLVED"}

# Map tracking / legacy statuses → operational start status
LEGACY_STATUS_MAP = {
    "NEW": "DETECTED",
    "TRACKING": "DETECTED",
    "FINISHED": "DETECTED",
    "REVIEWING": "REVIEW_PENDING",
}


def normalize_status(status: str | None) -> str:
    if not status:
        return "DETECTED"
    if status in VALID_STATUS:
        return status
    return LEGACY_STATUS_MAP.get(status, status)


def can_transition(from_status: str, to_status: str) -> bool:
    src = normalize_status(from_status)
    dst = normalize_status(to_status)
    if dst not in VALID_STATUS:
        return False
    return dst in TRANSITIONS.get(src, set())


def assert_transition(from_status: str, to_status: str) -> None:
    src = normalize_status(from_status)
    dst = to_status
    if dst not in VALID_STATUS:
        raise ValueError(f"invalid status {dst}; allowed={sorted(VALID_STATUS)}")
    if not can_transition(src, dst):
        allowed = sorted(TRANSITIONS.get(src, set()))
        raise ValueError(f"invalid transition {src} → {dst}; allowed={allowed}")


def apply_workflow_fields(
    event: dict[str, Any],
    new_status: str,
    *,
    actor: str | None = None,
    assignee: str | None = None,
    department: str | None = None,
    action_due_at: str | None = None,
    note: str | None = None,
    review_note: str | None = None,
    action_note: str | None = None,
    dismiss_reason: str | None = None,
    now: str,
) -> dict[str, Any]:
    """Mutate event dict with workflow metadata for a successful transition."""
    if new_status in ACTOR_REQUIRED and not (actor and str(actor).strip()):
        raise ValueError(f"{new_status} requires actor")

    event["status"] = new_status
    event["updated_at"] = now
    if actor:
        event["updated_by"] = actor

    if assignee is not None:
        event["assignee"] = assignee
    if department is not None:
        event["department"] = department
    if action_due_at is not None:
        event["action_due_at"] = action_due_at
    if review_note is not None:
        event["review_note"] = review_note
    if action_note is not None:
        event["action_note"] = action_note
    elif note is not None and new_status in {"ASSIGNED", "IN_PROGRESS", "RESOLVED"}:
        event["action_note"] = note
    if note is not None and new_status in {"REVIEW_PENDING", "CONFIRMED"}:
        event["review_note"] = note if review_note is None else review_note
    if dismiss_reason is not None:
        event["dismiss_reason"] = dismiss_reason
    elif note is not None and new_status == "DISMISSED":
        event["dismiss_reason"] = note

    if new_status == "CONFIRMED":
        event["confirmed_at"] = now
    elif new_status == "ASSIGNED":
        if assignee:
            event["assignee"] = assignee
        if not event.get("assignee"):
            raise ValueError("ASSIGNED requires assignee")
        event["assigned_at"] = now
    elif new_status == "RESOLVED":
        event["resolved_at"] = now

    return event
