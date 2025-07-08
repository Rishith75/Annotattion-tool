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

class AnnotationAdmin(admin.ModelAdmin):
    # Displaying the 'id' and other relevant fields
    list_display = ('id', 'task', 'label', 'model_label', 'start_time', 'end_time')
    
    # Enabling search functionality on task and label
    search_fields = ('task__audio_file__file', 'label__name', 'model_label')
    
    # Filtering options for easier navigation
    list_filter = ('task__status', 'label', 'model_label')
    
    # Optional: Sorting by start_time
    ordering = ('start_time',)
    
    # Readonly fields to prevent modification
    readonly_fields = ('id',)

# Register the Annotation model with the customized admin
admin.site.register(Annotation, AnnotationAdmin)

admin.site.register(User)
admin.site.register(Project)
admin.site.register(Label)
admin.site.register(Attribute)
admin.site.register(AttributeValue)
admin.site.register(AudioFile)
admin.site.register(Task)
#admin.site.register(Annotation)
admin.site.register(AnnotationAttributeValue)
admin.site.register(SuperProject)
