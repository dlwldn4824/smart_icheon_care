"""Compat shim: `from event_manager import EventManager`."""

from event.event_manager import EventManager, EventUpdate

__all__ = ["EventManager", "EventUpdate"]
