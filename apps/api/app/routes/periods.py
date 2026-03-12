from fastapi import APIRouter

router = APIRouter()

@router.get("/periods")
def get_periods():
    return [
        {"period_key": "late-preclassic", "display_name": "Late Preclassic"},
        {"period_key": "early-classic", "display_name": "Early Classic"},
        {"period_key": "late-classic", "display_name": "Late Classic"},
        {"period_key": "terminal-classic", "display_name": "Terminal Classic"},
        {"period_key": "postclassic", "display_name": "Postclassic"}
    ]
