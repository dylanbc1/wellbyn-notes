"""
Transcription endpoints
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import time
import json
import asyncio

from database import get_db
from config import settings
from services.huggingface_service import HuggingFaceService
from services.transcription_service import TranscriptionService
from services.ai_medical_service import AIMedicalService
from schemas.transcription import (
    TranscriptionCreate, 
    TranscriptionResponse, 
    TranscriptionResponseDoctor,
    TranscriptionListResponse, 
    WorkflowStepResponse
)
from routers.auth import get_current_user
from models.user import User, UserRole
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union

router = APIRouter(prefix="/api/transcriptions", tags=["Transcriptions"])

import logging
logger = logging.getLogger(__name__)


def filter_transcription_for_role(transcription, user: User):
    """Filtra la transcripción según el rol del usuario"""
    from models.transcription import Transcription
    
    if user.role == UserRole.DOCTOR:
        # Para doctores, crear una copia sin códigos ni formularios
        return TranscriptionResponseDoctor(
            id=transcription.id,
            filename=transcription.filename,
            file_size_mb=transcription.file_size_mb,
            content_type=transcription.content_type,
            text=transcription.text,
            processing_time_seconds=transcription.processing_time_seconds,
            model=transcription.model,
            provider=transcription.provider,
            medical_note=transcription.medical_note,
            workflow_status=transcription.workflow_status,
            created_at=transcription.created_at,
            updated_at=transcription.updated_at
        )
    else:
        # Para administradores, devolver todo
        return TranscriptionResponse.from_orm(transcription)


@router.post("/transcribe-chunk", response_model=Dict[str, Any])
async def transcribe_audio_chunk(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe un chunk de audio para transcripción en tiempo real
    Retorna solo el texto transcrito del chunk
    """
    logger.info(f"Received chunk: {audio.filename}")
    
    # Leer chunk
    audio_bytes = await audio.read()
    
    if len(audio_bytes) == 0:
        return {"text": "", "status": "empty"}
    
    # Transcribe con Hugging Face
    hf_service = HuggingFaceService()
    
    content_type = audio.content_type or "audio/webm"
    result = hf_service.transcribe_audio(audio_bytes, content_type)
    
    if result["status"] == "error":
        return {"text": "", "status": "error", "message": result.get("message", "Error transcribing")}
    
    if result["status"] == "loading":
        return {"text": "", "status": "loading"}
    
    return {
        "text": result["text"],
        "status": "success"
    }


@router.post("/transcribe", response_model=Union[TranscriptionResponse, TranscriptionResponseDoctor])
async def transcribe_audio(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio file to text
    
    - **audio**: Audio file (MP3, WAV, M4A, etc.)
    
    Returns:
        Transcription with metadata
    """
    
    logger.info(f"Received file: {audio.filename}")
    logger.info(f"Content-Type: {audio.content_type}")
    
    # Validar formato y detectar por extensión si es necesario
    content_type = audio.content_type
    
    # Si es octet-stream, detectar por extensión
    if content_type == "application/octet-stream":
        ext_to_mime = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/m4a",
            ".ogg": "audio/ogg",
            ".flac": "audio/flac",
            ".webm": "audio/webm"
        }
        
        filename_lower = audio.filename.lower() if audio.filename else ""
        for ext, mime in ext_to_mime.items():
            if filename_lower.endswith(ext):
                content_type = mime
                logger.info(f"Content-Type detected: {content_type}")
                break
    
    # Extract base content type (before semicolon for formats like "audio/webm;codecs=opus")
    base_content_type = content_type.split(';')[0].strip() if content_type else ""
    
    if base_content_type not in settings.ALLOWED_AUDIO_FORMATS and base_content_type != "application/octet-stream":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {content_type}"
        )
    
    # Leer archivo
    audio_bytes = await audio.read()
    file_size = len(audio_bytes)
    file_size_mb = file_size / (1024 * 1024)
    
    # Validate file size
    if file_size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {file_size_mb:.2f} MB. Maximum: {settings.MAX_FILE_SIZE_MB} MB"
        )
    
    # Transcribe with Hugging Face
    hf_service = HuggingFaceService()
    
    start_time = time.time()
    result = hf_service.transcribe_audio(audio_bytes, content_type)
    elapsed_time = time.time() - start_time
    
    # Validate result
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    
    if result["status"] == "loading":
        raise HTTPException(status_code=503, detail="Model is loading. Please retry in 30 seconds")
    
    # Save to database
    model_config = settings.AVAILABLE_MODELS[settings.DEFAULT_MODEL]
    transcription_data = TranscriptionCreate(
        filename=audio.filename,
        file_size_mb=round(file_size_mb, 2),
        content_type=content_type,
        text=result["text"],
        processing_time_seconds=round(elapsed_time, 2),
        model=model_config["id"],
        provider="huggingface"
    )
    
    db_transcription = TranscriptionService.create_transcription(db, transcription_data)
    
    # Filtrar según rol
    return filter_transcription_for_role(db_transcription, current_user)


@router.get("/", response_model=TranscriptionListResponse)
def get_transcriptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of transcriptions
    
    - **skip**: Offset for pagination
    - **limit**: Number of results (max 100)
    
    Nota: Los doctores solo verán notas médicas, sin códigos ni formularios
    """
    
    transcriptions = TranscriptionService.get_transcriptions(db, skip=skip, limit=limit)
    total = TranscriptionService.count_transcriptions(db)
    
    # Filtrar según rol
    filtered_items = [filter_transcription_for_role(t, current_user) for t in transcriptions]
    
    return {
        "total": total,
        "items": filtered_items,
        "page": (skip // limit) + 1,
        "page_size": limit
    }


@router.get("/{transcription_id}", response_model=Union[TranscriptionResponse, TranscriptionResponseDoctor])
def get_transcription(
    transcription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get specific transcription by ID
    
    Nota: Los doctores solo verán notas médicas, sin códigos ni formularios
    """
    
    transcription = TranscriptionService.get_transcription(db, transcription_id)
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    # Filtrar según rol
    return filter_transcription_for_role(transcription, current_user)


@router.delete("/{transcription_id}")
def delete_transcription(
    transcription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a transcription
    """
    
    success = TranscriptionService.delete_transcription(db, transcription_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    return {"message": "Transcription deleted successfully"}


# ==================== Medical Workflow Endpoints ====================

class PatientInfo(BaseModel):
    """Optional patient information for CMS-1500 form"""
    name: Optional[str] = None
    dob: Optional[str] = None
    sex: Optional[str] = None
    address: Optional[str] = None
    city_state_zip: Optional[str] = None
    phone: Optional[str] = None
    id: Optional[str] = None
    insured_name: Optional[str] = None
    insured_id: Optional[str] = None
    insurance_group: Optional[str] = None


@router.post("/{transcription_id}/workflow/generate-note", response_model=WorkflowStepResponse)
def generate_medical_note(
    transcription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2: Generate medical note from transcription
    """
    transcription = TranscriptionService.get_transcription(db, transcription_id)
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    ai_service = AIMedicalService()
    medical_note = ai_service.generate_medical_note(transcription.text)
    
    updated = TranscriptionService.update_medical_note(db, transcription_id, medical_note)
    
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update medical note")
    
    # Filtrar según rol
    filtered_transcription = filter_transcription_for_role(updated, current_user)
    
    return {
        "success": True,
        "message": "Medical note generated successfully",
        "transcription": filtered_transcription
    }


@router.post("/{transcription_id}/workflow/suggest-icd10", response_model=WorkflowStepResponse)
def suggest_icd10_codes(
    transcription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 3: Suggest ICD-10 codes based on medical note
    """
    transcription = TranscriptionService.get_transcription(db, transcription_id)
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    if not transcription.medical_note:
        raise HTTPException(status_code=400, detail="Medical note must be generated first")
    
    ai_service = AIMedicalService()
    icd10_codes = ai_service.suggest_icd10_codes(transcription.medical_note, transcription.text)
    
    updated = TranscriptionService.update_icd10_codes(db, transcription_id, icd10_codes)
    
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update ICD-10 codes")
    
    # Filtrar según rol
    filtered_transcription = filter_transcription_for_role(updated, current_user)
    
    return {
        "success": True,
        "message": "ICD-10 codes suggested successfully",
        "transcription": filtered_transcription
    }


@router.post("/{transcription_id}/workflow/suggest-cpt", response_model=WorkflowStepResponse)
def suggest_cpt_codes(
    transcription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 4: Suggest CPT codes with modifiers
    """
    transcription = TranscriptionService.get_transcription(db, transcription_id)
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    if not transcription.medical_note:
        raise HTTPException(status_code=400, detail="Medical note must be generated first")
    
    ai_service = AIMedicalService()
    cpt_codes = ai_service.suggest_cpt_codes(transcription.medical_note, transcription.text)
    
    updated = TranscriptionService.update_cpt_codes(db, transcription_id, cpt_codes)
    
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update CPT codes")
    
    # Filtrar según rol
    filtered_transcription = filter_transcription_for_role(updated, current_user)
    
    return {
        "success": True,
        "message": "CPT codes suggested successfully",
        "transcription": filtered_transcription
    }


@router.post("/{transcription_id}/workflow/generate-cms1500", response_model=WorkflowStepResponse)
def generate_cms1500_form(
    transcription_id: int,
    patient_info: Optional[PatientInfo] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 5: Generate CMS-1500 form data
    """
    transcription = TranscriptionService.get_transcription(db, transcription_id)
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    if not transcription.medical_note:
        raise HTTPException(status_code=400, detail="Medical note must be generated first")
    
    if not transcription.icd10_codes or not transcription.cpt_codes:
        raise HTTPException(status_code=400, detail="ICD-10 and CPT codes must be suggested first")
    
    ai_service = AIMedicalService()
    patient_dict = patient_info.dict() if patient_info else None
    cms1500_form = ai_service.generate_cms1500_form_data(
        transcription.medical_note,
        transcription.icd10_codes,
        transcription.cpt_codes,
        patient_dict
    )
    
    updated = TranscriptionService.update_cms1500_form(db, transcription_id, cms1500_form)
    
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update CMS-1500 form")
    
    # Filtrar según rol
    filtered_transcription = filter_transcription_for_role(updated, current_user)
    
    return {
        "success": True,
        "message": "CMS-1500 form generated successfully",
        "transcription": filtered_transcription
    }


@router.post("/{transcription_id}/workflow/run-full", response_model=WorkflowStepResponse)
def run_full_workflow(
    transcription_id: int,
    patient_info: Optional[PatientInfo] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run complete workflow: Generate note -> Suggest ICD-10 -> Suggest CPT -> Generate CMS-1500
    """
    transcription = TranscriptionService.get_transcription(db, transcription_id)
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    ai_service = AIMedicalService()
    patient_dict = patient_info.dict() if patient_info else None
    
    workflow_result = ai_service.run_full_workflow(transcription.text, patient_dict)
    
    updated = TranscriptionService.update_full_workflow(
        db,
        transcription_id,
        workflow_result["medical_note"],
        workflow_result["icd10_codes"],
        workflow_result["cpt_codes"],
        workflow_result["cms1500_form_data"]
    )
    
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update workflow")
    
    # Filtrar según rol antes de devolver
    filtered_transcription = filter_transcription_for_role(updated, current_user)
    
    return {
        "success": True,
        "message": "Full workflow completed successfully",
        "transcription": filtered_transcription
    }

