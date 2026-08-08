import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from serve import (
    _nl_edit_plan,
    _nl_edit_apply,
    _same_schedule_slot,
    _remove_class_from_schedule,
    _add_class_to_schedule,
    _replace_trainer_in_schedule,
    _change_class_in_schedule,
    _move_class_in_schedule,
    WEB_DIR
)

def test_slot_matching():
    row = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "09:00",
        "class_name": "Studio Barre 57",
        "trainer_1": "Karanvir Bhatia",
        "date": "2026-05-04",
        "room": "Room 1"
    }
    slot1 = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "09:00"
    }
    assert _same_schedule_slot(row, slot1) == True, "Slot matching failed for partial slot"
    
    slot2 = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "09:00",
        "trainer_1": "karanvir bhatia"
    }
    assert _same_schedule_slot(row, slot2) == True, "Slot matching failed for case-insensitive trainer"

    slot3 = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "10:00"
    }
    assert _same_schedule_slot(row, slot3) == False, "Slot matching should fail for wrong time"
    print("✅ test_slot_matching passed")

def test_edit_actions():
    ctx = {"location": "Kwality House, Kemps Corner"}
    
    # 1. Add class
    plan_add = _nl_edit_plan({"instruction": "add a class on Saturday at 5:30pm at Kwality House", "context": ctx})
    print("\n[PLAN ADD]:", json.dumps(plan_add, indent=2))
    assert plan_add.get("edits"), "Failed to generate edits for add instruction"
    res_add = _nl_edit_apply({"edits": plan_add["edits"], "iteration": "Main"})
    print("[APPLY ADD]:", res_add)
    assert res_add.get("applied", 0) > 0, "Failed to apply add edit"

    # 2. Swap trainer
    plan_swap = _nl_edit_plan({"instruction": "change trainer on Saturday 17:30 at Kwality House to Rohan Dahima", "context": ctx})
    print("\n[PLAN SWAP]:", json.dumps(plan_swap, indent=2))
    assert plan_swap.get("edits"), "Failed to generate edits for swap instruction"
    res_swap = _nl_edit_apply({"edits": plan_swap["edits"], "iteration": "Main"})
    print("[APPLY SWAP]:", res_swap)
    assert res_swap.get("applied", 0) > 0, "Failed to apply swap edit"

    # 3. Change class
    plan_cls = _nl_edit_plan({"instruction": "change Saturday 17:30 class to Studio Mat 57 at Kwality House", "context": ctx})
    print("\n[PLAN CHANGE CLASS]:", json.dumps(plan_cls, indent=2))
    assert plan_cls.get("edits"), "Failed to generate edits for change class instruction"
    res_cls = _nl_edit_apply({"edits": plan_cls["edits"], "iteration": "Main"})
    print("[APPLY CHANGE CLASS]:", res_cls)
    assert res_cls.get("applied", 0) > 0, "Failed to apply change class edit"

    # 4. Remove class
    plan_rem = _nl_edit_plan({"instruction": "remove Saturday 17:30 class at Kwality House", "context": ctx})
    print("\n[PLAN REMOVE]:", json.dumps(plan_rem, indent=2))
    assert plan_rem.get("edits"), "Failed to generate edits for remove instruction"
    res_rem = _nl_edit_apply({"edits": plan_rem["edits"], "iteration": "Main"})
    print("[APPLY REMOVE]:", res_rem)
    assert res_rem.get("applied", 0) > 0, "Failed to apply remove edit"

    print("\n✅ ALL EDIT ACTIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_slot_matching()
    test_edit_actions()
