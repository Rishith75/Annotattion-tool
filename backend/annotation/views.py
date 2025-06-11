import json
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import User, Project, AudioFile, Task, Annotation, AnnotationAttributeValue, Label, Attribute, AttributeValue
from .serializers import UserSerializer, ProjectSerializer, TaskSerializer, AnnotationSerializer

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

    # Parse 'labels' JSON string if exists and is not empty
    try:
        if 'labels' in data and data['labels']:
            data['labels'] = json.loads(request.data['labels'])
        else:
            data['labels'] = []
    except Exception as e:
        return Response({'labels': ['Invalid JSON format'], 'error': str(e)}, status=400)

    # Fix scalar fields wrapped as list due to multipart encoding
    for key in ['name', 'data_type', 'display_waveform', 'display_spectrogram', 'optimize', 'degree', 'user']:
        if isinstance(data.get(key), list):
            data[key] = data[key][0]

    serializer = ProjectSerializer(data=data)
    if serializer.is_valid():
        project = serializer.save()

        # Save uploaded audio files and create tasks
        audio_files = request.FILES.getlist('audio_files')
        for audio_file in audio_files:
            af = AudioFile.objects.create(project=project, file=audio_file)
            Task.objects.create(project=project, audio_file=af)

        result_serializer = ProjectSerializer(Project.objects.get(pk=project.pk))
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def list_projects(request):
    projects = Project.objects.all()
    serializer = ProjectSerializer(projects, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def get_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
        serializer = ProjectSerializer(project)
        return Response(serializer.data)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
def update_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProjectSerializer(project, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def delete_project(request, pk):
    try:
        project = Project.objects.get(pk=pk)
        project.delete()
        return Response({'message': 'Project deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

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
        task = Task.objects.get(id=task_id)
        annotations = Annotation.objects.filter(task=task)

        data = []
        for ann in annotations:
            attributes = AnnotationAttributeValue.objects.filter(annotation=ann)
            data.append({
                "start_time": ann.start_time,
                "end_time": ann.end_time,
                "label_id": ann.label.id if ann.label else None,
                "attributes": [
                    {
                        "attribute_id": attr.attribute.id,
                        "value_id": attr.value.id
                    }
                    for attr in attributes
                ]
            })

        response = JsonResponse(data, safe=False)
        response['Content-Disposition'] = f'attachment; filename="task_{task_id}_annotations.json"'
        return response
    except Task.DoesNotExist:
        return JsonResponse({"error": "Task not found"}, status=404)
