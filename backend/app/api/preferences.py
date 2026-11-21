from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.preferences import PreferencesOut, PreferencesUpdate
from app.services import preferences as service

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
def get_preferences(session: SessionDep) -> PreferencesOut:
    return service.get_preferences(session)


@router.patch("")
def update_preferences(data: PreferencesUpdate, session: SessionDep) -> PreferencesOut:
    return service.update_preferences(session, data)
