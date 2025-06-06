import json
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .models import User, Project, AudioFile,Task, Annotation, AnnotationAttributeValue, Label, Attribute, AttributeValue
from .serializers import UserSerializer, ProjectSerializer,TaskSerializer,AnnotationSerializer,AnnotationAttributeValueSerializer,LabelSerializer


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
    print("========= Incoming Data =========")
    print("request.data:", request.data)
    print("request.FILES:", request.FILES)
    print("=================================")

    # Convert request.data to a mutable dictionary
    data = dict(request.data)

    # Parse 'labels' JSON string into Python objects
    try:
        if 'labels' in data:
            data['labels'] = json.loads(request.data['labels'])
    except Exception as e:
        return Response({'labels': ['Invalid JSON format'], 'error': str(e)}, status=400)

    # Fix scalar fields wrapped as list due to multipart encoding
    for key in ['name', 'data_type', 'display_waveform', 'display_spectrogram', 'optimize', 'degree', 'user']:
        if isinstance(data.get(key), list):
            data[key] = data[key][0]

    # Validate and save project
    serializer = ProjectSerializer(data=data)
    if serializer.is_valid():
        project = serializer.save()

        # Save uploaded audio files and create tasks
        audio_files = request.FILES.getlist('audio_files')
        print(f"Creating {len(audio_files)} audio files and tasks")
        for audio_file in audio_files:
            af = AudioFile.objects.create(project=project, file=audio_file)
            Task.objects.create(project=project, audio_file=af)

        # Return full project details with audio files and tasks
        result_serializer = ProjectSerializer(Project.objects.get(pk=project.pk))
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)

    print("========= Validation Errors =========")
    print(serializer.errors)
    print("=====================================")
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


from .models import Task, Annotation, AnnotationAttributeValue, Label, Attribute, AttributeValue


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
            label = Label.objects.get(pk=ann['label_id'])
            annotation = Annotation.objects.create(
                task=task,
                label=label,
                start_time=ann['start_time'],
                end_time=ann['end_time']
            )

            for attr in ann['attributes']:
                attr_obj = Attribute.objects.get(pk=attr['attribute_id'])
                val_obj = AttributeValue.objects.get(pk=attr['value_id'])
                AnnotationAttributeValue.objects.create(
                    annotation=annotation,
                    attribute=attr_obj,
                    value=val_obj
                )

        # Update task status
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
        task = Task.objects.select_related('project').get(pk=task_id)
        annotations = task.annotations.all()
        annotation_serializer = AnnotationSerializer(annotations, many=True)

        project = task.project
        label_serializer = LabelSerializer(project.labels.all(), many=True)

        return Response({
            'annotations': annotation_serializer.data,
            'labels': label_serializer.data
        }, status=status.HTTP_200_OK)

    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
