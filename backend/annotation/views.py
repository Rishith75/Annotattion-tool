import json
import os
import tempfile
import shutil 
import zipfile
import random
import subprocess

from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, FileResponse  

from django.conf import settings
from django.contrib.auth import authenticate
from pydub import AudioSegment

from .models import (
    User, Project, AudioFile, Task, Annotation, AnnotationAttributeValue,
    Label, Attribute, AttributeValue, SuperProject
)
from .serializers import (
    UserSerializer, ProjectSerializer, TaskSerializer,
    AnnotationSerializer, SuperProjectSerializer
)


# Path to auto_annotation directory
BASE_ANNOTATION_DIR = os.path.join(os.path.dirname(__file__), 'auto_annotation')

def run_beats_model(audio_path):
    script_path = os.path.join(BASE_ANNOTATION_DIR, 'beats', 'annotate.py')
    result = subprocess.run(['python', script_path, audio_path], capture_output=True, text=True)
    if result.returncode != 0:
        print("BEATs annotation error:", result.stderr)
        return []
    return json.loads(result.stdout.strip())

def run_yamnet_model(audio_path):
    script_path = os.path.join(BASE_ANNOTATION_DIR, 'yamnet', 'annotate.py')
    result = subprocess.run(['python', script_path, audio_path], capture_output=True, text=True)
    if result.returncode != 0:
        print("YAMNet annotation error:", result.stderr)
        return []
    return json.loads(result.stdout.strip())


# ---------------------- AUTHENTICATION ----------------------

@api_view(['GET'])
def get_users(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def create_user(request):
    data = request.data.copy()
    password = data.pop('password', None)
    serializer = UserSerializer(data=data)
    if serializer.is_valid():
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(username=username, password=password)
    if user is not None:
        serializer = UserSerializer(user)
        return Response(serializer.data)
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['PUT'])
def update_user(request, pk):
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = UserSerializer(user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------- PROJECT VIEWS ----------------------

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_project(request):
    data = dict(request.data)

    # Parse labels JSON safely
    try:
        data['labels'] = json.loads(request.data.get('labels', '[]'))
    except json.JSONDecodeError as e:
        return Response({'error': 'Invalid labels JSON', 'details': str(e)}, status=400)

    # Flatten single-valued fields
    for key in [
        'name', 'data_type', 'display_waveform', 'display_spectrogram',
        'optimize', 'degree', 'user', 'super_project', 'model_type'
    ]:
        if isinstance(data.get(key), list):
            data[key] = data[key][0]

    serializer = ProjectSerializer(data=data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    project = serializer.save()
    optimize = data.get('optimize') in ['true', 'True', True]
    degree = int(data.get('degree', 1))
    model_type = data.get('model_type')

    def auto_annotate(task, file_path):
        if model_type == 'beats':
            predictions = run_beats_model(file_path)
        elif model_type == 'yamnet':
            predictions = run_yamnet_model(file_path)
        else:
            return  # Skip for "others"

        for pred in predictions:
            # Check if the model label is 'silence'
            if pred['label'].lower() == 'silence':
                continue  # Skip creating annotation for 'silence'

            # Create annotation for valid labels
            Annotation.objects.create(
                task=task,
                model_label=pred['label'],
                start_time=pred['start_time'],
                end_time=pred['end_time']
            )

    if optimize:
        for f in request.FILES.getlist('audio_files'):
            temp_path = os.path.join(tempfile.gettempdir(), f.name)
            with open(temp_path, 'wb+') as dest:
                for chunk in f.chunks():
                    dest.write(chunk)

            audio = AudioSegment.from_file(temp_path)
            chunk_length = 30000  # 30 seconds

            for i, start in enumerate(range(0, len(audio), chunk_length)):
                chunk = audio[start:start + chunk_length]
                chunk_name = f"{os.path.splitext(f.name)[0]}_{i}.wav"
                chunk_path = os.path.join(settings.MEDIA_ROOT, 'audio', chunk_name)
                os.makedirs(os.path.dirname(chunk_path), exist_ok=True)
                chunk.export(chunk_path, format="wav")

                rel_path = os.path.relpath(chunk_path, settings.MEDIA_ROOT)
                af = AudioFile.objects.create(project=project, file=rel_path, optimized=True)
                task = Task.objects.create(project=project, audio_file=af)

                auto_annotate(task, os.path.join(settings.MEDIA_ROOT, rel_path))

            os.remove(temp_path)

    else:
        for f in request.FILES.getlist('audio_files'):
            af = AudioFile.objects.create(project=project, file=f)
            task = Task.objects.create(project=project, audio_file=af)

            full_path = os.path.join(settings.MEDIA_ROOT, af.file.name)
            auto_annotate(task, full_path)

    result = ProjectSerializer(project, context={'request': request})
    return Response(result.data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def get_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProjectSerializer(project, context={'request': request})
    return Response(serializer.data)


@api_view(['PUT'])
def update_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    old_model_type = project.model_type
    data = request.data.copy()

    # Parse labels JSON if it's a string
    if isinstance(data.get('labels'), str):
        try:
            data['labels'] = json.loads(data['labels'])
        except json.JSONDecodeError:
            return Response({'error': 'Invalid labels JSON'}, status=400)

    serializer = ProjectSerializer(
        project,
        data=data,
        partial=True,
        context={'request': request}
    )

    if serializer.is_valid():
        updated_project = serializer.save()

        if 'assigned_annotators' in data:
            updated_project.assigned_annotators.set(data['assigned_annotators'])

        new_model_type = updated_project.model_type

        # 🔄 Only if model_type changed
        if new_model_type != old_model_type:
            def auto_annotate(task, file_path):
                if new_model_type == 'beats':
                    predictions = run_beats_model(file_path)
                elif new_model_type == 'yamnet':
                    predictions = run_yamnet_model(file_path)
                else:
                    return  # Skip if "others"

                for pred in predictions:
                    # Skip creating annotation for 'silence' label
                    if pred['label'].lower() == 'silence':
                        continue  # Skip creating annotation for 'silence'

                    # Create annotation for valid labels
                    Annotation.objects.create(
                        task=task,
                        start_time=pred['start_time'],
                        end_time=pred['end_time'],
                        model_label=pred['label'],  # model_label used here
                    )

            for task in updated_project.tasks.all():
                # 🧹 Delete existing model-based annotations
                task.annotations.filter(model_label__isnull=False).delete()
                # 🧠 Auto-annotate if model_type is valid
                if new_model_type in ['beats', 'yamnet']:
                    full_audio_path = os.path.join(settings.MEDIA_ROOT, task.audio_file.file.name)
                    auto_annotate(task, full_audio_path)

        return Response(ProjectSerializer(updated_project, context={'request': request}).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def list_projects(request):
    manager_id = request.GET.get('manager_id')
    user_id = request.GET.get('user_id')  # For annotators

    if manager_id:
        projects = Project.objects.filter(super_project__manager_id=manager_id)
    elif user_id:
        projects = Project.objects.filter(assigned_annotators__id=user_id)
    else:
        projects = Project.objects.all()

    serializer = ProjectSerializer(projects, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
def delete_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    project.delete()
    return Response({'message': 'Project deleted successfully'}, status=status.HTTP_200_OK)


# ---------------------- SUPER PROJECT VIEWS ----------------------

@api_view(['POST'])
def create_super_project(request):
    serializer = SuperProjectSerializer(data=request.data)
    if serializer.is_valid():
        super_project = serializer.save()
        return Response(SuperProjectSerializer(super_project).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_super_project(request, pk):
    try:
        sp = SuperProject.objects.get(pk=pk)
    except SuperProject.DoesNotExist:
        return Response({'error': 'SuperProject not found'}, status=status.HTTP_404_NOT_FOUND)
    serializer = SuperProjectSerializer(sp)
    return Response(serializer.data)


@api_view(['PUT'])
def update_super_project(request, pk):
    try:
        sp = SuperProject.objects.get(pk=pk)
    except SuperProject.DoesNotExist:
        return Response({'error': 'SuperProject not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = SuperProjectSerializer(sp, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def list_super_projects(request):
    manager_id = request.GET.get('manager_id')
    if manager_id:
        sps = SuperProject.objects.filter(manager_id=manager_id)
    else:
        sps = SuperProject.objects.all()
    serializer = SuperProjectSerializer(sps, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
def delete_super_project(request, pk):
    try:
        sp = SuperProject.objects.get(pk=pk)
    except SuperProject.DoesNotExist:
        return Response({'error': 'SuperProject not found'}, status=status.HTTP_404_NOT_FOUND)
    sp.delete()
    return Response({'message': 'SuperProject deleted successfully'}, status=status.HTTP_200_OK)


# ---------------------- TASK VIEWS ----------------------

@api_view(['GET'])
def get_tasks(request):
    manager_id = request.GET.get('manager_id')
    user_id = request.GET.get('user_id')
    status_filter = request.GET.get('status')

    if manager_id:
        tasks = Task.objects.filter(project__super_project__manager_id=manager_id)
    elif user_id:
        tasks = Task.objects.filter(project__assigned_annotators__id=user_id)
    else:
        tasks = Task.objects.all()

    if status_filter:
        tasks = tasks.filter(status=status_filter)

    serializer = TaskSerializer(tasks, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def get_tasks_for_project(request, project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    tasks = project.tasks.all()
    serializer = TaskSerializer(tasks, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def get_task(request, task_id):
    """Get full task detail (audio, project, labels)."""
    try:
        task = Task.objects.get(pk=task_id)
        serializer = TaskSerializer(task, context={'request': request})
        return Response(serializer.data)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)



@api_view(['POST'])
def save_annotations(request, task_id):
    """Save user annotations for a given task."""
    try:
        task = Task.objects.get(pk=task_id)
        data = request.data

        # Keep model-generated annotations intact
        # Clear only user-created annotations (annotations where model_label is null)
        task.annotations.filter(model_label__isnull=True).delete()

        annotations = data.get('annotations', [])
        
        # Save or update user annotations
        for ann in annotations:
            label = None
            if ann.get('label_id'):
                label = Label.objects.filter(pk=ann['label_id']).first()

            # If annotation already exists (user editing it), update it, else create a new one
            annotation = None
            if ann.get('annotation_id'):  # Check if this is an update
                annotation = Annotation.objects.filter(pk=ann['annotation_id'], model_label__isnull=True).first()
                if annotation:
                    # Update existing annotation
                    annotation.label = label
                    annotation.start_time = ann['start_time']
                    annotation.end_time = ann['end_time']
                    annotation.save()
                else:
                    # If no matching annotation found, create a new one
                    annotation = Annotation.objects.create(
                        task=task,
                        label=label,
                        model_label=None,  # explicitly null for user-created
                        start_time=ann['start_time'],
                        end_time=ann['end_time']
                    )
            else:
                # Create new annotation if no annotation_id provided
                annotation = Annotation.objects.create(
                    task=task,
                    label=label,
                    model_label=None,  # explicitly null for user-created
                    start_time=ann['start_time'],
                    end_time=ann['end_time']
                )

            # Add attributes to the annotation
            for attr in ann.get('attributes', []):
                attr_obj = Attribute.objects.filter(pk=attr['attribute_id']).first()
                val_obj = AttributeValue.objects.filter(pk=attr['value_id']).first()
                if attr_obj and val_obj:
                    AnnotationAttributeValue.objects.create(
                        annotation=annotation,
                        attribute=attr_obj,
                        value=val_obj
                    )

        # Optional: Update task status if provided in the request
        task.status = data.get('status', 'In Progress')
        task.save()

        return Response({'message': 'Annotations saved successfully'}, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_annotations(request, task_id):
    """Fetch all annotations (manual + model) for a given task."""
    try:
        task = Task.objects.get(pk=task_id)
        annotations = Annotation.objects.filter(task=task)

        results = []
        for annotation in annotations:
            attributes = [
                {
                    'attribute_id': av.attribute.id,
                    'attribute_name': av.attribute.name,
                    'value_id': av.value.id,
                    'value_value': av.value.value
                }
                for av in annotation.attribute_values.all()
            ]
            results.append({
                'id': annotation.id,
                'start_time': annotation.start_time,
                'end_time': annotation.end_time,
                'label_id': annotation.label.id if annotation.label else None,
                'label_name': annotation.label.name if annotation.label else None,
                'model_label': annotation.model_label,  # included even if null
                'attributes': attributes
            })

        return Response({'annotations': results}, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
def delete_annotation(request, annotation_id):
    """Delete a single annotation."""
    try:
        ann = Annotation.objects.get(pk=annotation_id)
        ann.delete()
        return Response({'message': 'Annotation deleted'}, status=status.HTTP_200_OK)
    except Annotation.DoesNotExist:
        return Response({'error': 'Annotation not found'}, status=status.HTTP_404_NOT_FOUND)

@csrf_exempt
def export_annotations(request, task_id):
    """Export annotations + audio clips + JSON as a ZIP file."""
    try:
        task = Task.objects.select_related('audio_file').get(pk=task_id)
        annotations = Annotation.objects.filter(task=task)
        audio_path = task.audio_file.file.path
        audio = AudioSegment.from_file(audio_path)

        with tempfile.TemporaryDirectory() as export_dir:
            clips_dir = os.path.join(export_dir, 'clips')
            os.makedirs(clips_dir, exist_ok=True)

            json_data = []

            for i, ann in enumerate(annotations, 1):
                start_ms = int(ann.start_time * 1000)
                end_ms = int(ann.end_time * 1000)
                clip = audio[start_ms:end_ms]

                clip_filename = f"clip_{i}.wav"
                clip_path = os.path.join(clips_dir, clip_filename)
                clip.export(clip_path, format="wav")

                attributes = AnnotationAttributeValue.objects.filter(annotation=ann)
                attr_data = [{
                    "attribute_name": attr.attribute.name,
                    "value": attr.value.value
                } for attr in attributes]

                json_data.append({
                    "start_time": ann.start_time,
                    "end_time": ann.end_time,
                    "label": ann.label.name if ann.label else None,
                    "model_label": ann.model_label,  # 👈 added
                    "attributes": attr_data,
                    "clip_filename": f"clips/{clip_filename}"
                })

            json_path = os.path.join(export_dir, "annotations.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_data, f, indent=2)

            zip_path = os.path.join(tempfile.gettempdir(), f"task_{task_id}_export.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                zipf.write(json_path, arcname="annotations.json")
                for clip_file in os.listdir(clips_dir):
                    zipf.write(os.path.join(clips_dir, clip_file), arcname=os.path.join("clips", clip_file))

            return FileResponse(open(zip_path, 'rb'), as_attachment=True, filename=f"task_{task_id}_export.zip")

    except Task.DoesNotExist:
        return JsonResponse({"error": "Task not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def export_project_annotations(request, project_id):
    """Export all annotations + clips + original audio per task as a ZIP."""
    try:
        project = Project.objects.get(pk=project_id)
        tasks = Task.objects.filter(project=project).select_related('audio_file')
        all_data = {
            "project_name": project.name,
            "assigned_to": [u.username for u in project.assigned_annotators.all()],
            "tasks": []
        }

        with tempfile.TemporaryDirectory() as export_dir:
            for task in tasks:
                audio_path = task.audio_file.file.path
                audio_filename = os.path.basename(audio_path)
                audio = AudioSegment.from_file(audio_path)

                task_dir = os.path.join(export_dir, f"task_{task.id}")
                os.makedirs(task_dir, exist_ok=True)

                # Copy the original audio file
                original_audio_dest = os.path.join(task_dir, audio_filename)
                shutil.copy(audio_path, original_audio_dest)

                task_data = {
                    "task_id": task.id,
                    "audio_file": f"task_{task.id}/{audio_filename}",
                    "annotations": []
                }

                annotations = Annotation.objects.filter(task=task)
                for i, ann in enumerate(annotations, 1):
                    start_ms = int(ann.start_time * 1000)
                    end_ms = int(ann.end_time * 1000)
                    clip = audio[start_ms:end_ms]

                    clip_filename = f"clip_{i}.wav"
                    clip_path = os.path.join(task_dir, clip_filename)
                    clip.export(clip_path, format="wav")

                    attributes = AnnotationAttributeValue.objects.filter(annotation=ann)
                    attr_data = [{
                        "attribute_name": attr.attribute.name,
                        "value": attr.value.value
                    } for attr in attributes]

                    task_data["annotations"].append({
                        "start_time": ann.start_time,
                        "end_time": ann.end_time,
                        "label": ann.label.name if ann.label else None,
                        "model_label": ann.model_label,  # 👈 added
                        "attributes": attr_data,
                        "clip_filename": f"task_{task.id}/{clip_filename}"
                    })

                all_data["tasks"].append(task_data)

            # Save annotations.json
            json_path = os.path.join(export_dir, "annotations.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(all_data, f, indent=2)

            # Create ZIP archive
            zip_path = os.path.join(tempfile.gettempdir(), f"project_{project_id}_export.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                zipf.write(json_path, arcname="annotations.json")
                for task in tasks:
                    task_dir = os.path.join(export_dir, f"task_{task.id}")
                    for file in os.listdir(task_dir):
                        file_path = os.path.join(task_dir, file)
                        arcname = f"task_{task.id}/{file}"
                        zipf.write(file_path, arcname=arcname)

            return FileResponse(open(zip_path, 'rb'), as_attachment=True, filename=f"project_{project_id}_export.zip")

    except Project.DoesNotExist:
        return JsonResponse({"error": "Project not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def export_superproject_annotations(request, superproject_id):
    """Export all annotations + audio + clips for a SuperProject as a ZIP."""
    try:
        super_project = SuperProject.objects.get(pk=superproject_id)
        all_data = {
            "super_project_name": super_project.name,
            "projects": []
        }

        with tempfile.TemporaryDirectory() as export_dir:
            for project in super_project.projects.all():
                project_data = {
                    "project_id": project.id,
                    "project_name": project.name,
                    "assigned_to": [u.username for u in project.assigned_annotators.all()],
                    "tasks": []
                }

                tasks = Task.objects.filter(project=project).select_related('audio_file')
                for task in tasks:
                    audio_path = task.audio_file.file.path
                    audio_filename = os.path.basename(audio_path)
                    audio = AudioSegment.from_file(audio_path)

                    task_dir = os.path.join(export_dir, f"project_{project.id}/task_{task.id}")
                    os.makedirs(task_dir, exist_ok=True)

                    # Copy original audio
                    original_audio_dest = os.path.join(task_dir, audio_filename)
                    shutil.copy(audio_path, original_audio_dest)

                    task_data = {
                        "task_id": task.id,
                        "audio_file": f"project_{project.id}/task_{task.id}/{audio_filename}",
                        "annotations": []
                    }

                    annotations = Annotation.objects.filter(task=task)
                    for i, ann in enumerate(annotations, 1):
                        start_ms = int(ann.start_time * 1000)
                        end_ms = int(ann.end_time * 1000)
                        clip = audio[start_ms:end_ms]

                        clip_filename = f"clip_{i}.wav"
                        clip_path = os.path.join(task_dir, clip_filename)
                        clip.export(clip_path, format="wav")

                        attributes = AnnotationAttributeValue.objects.filter(annotation=ann)
                        attr_data = [{
                            "attribute_name": attr.attribute.name,
                            "value": attr.value.value
                        } for attr in attributes]

                        task_data["annotations"].append({
                            "start_time": ann.start_time,
                            "end_time": ann.end_time,
                            "label": ann.label.name if ann.label else None,
                            "model_label": ann.model_label,  # 👈 added
                            "attributes": attr_data,
                            "clip_filename": f"project_{project.id}/task_{task.id}/{clip_filename}"
                        })

                    project_data["tasks"].append(task_data)

                all_data["projects"].append(project_data)

            # Save annotations.json
            json_path = os.path.join(export_dir, "annotations.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(all_data, f, indent=2)

            # Create ZIP
            zip_path = os.path.join(tempfile.gettempdir(), f"superproject_{superproject_id}_export.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                zipf.write(json_path, arcname="annotations.json")
                for root, _, files in os.walk(export_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, start=export_dir)
                        zipf.write(file_path, arcname=arcname)

            return FileResponse(open(zip_path, 'rb'), as_attachment=True, filename=f"superproject_{superproject_id}_export.zip")

    except SuperProject.DoesNotExist:
        return JsonResponse({"error": "SuperProject not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
