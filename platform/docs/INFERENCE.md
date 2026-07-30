# 8–9. 추론 Pipeline · ByteTrack

## 8. 추론 Pipeline

```text
Video / RTSP
    ↓
FrameSampler (target_fps=1.0~2.0)
    ↓
YOLO11s detect (conf≥0.25, iou=0.5)
    ↓
NMS (Ultralytics 내장; YOLO26 e2e면 생략)
    ↓
ByteTrack (track_id 부여)
    ↓
TrackAggregator (동일 track 중복 제거·대표 프레임 선정)
    ↓
GeoMapper (pixel → WGS84 또는 CCTV 대표좌표)
    ↓
DetectionRepository.insert()
    ↓
RiskEngine → PriorityEngine
    ↓
API / Dashboard push
```

### Frame Sampling 근거

- 30fps 전량 추론 시 GPU·스토리지 낭비
- 현수막은 정적 객체 → **1fps면 충분**, PTZ 시 2fps
- 샘플링 후 Track으로 시간 연속성 보완

### Detection DB에 저장하는 필드

`track_id, task_id, class_name, conf, bbox, frame_ts, camera_id, lat, lng, thumb_uri`

---

## 9. ByteTrack 적용

### 목표

동일 현수막이 30초간 매 프레임 검출되어도 **민원 후보는 1건**.

### 파라미터 (권장)

| 파라미터 | 값 | 의미 |
|----------|-----|------|
| track_high_thresh | 0.5 | 확정 매칭 |
| track_low_thresh | 0.1 | 저신뢰 rescue (ByteTrack 핵심) |
| new_track_thresh | 0.6 | 신규 Track 생성 |
| match_thresh | 0.8 | IoU/유사도 |
| track_buffer | 30 | 샘플링 1fps 기준 ~30초 유지 |
| frame_rate | sampler_fps | 버퍼 시간 환산 |

### 생명주기

```text
새 객체:  unmatched high-conf detection → new track_id
유지:     IoU 매칭 성공 → 동일 track_id, age++
삭제:     lost > track_buffer → 종료, DB에 closed_at 기록
통합:     camera_id + track_id + spatial hash → 후보 1행
```

### FPS 고려

| 입력 | 샘플러 | Track buffer(프레임) | 실시간 유지 |
|------|--------|----------------------|-------------|
| 30fps | 1fps | 30 | ~30초 |
| 30fps | 2fps | 60 | ~30초 |

### 대표 프레임 선정

Track 종료 또는 주기 flush 시:

```text
representative = argmax(confidence) among track detections
```

썸네일·대시보드 표시에 사용.

구현: `tracking/bytetrack_wrapper.py`, `tracking/track_manager.py`
