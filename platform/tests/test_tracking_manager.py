from models.base import TrackedObject
from tracking.track_manager import TrackManager


def test_min_hits_and_event_emit():
    tm = TrackManager(camera_id="CCTV-001", min_hits=3, max_age=2, event_cooldown_seconds=300)
    bbox = (10.0, 10.0, 100.0, 60.0)
    for i in range(3):
        tm.update(
            [TrackedObject(track_id=1, class_name="banner", confidence=0.9, bbox_xyxy=bbox)],
            timestamp=float(i),
            frame_index=i,
        )
    # lose track
    events = []
    for i in range(3, 8):
        events.extend(tm.update([], timestamp=float(i), frame_index=i))
    assert len(events) == 1
    assert events[0].hit_count >= 3


def test_cooldown_merges_same_location():
    tm = TrackManager(
        camera_id="CCTV-001",
        min_hits=1,
        max_age=1,
        event_iou_threshold=0.5,
        event_cooldown_seconds=300,
    )
    bbox = (10.0, 10.0, 100.0, 60.0)
    tm.update(
        [TrackedObject(1, "banner", 0.9, bbox)],
        timestamp=0.0,
        frame_index=0,
    )
    # miss_count must exceed max_age
    assert tm.update([], timestamp=1.0, frame_index=1) == []
    e1 = tm.update([], timestamp=2.0, frame_index=2)
    assert len(e1) == 1
    tm.update(
        [TrackedObject(2, "banner", 0.95, bbox)],
        timestamp=3.0,
        frame_index=3,
    )
    assert tm.update([], timestamp=4.0, frame_index=4) == []
    e2 = tm.update([], timestamp=5.0, frame_index=5)
    assert e2 == []  # merged into previous within cooldown
