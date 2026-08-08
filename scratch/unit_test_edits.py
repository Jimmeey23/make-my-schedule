import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from serve import (
    _same_schedule_slot,
    _remove_class_from_schedule,
    _add_class_to_schedule,
    _replace_trainer_in_schedule,
    _change_class_in_schedule,
    _move_class_in_schedule,
    _nl_edit_apply,
    WEB_DIR
)

def run_unit_tests():
    print("1. Testing slot matching...")
    row = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "09:00",
        "class_name": "Studio Barre 57",
        "trainer_1": "Karanvir Bhatia",
        "date": "2026-05-04",
        "room": "Room 1"
    }
    
    # Partial slot matching
    assert _same_schedule_slot(row, {"location": "Kwality House, Kemps Corner", "day_of_week": "Monday", "time": "09:00"}) == True
    assert _same_schedule_slot(row, {"location": "Kwality House, Kemps Corner", "day_of_week": "Monday", "time": "09:00", "trainer_1": "karanvir bhatia"}) == True
    assert _same_schedule_slot(row, {"location": "Kwality House, Kemps Corner", "day_of_week": "Monday", "time": "10:00"}) == False
    print("✅ _same_schedule_slot passed!")

    print("\n2. Testing _add_class_to_schedule...")
    add_edit = {
        "action": "add",
        "location": "Kwality House, Kemps Corner",
        "new_day": "Saturday",
        "new_time": "17:30",
        "new_class": "Studio Barre 57"
        # trainer_1 unstated -> auto best-fit
    }
    res_add = _nl_edit_apply({"edits": [add_edit], "iteration": "Main"})
    print("   Result:", res_add)
    assert res_add.get("applied") == 1, "Add class failed"
    print("✅ _add_class_to_schedule passed!")

    print("\n3. Testing _replace_trainer_in_schedule...")
    swap_edit = {
        "action": "swap_trainer",
        "location": "Kwality House, Kemps Corner",
        "day": "Saturday",
        "time": "17:30",
        "new_trainer": "Rohan Dahima"
    }
    res_swap = _nl_edit_apply({"edits": [swap_edit], "iteration": "Main"})
    print("   Result:", res_swap)
    assert res_swap.get("applied") == 1, "Replace trainer failed"
    print("✅ _replace_trainer_in_schedule passed!")

    print("\n4. Testing _change_class_in_schedule...")
    change_edit = {
        "action": "change_class",
        "location": "Kwality House, Kemps Corner",
        "day": "Saturday",
        "time": "17:30",
        "new_class": "Studio Mat 57"
    }
    res_change = _nl_edit_apply({"edits": [change_edit], "iteration": "Main"})
    print("   Result:", res_change)
    assert res_change.get("applied") == 1, "Change class failed"
    print("✅ _change_class_in_schedule passed!")

    print("\n5. Testing _move_class_in_schedule...")
    move_edit = {
        "action": "move",
        "location": "Kwality House, Kemps Corner",
        "day": "Saturday",
        "time": "17:30",
        "new_day": "Sunday",
        "new_time": "18:00"
    }
    res_move = _nl_edit_apply({"edits": [move_edit], "iteration": "Main"})
    print("   Result:", res_move)
    assert res_move.get("applied") == 1, "Move class failed"
    print("✅ _move_class_in_schedule passed!")

    print("\n6. Testing _remove_class_from_schedule...")
    rem_edit = {
        "action": "remove",
        "location": "Kwality House, Kemps Corner",
        "day": "Sunday",
        "time": "18:00"
    }
    res_rem = _nl_edit_apply({"edits": [rem_edit], "iteration": "Main"})
    print("   Result:", res_rem)
    assert res_rem.get("applied") == 1, "Remove class failed"
    print("✅ _remove_class_from_schedule passed!")

    print("\n🎉 ALL UNIT TESTS PASSED!")

if __name__ == "__main__":
    run_unit_tests()
