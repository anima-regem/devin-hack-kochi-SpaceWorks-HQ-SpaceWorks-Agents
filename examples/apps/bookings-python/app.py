"""Synthetic bookings evidence fixture; no live external data."""
from flask import Flask

app = Flask(__name__)
bookings = []


def list_bookings():
    return list(bookings)


def get_availability(room_id, time_slot):
    return not any(b["room_id"] == room_id and b["time_slot"] == time_slot for b in bookings)


def create_booking(room_id, time_slot):
    if not get_availability(room_id, time_slot):
        raise ValueError("Room unavailable")
    booking = {"room_id": room_id, "time_slot": time_slot, "status": "pending"}
    bookings.append(booking)
    return booking
