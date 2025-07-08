from django.contrib import admin
from .models import (
    User,
    Project,
    Label,
    Attribute,
    AttributeValue,
    AudioFile,
    Task,
    Annotation,
    AnnotationAttributeValue,
    SuperProject,
)

admin.site.register(User)
admin.site.register(Project)
admin.site.register(Label)
admin.site.register(Attribute)
admin.site.register(AttributeValue)
admin.site.register(AudioFile)
admin.site.register(Task)
admin.site.register(Annotation)
admin.site.register(AnnotationAttributeValue)
admin.site.register(SuperProject)
