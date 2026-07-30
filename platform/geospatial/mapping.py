"""Pixel / camera → WGS84 mapping."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class CameraPose:
    camera_id: str
    lat: float
    lng: float
    # Optional 3x3 homography from image (x,y,1) to ground plane meters then WGS84 offset
    # For MVP we fall back to camera representative coordinates.
    h_matrix: list[list[float]] | None = None


class GeoMapper:
    """
    MVP: use CCTV site coordinates as detection location.
    Production: calibrate homography or use depth/PTZ metadata per camera.
    """

    def __init__(self, cameras: dict[str, CameraPose]) -> None:
        self.cameras = cameras

    def map_detection(
        self,
        camera_id: str,
        bbox_xyxy: tuple[float, float, float, float],
    ) -> tuple[float, float]:
        cam = self.cameras.get(camera_id)
        if cam is None:
            raise KeyError(f"Unknown camera_id={camera_id}")

        if cam.h_matrix is None:
            # Bottom-center of bbox as approximate ground contact — still snap to camera for MVP
            return cam.lat, cam.lng

        # Homography path (image → ground plane in local ENU meters)
        x1, y1, x2, y2 = bbox_xyxy
        u, v = (x1 + x2) / 2.0, y2
        h = cam.h_matrix
        denom = h[2][0] * u + h[2][1] * v + h[2][2]
        if abs(denom) < 1e-9:
            return cam.lat, cam.lng
        x = (h[0][0] * u + h[0][1] * v + h[0][2]) / denom
        y = (h[1][0] * u + h[1][1] * v + h[1][2]) / denom
        # Approximate meters to degrees near Icheon (~37.27N)
        dlat = y / 111_320.0
        dlng = x / (111_320.0 * 0.79)
        return cam.lat + dlat, cam.lng + dlng
