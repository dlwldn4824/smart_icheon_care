"""EventManager unit tests."""

from models.base import TrackedObject
from event.event_manager import EventManager


def test_event_created_after_min_hits_and_finished():
    em = EventManager(camera_id="CCTV-001", min_hits=3, max_age=2, event_cooldown_seconds=300)
    bbox = (10.0, 10.0, 100.0, 60.0)
    created = []
    for i in range(3):
        ups = em.update(
            [TrackedObject(track_id=1, class_name="banner", confidence=0.9, bbox_xyxy=bbox)],
            timestamp=float(i),
            frame_index=i,
        )
        created.extend([u for u in ups if u.change == "created"])
    assert len(created) == 1
    assert created[0].event.status == "NEW"

    finished = []
    for i in range(3, 8):
        ups = em.update([], timestamp=float(i), frame_index=i)
        finished.extend([u for u in ups if u.change == "finished"])
    assert len(finished) == 1
    assert finished[0].event.status == "FINISHED"
    assert finished[0].event.event_id == created[0].event.event_id


def test_no_duplicate_create_same_track():
    em = EventManager(camera_id="CCTV-001", min_hits=2, max_age=5)
    bbox = (5.0, 5.0, 50.0, 40.0)
    creates = 0
    for i in range(6):
        ups = em.update(
            [TrackedObject(1, "banner", 0.8, bbox)],
            timestamp=float(i),
            frame_index=i,
        )
        creates += sum(1 for u in ups if u.change == "created")
    assert creates == 1
