from rest_framework import serializers
from .models import User, Project, Label, Attribute, AttributeValue, AudioFile,Task


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class AttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeValue
        fields = ['id', 'value']


class AttributeSerializer(serializers.ModelSerializer):
    # For output, use AttributeValueSerializer to show nested values properly
    values = serializers.SerializerMethodField()

    class Meta:
        model = Attribute
        fields = ['id', 'name', 'values']

    def get_values(self, obj):
        # Return all related AttributeValues as list of strings
        return [av.value for av in obj.values.all()]

    def create(self, validated_data):
        values_data = validated_data.pop('values')
        attribute = Attribute.objects.create(**validated_data)
        for val in values_data:
            AttributeValue.objects.create(attribute=attribute, value=val)
        return attribute


class LabelSerializer(serializers.ModelSerializer):
    attributes = AttributeSerializer(many=True)

    class Meta:
        model = Label
        fields = ['id', 'name', 'attributes']

    def create(self, validated_data):
        attributes_data = validated_data.pop('attributes')
        label = Label.objects.create(**validated_data)
        for attribute_data in attributes_data:
            values_data = attribute_data.pop('values')
            attribute = Attribute.objects.create(label=label, **attribute_data)
            for val in values_data:
                AttributeValue.objects.create(attribute=attribute, value=val)
        return label


class AudioFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AudioFile
        fields = ['id', 'file', 'optimized']


class ProjectSerializer(serializers.ModelSerializer):
    labels = LabelSerializer(many=True)
    audio_files = AudioFileSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'user', 'name', 'data_type', 
            'display_waveform', 'display_spectrogram', 
            'degree', 'labels', 'audio_files'
        ]

    def create(self, validated_data):
        labels_data = validated_data.pop('labels')

        # Create the Project
        project = Project.objects.create(**validated_data)

        # Create Labels, Attributes, and AttributeValues
        for label_data in labels_data:
            attributes_data = label_data.pop('attributes', [])
            label = Label.objects.create(project=project, **label_data)
            for attribute_data in attributes_data:
                values_data = attribute_data.pop('values', [])
                attribute = Attribute.objects.create(label=label, **attribute_data)
                for val in values_data:
                    AttributeValue.objects.create(attribute=attribute, value=val)

        # AudioFile and Task creation will be handled in the view
        return project

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['labels'] = LabelSerializer(instance.labels.all(), many=True).data
        ret['audio_files'] = AudioFileSerializer(instance.audio_files.all(), many=True).data
        return ret

class TaskSerializer(serializers.ModelSerializer):
    audio_file = AudioFileSerializer()
    project = serializers.StringRelatedField()
    class Meta:
        model = Task
        fields = ['id', 'project', 'audio_file', 'status']
