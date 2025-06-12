import json
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import User, Project, AudioFile, Task, Annotation, AnnotationAttributeValue, Label, Attribute, AttributeValue
from .serializers import UserSerializer, ProjectSerializer, TaskSerializer, AnnotationSerializer
import os
import zipfile
import tempfile
from django.http import FileResponse
from pydub import AudioSegment
from django.conf import settings
import random

@api_view(['GET'])
def get_users(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def create_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    if not username or not password:
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(username=username)
        if user.password == password:
            serializer = UserSerializer(user)
            return Response(serializer.data)
        else:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    except User.DoesNotExist:
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

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def create_project(request):
    data = dict(request.data)

    # Parse 'labels' JSON
    try:
        data['labels'] = json.loads(request.data.get('labels', '[]'))
    except json.JSONDecodeError as e:
        return Response({'error': 'Invalid labels JSON', 'details': str(e)}, status=400)

    # Flatten multipart-encoded lists
    for key in ['name', 'data_type', 'display_waveform',
                'display_spectrogram', 'optimize',
                'degree', 'user']:
        if isinstance(data.get(key), list):
            data[key] = data[key][0]

    # Pass context so AudioFileSerializer.build_absolute_uri works
    serializer = ProjectSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        project = serializer.save()

        # Save uploaded audio files & tasks
        for f in request.FILES.getlist('audio_files'):
            af = AudioFile.objects.create(project=project, file=f)
            Task.objects.create(project=project, audio_file=af)

        # Re-serialize the full project (with optimize, labels, audio_files)
        result = ProjectSerializer(project, context={'request': request})
        return Response(result.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    # Include context here too
    serializer = ProjectSerializer(project, context={'request': request})
    return Response(serializer.data)

@api_view(['PUT'])
def update_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    # partial=True to allow updating only some fields
    serializer = ProjectSerializer(
        project,
        data=request.data,
        partial=True,
        context={'request': request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def list_projects(request):
    projects = Project.objects.all()
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)

@api_view(['DELETE'])
def delete_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    project.delete()
    return Response({'message': 'Project deleted successfully'}, status=status.HTTP_200_OK)

@api_view(['GET'])
def get_tasks(request):
    status_filter = request.GET.get('status')  # Optional query param ?status=New
    if status_filter:
        tasks = Task.objects.filter(status=status_filter)
    else:
        tasks = Task.objects.all()
    serializer = TaskSerializer(tasks, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def save_annotations(request, task_id):
    try:
        task = Task.objects.get(pk=task_id)
        data = request.data

        # Clear previous annotations for this task
        task.annotations.all().delete()

        annotations = data.get('annotations', [])
        for ann in annotations:
            label = None
            if ann.get('label_id') is not None:
                try:
                    label = Label.objects.get(pk=ann['label_id'])
                except Label.DoesNotExist:
                    # Ignore or handle label not found, here we skip label assignment
                    label = None

            annotation = Annotation.objects.create(
                task=task,
                label=label,
                start_time=ann['start_time'],
                end_time=ann['end_time']
            )

            attributes = ann.get('attributes', [])
            for attr in attributes:
                try:
                    attr_obj = Attribute.objects.get(pk=attr['attribute_id'])
                    val_obj = AttributeValue.objects.get(pk=attr['value_id'])
                    AnnotationAttributeValue.objects.create(
                        annotation=annotation,
                        attribute=attr_obj,
                        value=val_obj
                    )
                except (Attribute.DoesNotExist, AttributeValue.DoesNotExist):
                    # Skip invalid attribute or value references
                    continue

        # Update task status (default 'In Progress' if missing)
        new_status = data.get('status', 'In Progress')
        task.status = new_status
        task.save()

        return Response({'message': 'Annotations saved successfully'}, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_task(request, task_id):
    try:
        task = Task.objects.get(pk=task_id)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = TaskSerializer(task, context={'request': request})
    return Response(serializer.data)
@api_view(['GET'])
def get_annotations(request, task_id):
    try:
        task = Task.objects.get(pk=task_id)

        # Safe fallback in case related_name is missing
        annotations = Annotation.objects.filter(task=task)

        results = []
        for annotation in annotations:
            attributes = [
                {
                    'attribute_id': attr_value.attribute.id,
                    'attribute_name': attr_value.attribute.name,
                    'value_id': attr_value.value.id,
                    'value_value': attr_value.value.value
                }
                for attr_value in annotation.attribute_values.all()
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
    try:
        task = Task.objects.select_related('audio_file').get(id=task_id)
        annotations = Annotation.objects.filter(task=task)

        audio_path = task.audio_file.file.path
        audio = AudioSegment.from_file(audio_path)

        # Create a temporary directory to store clips and JSON
        with tempfile.TemporaryDirectory() as export_dir:
            clips_dir = os.path.join(export_dir, 'clips')
            os.makedirs(clips_dir, exist_ok=True)

            json_data = []

            for i, ann in enumerate(annotations, start=1):
                start_ms = int(ann.start_time * 1000)
                end_ms = int(ann.end_time * 1000)
                clip = audio[start_ms:end_ms]
                
                clip_filename = f"clip_{i}.wav"
                clip_path = os.path.join(clips_dir, clip_filename)
                clip.export(clip_path, format="wav")

                # Collect attributes with readable names
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

            # Write JSON
            json_path = os.path.join(export_dir, "annotations.json")
            with open(json_path, "w", encoding="utf-8") as f:
                import json
                json.dump(json_data, f, indent=2)

            # Create ZIP
            zip_path = os.path.join(tempfile.gettempdir(), f"task_{task_id}_export.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                zipf.write(json_path, arcname="annotations.json")
                for clip_file in os.listdir(clips_dir):
                    full_clip_path = os.path.join(clips_dir, clip_file)
                    zipf.write(full_clip_path, arcname=os.path.join("clips", clip_file))

            return FileResponse(open(zip_path, 'rb'), as_attachment=True, filename=f"task_{task_id}_export.zip")

    except Task.DoesNotExist:
        return JsonResponse({"error": "Task not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@api_view(['DELETE'])
def delete_annotation(request, annotation_id):
    """
    Delete a single annotation by its ID.
    """
    try:
        ann = Annotation.objects.get(pk=annotation_id)
        ann.delete()
        return Response({'message': 'Annotation deleted'}, status=status.HTTP_200_OK)
    except Annotation.DoesNotExist:
        return Response({'error': 'Annotation not found'}, status=status.HTTP_404_NOT_FOUND)



def generate_auto_annotations(audio_file_path, project, duration):
    """
    Generates 2 dummy annotations (0.5s each) with random labels and attributes.
    Replace this logic with ML predictions in the future.

    Returns:
        List of annotation dicts:
        [
            {
                'start_time': 0.0,
                'end_time': 0.5,
                'label': Label instance,
                'attributes': [
                    {'attribute': Attribute instance, 'value': AttributeValue instance},
                    ...
                ]
            },
            ...
        ]
    """
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
    try:
        task = Task.objects.get(pk=task_id)
        audio_file_path = task.audio_file.file.path
        project = task.project

        # Load audio
        audio = AudioSegment.from_file(audio_file_path)
        duration = len(audio) / 1000.0

        if duration < 1:
            return Response({'error': 'Audio too short for auto annotation'}, status=status.HTTP_400_BAD_REQUEST)

        # Clear existing annotations
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
