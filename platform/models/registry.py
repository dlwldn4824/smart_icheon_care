"""Multi-task registry — add dumping/road_damage without rewriting the pipeline."""

from __future__ import annotations

from models.detector import BannerTask


TASK_FACTORIES = {
    "banner": BannerTask,
}


def build_task(task_id: str, **kwargs):
    if task_id not in TASK_FACTORIES:
        raise KeyError(
            f"Unknown task '{task_id}'. Registered: {list(TASK_FACTORIES)}. "
            "Add a factory here when enabling Task 2+."
        )
    return TASK_FACTORIES[task_id](**kwargs)
