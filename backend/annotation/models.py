from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('manager', 'Project Manager'),
        ('annotator', 'Annotator'),
    ]
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='annotator')

    REQUIRED_FIELDS = ['email', 'full_name', 'role']
    
    def __str__(self):
        return self.username
class SuperProject(models.Model):
    name = models.CharField(max_length=255)
    manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name='super_projects')
    annotators = models.ManyToManyField(User, related_name='assigned_super_projects')

    def __str__(self):
        return self.name

class Project(models.Model):
    MODEL_TYPE_CHOICES = [
        ('beats', 'BEATs'),
        ('yamnet', 'YAMNet'),
        ('others', 'Others'),
    ]

    super_project = models.ForeignKey(SuperProject, on_delete=models.CASCADE, related_name='projects')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')  # Creator/manager
    name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=20, choices=[('train', 'Train'), ('test', 'Test'), ('validation', 'Validation')])
    display_waveform = models.BooleanField(default=False)
    display_spectrogram = models.BooleanField(default=False)
    optimize = models.BooleanField(default=False)
    degree = models.IntegerField(default=1)
    assigned_annotators = models.ManyToManyField(User, related_name='assigned_projects')

    # NEW FIELD for selecting model type for auto annotation
    model_type = models.CharField(max_length=20, choices=MODEL_TYPE_CHOICES, default='beats')

    def __str__(self):
        return self.name

class Label(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='labels')
    name = models.CharField(max_length=100)

class Attribute(models.Model):
    label = models.ForeignKey(Label, on_delete=models.CASCADE, related_name='attributes')
    name = models.CharField(max_length=100)

class AttributeValue(models.Model):
    attribute = models.ForeignKey(Attribute, on_delete=models.CASCADE, related_name='values')
    value = models.CharField(max_length=100)

class AudioFile(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='audio_files')
    file = models.FileField(upload_to='audio/')
    optimized = models.BooleanField(default=False)

class Task(models.Model):
    STATUS_CHOICES = [
        ('New', 'New'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    audio_file = models.ForeignKey(AudioFile, on_delete=models.CASCADE, related_name='tasks')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='New')

    def __str__(self):
        return f"Task for {self.audio_file.file.name} in project {self.project.name} [{self.status}]"

class Annotation(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='annotations')
    label = models.ForeignKey(Label, on_delete=models.CASCADE, null=True, blank=True)
    start_time = models.FloatField()
    end_time = models.FloatField()
    
    # NEW field for model-generated label (as string, independent of Label FK)
    model_label = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        lbl = self.label.name if self.label else (self.model_label or "No Label")
        return f"{lbl} [{self.start_time} - {self.end_time}]"

class AnnotationAttributeValue(models.Model):
    annotation = models.ForeignKey(Annotation, on_delete=models.CASCADE, related_name='attribute_values')
    attribute = models.ForeignKey(Attribute, on_delete=models.CASCADE)
    value = models.ForeignKey(AttributeValue, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.attribute.name}: {self.value.value}"


