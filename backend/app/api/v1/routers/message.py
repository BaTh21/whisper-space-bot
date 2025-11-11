from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.group import GroupMessageUpdate, GroupMessageOut, GroupMessageResponse
from app.models.user import User
from app.crud.message import update_message, delete_message, upload_file_message

router = APIRouter();

@router.put("/{message_id}", response_model=GroupMessageResponse)
def update_message_by_id(message_id: int, 
                         message_data: GroupMessageUpdate,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)
                         ):
    return update_message(db, message_id, message_data, current_user.id)

@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_by_id(message_id: int,
                         db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    return await delete_message(db, message_id, current_user.id)

@router.post("/groups/{group_id}", response_model=GroupMessageResponse)
async def upload_file_message_by_id(group_id: int,
                        file: UploadFile = File(...),
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)
                        ):
    
    print(f"User id: {current_user.id}")
    return await upload_file_message(db, group_id, file, current_user.id)