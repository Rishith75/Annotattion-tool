from rest_framework import serializers
from .models import (
    User, SuperProject, Project, Label, Attribute, AttributeValue,
    AudioFile, Task, Annotation, AnnotationAttributeValue
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
        }

class AttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeValue
        fields = ['id', 'value']

class AttributeSerializer(serializers.ModelSerializer):
    values = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    value_objs = AttributeValueSerializer(source='values', many=True, read_only=True)

    class Meta:
        model = Attribute
        fields = ['id', 'name', 'values', 'value_objs']

    def create(self, validated_data):
        values_data = validated_data.pop('values', [])
        attribute = Attribute.objects.create(**validated_data)
        for val in values_data:
            AttributeValue.objects.create(attribute=attribute, value=val)
        return attribute

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['values'] = AttributeValueSerializer(instance.values.all(), many=True).data
        return rep

class LabelSerializer(serializers.ModelSerializer):
    attributes = AttributeSerializer(many=True, required=False)

    class Meta:
        model = Label
        fields = ['id', 'name', 'attributes']

    def create(self, validated_data):
        attributes_data = validated_data.pop('attributes', [])
        label = Label.objects.create(**validated_data)
        for attribute_data in attributes_data:
            values_data = attribute_data.pop('values', [])
            attribute = Attribute.objects.create(label=label, **attribute_data)
            for val in values_data:
                AttributeValue.objects.create(attribute=attribute, value=val)
        return label

class AudioFileSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model = AudioFile
        fields = ['id', 'file', 'optimized']

    def get_file(self, obj):
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

class SuperProjectSerializer(serializers.ModelSerializer):
    annotators = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='annotator'), many=True)

    class Meta:
        model = SuperProject
        fields = ['id', 'name', 'manager', 'annotators']

    def create(self, validated_data):
        annotators = validated_data.pop('annotators', [])
        super_project = SuperProject.objects.create(**validated_data)
        super_project.annotators.set(annotators)
        return super_project

class ProjectSerializer(serializers.ModelSerializer):
    labels = LabelSerializer(many=True, required=False)
    audio_files = AudioFileSerializer(many=True, read_only=True)
    assigned_annotators = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='annotator'), many=True
    )

    class Meta:
        model = Project
        fields = [
            'id', 'super_project', 'user', 'name', 'data_type',
            'display_waveform', 'display_spectrogram', 'optimize', 'degree',
            'labels', 'audio_files', 'assigned_annotators', 'model_type'
        ]

    def create(self, validated_data):
        labels_data = validated_data.pop('labels', [])
        annotators = validated_data.pop('assigned_annotators', [])
        project = Project.objects.create(**validated_data)
        project.assigned_annotators.set(annotators)

        for label_data in labels_data:
            attributes_data = label_data.pop('attributes', [])
            label = Label.objects.create(project=project, **label_data)
            for attribute_data in attributes_data:
                values_data = attribute_data.pop('values', [])
                attribute = Attribute.objects.create(label=label, **attribute_data)
                for val in values_data:
                    AttributeValue.objects.create(attribute=attribute, value=val)
        return project

    def update(self, instance, validated_data):
        labels_data = validated_data.pop('labels', None)
        annotators = validated_data.pop('assigned_annotators', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if annotators is not None:
            instance.assigned_annotators.set(annotators)

        if labels_data is not None:
            instance.labels.all().delete()
            for label_data in labels_data:
                attributes_data = label_data.pop('attributes', [])
                label = Label.objects.create(project=instance, **label_data)
                for attribute_data in attributes_data:
                    values_data = attribute_data.pop('values', [])
                    attribute = Attribute.objects.create(label=label, **attribute_data)
                    for val in values_data:
                        AttributeValue.objects.create(attribute=attribute, value=val)

        return instance

class TaskSerializer(serializers.ModelSerializer):
    audio_file = AudioFileSerializer()
    project = ProjectSerializer()

    class Meta:
        model = Task
        fields = ['id', 'project', 'audio_file', 'status']

class AnnotationAttributeValueSerializer(serializers.ModelSerializer):
    attribute_id = serializers.IntegerField(source='attribute.id')
    value_id = serializers.IntegerField(source='value.id')

    class Meta:
        model = AnnotationAttributeValue
        fields = ['attribute_id', 'value_id']

class AnnotationSerializer(serializers.ModelSerializer):
    label_id = serializers.IntegerField(source='label.id', allow_null=True, required=False)
    model_label = serializers.CharField(read_only=True)  # Model prediction (read-only in API)

    attributes = AnnotationAttributeValueSerializer(
        source='attribute_values', many=True, required=False
    )

    class Meta:
        model = Annotation
        fields = ['id', 'label_id', 'model_label', 'start_time', 'end_time', 'attributes']


