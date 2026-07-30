# 14. ERD (PostgreSQL + PostGIS)

```text
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  cameras    │1─────∞│ detections       │∞─────1│ tracks          │
└─────────────┘       └──────────────────┘       └────────┬────────┘
                                                          │1
                                                          │
                                                          ▼∞
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│ permits     │       │ geo_features     │       │ candidates      │
│ (신고대장)   │◀─join─┤ (보호구역 등)     │◀─join─┤ (의사결정 단위)  │
└─────────────┘       └──────────────────┘       └────────┬────────┘
                                                          │1
                                                          ▼∞
                                                 ┌─────────────────┐
                                                 │ actions         │
                                                 │ (조치·배정)      │
                                                 └─────────────────┘
```

## 테이블

### cameras
| column | type | note |
|--------|------|------|
| id | text PK | CAM-설봉-001 |
| name | text | |
| geom | geography(Point,4326) | |
| h_matrix | jsonb | 선택: 픽셀→지면 호모그래피 |
| is_active | bool | |

### tracks
| column | type |
|--------|------|
| id | uuid PK |
| camera_id | text FK |
| task_id | text |
| track_key | text | ByteTrack local id |
| started_at / ended_at | timestamptz |
| class_name | text |

### detections
| column | type |
|--------|------|
| id | bigserial PK |
| track_id | uuid FK |
| frame_ts | timestamptz |
| conf | real |
| bbox | jsonb | {x,y,w,h} 상대/절대 |
| geom | geography(Point,4326) |
| thumb_uri | text |

### candidates
| column | type |
|--------|------|
| id | uuid PK |
| track_id | uuid FK UNIQUE |
| task_id | text |
| risk_score | int |
| priority_score | int |
| review_tier | text |
| status | text |
| reasons | jsonb |
| risk_breakdown | jsonb |
| priority_breakdown | jsonb |
| geom | geography(Point,4326) |
| assignee | text |
| updated_at | timestamptz |

### permits
| column | type |
|--------|------|
| id | text PK |
| geom | geography(Point,4326) |
| start_date / end_date | date |
| board_id | text |

### geo_features
| column | type |
|--------|------|
| id | text PK |
| feature_type | text | school_zone, elderly_zone, ... |
| geom | geography(Polygon,4326) |
| weight | real |

### actions
| column | type |
|--------|------|
| id | uuid PK |
| candidate_id | uuid FK |
| action_type | text |
| department | text |
| due_at | timestamptz |
| status | text |

DDL: `backend/app/db/schema.sql`
