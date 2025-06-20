import json
import os
import tempfile
import shutil 
import zipfile
import random

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

    try:
        data['labels'] = json.loads(request.data.get('labels', '[]'))
    except json.JSONDecodeError as e:
        return Response({'error': 'Invalid labels JSON', 'details': str(e)}, status=400)

    # Flatten single-value lists
    for key in ['name', 'data_type', 'display_waveform',
                'display_spectrogram', 'optimize',
                'degree', 'user', 'super_project']:
        if isinstance(data.get(key), list):
            data[key] = data[key][0]

    serializer = ProjectSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        project = serializer.save()

        optimize = data.get('optimize') in ['true', 'True', True]
        degree = int(data.get('degree', 1))

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

                    # Create tasks and distribute to annotators later
                    Task.objects.create(project=project, audio_file=af)

                os.remove(temp_path)
        else:
            for f in request.FILES.getlist('audio_files'):
                af = AudioFile.objects.create(project=project, file=f)
                Task.objects.create(project=project, audio_file=af)

        result = ProjectSerializer(project, context={'request': request})
        return Response(result.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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

    data = request.data.copy()

    # Optional: handle JSON for labels
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

        # ✅ Explicitly update assigned_annotators
        if 'assigned_annotators' in data:
            updated_project.assigned_annotators.set(data['assigned_annotators'])

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

@api_view(['POST'])
def save_annotations(request, task_id):
    """Save annotations for a given task."""
    try:
        task = Task.objects.get(pk=task_id)
        data = request.data

        # Clear existing annotations
        task.annotations.all().delete()

        annotations = data.get('annotations', [])
        for ann in annotations:
            label = None
            if ann.get('label_id'):
                label = Label.objects.filter(pk=ann['label_id']).first()

            annotation = Annotation.objects.create(
                task=task,
                label=label,
                start_time=ann['start_time'],
                end_time=ann['end_time']
            )

            for attr in ann.get('attributes', []):
                attr_obj = Attribute.objects.filter(pk=attr['attribute_id']).first()
                val_obj = AttributeValue.objects.filter(pk=attr['value_id']).first()
                if attr_obj and val_obj:
                    AnnotationAttributeValue.objects.create(
                        annotation=annotation,
                        attribute=attr_obj,
                        value=val_obj
                    )

        task.status = data.get('status', 'In Progress')
        task.save()

        return Response({'message': 'Annotations saved successfully'}, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_task(request, task_id):
    """Get full task detail (audio, project, labels)."""
    try:
        task = Task.objects.get(pk=task_id)
        serializer = TaskSerializer(task, context={'request': request})
        return Response(serializer.data)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
def get_annotations(request, task_id):
    """Fetch all annotations for a given task."""
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
                'attributes': attributes
            })

        return Response({'annotations': results}, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)


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


@api_view(['DELETE'])
def delete_annotation(request, annotation_id):
    """Delete a single annotation."""
    try:
        ann = Annotation.objects.get(pk=annotation_id)
        ann.delete()
        return Response({'message': 'Annotation deleted'}, status=status.HTTP_200_OK)
    except Annotation.DoesNotExist:
        return Response({'error': 'Annotation not found'}, status=status.HTTP_404_NOT_FOUND)


def generate_auto_annotations(audio_file_path, project, duration):
    """Generate 2 dummy annotations with labels/attributes."""
    annotations = []
    used_ranges = []

    labels = list(project.labels.all())
    if not labels:
        raise ValueError("No labels in project")

    for _ in range(2):
        while True:
            start_time = round(random.uniform(0, duration - 0.5), 2)
            end_time = round(start_time + 0.5, 2)
            if all(not (start_time < u_end and end_time > u_start) for u_start, u_end in used_ranges):
                used_ranges.append((start_time, end_time))
                break

        label = random.choice(labels)
        attributes = []
        for attr in label.attributes.all():
            values = list(attr.values.all())
            if values:
                attributes.append({
                    'attribute': attr,
                    'value': random.choice(values)
                })

        annotations.append({
            'start_time': start_time,
            'end_time': end_time,
            'label': label,
            'attributes': attributes
        })

    return annotations


@api_view(['POST'])
def auto_annotate(request, task_id):
    """Generate auto-annotations for the task (dummy/random)."""
    try:
        task = Task.objects.get(pk=task_id)
        audio_file_path = task.audio_file.file.path
        project = task.project

        audio = AudioSegment.from_file(audio_file_path)
        duration = len(audio) / 1000.0

        if duration < 1:
            return Response({'error': 'Audio too short for auto annotation'}, status=status.HTTP_400_BAD_REQUEST)

        task.annotations.all().delete()

        try:
            generated = generate_auto_annotations(audio_file_path, project, duration)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        for ann in generated:
            annotation = Annotation.objects.create(
                task=task,
                label=ann['label'],
                start_time=ann['start_time'],
                end_time=ann['end_time']
            )
            for attr_val in ann['attributes']:
                AnnotationAttributeValue.objects.create(
                    annotation=annotation,
                    attribute=attr_val['attribute'],
                    value=attr_val['value']
                )

        task.status = 'In Progress'
        task.save()

        return Response({'message': 'Auto annotations created successfully'}, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    