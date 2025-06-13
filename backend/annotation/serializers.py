from rest_framework import serializers
from .models import User, Project, Label, Attribute, AttributeValue, AudioFile, Task, Annotation, AnnotationAttributeValue

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class AttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeValue
        fields = ['id', 'value']

class AttributeSerializer(serializers.ModelSerializer):
    values = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)  # optional
    value_objs = AttributeValueSerializer(source='values', many=True, read_only=True)

    class Meta:
        model = Attribute
        fields = ['id', 'name', 'values', 'value_objs']

    def create(self, validated_data):
        values_data = validated_data.pop('values', [])  # optional default to empty list
        attribute = Attribute.objects.create(**validated_data)
        for val in values_data:
            AttributeValue.objects.create(attribute=attribute, value=val)
        return attribute

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['values'] = AttributeValueSerializer(instance.values.all(), many=True).data
        return rep

class LabelSerializer(serializers.ModelSerializer):
    attributes = AttributeSerializer(many=True, required=False)  # optional

    class Meta:
        model = Label
        fields = ['id', 'name', 'attributes']

    def create(self, validated_data):
        attributes_data = validated_data.pop('attributes', [])  # optional
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

# serializers.py

class ProjectSerializer(serializers.ModelSerializer):
    labels = LabelSerializer(many=True, required=False)
    audio_files = AudioFileSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'user', 'name', 'data_type',
            'display_waveform', 'display_spectrogram',
            'optimize', 'degree',
            'labels', 'audio_files'
        ]

    def create(self, validated_data):
        labels_data = validated_data.pop('labels', [])
        project = Project.objects.create(**validated_data)

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
        # 1) Pop off labels if provided
        labels_data = validated_data.pop('labels', None)

        # 2) Update scalar fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if labels_data is not None:
            # 3) Remove old labels (and cascade attributes/values)
            instance.labels.all().delete()

            # 4) Re-create fresh labels + nested attrs/values
            for label_data in labels_data:
                attrs_data = label_data.pop('attributes', [])
                label = Label.objects.create(project=instance, **label_data)
                for attr_data in attrs_data:
                    vals = attr_data.pop('values', [])
                    attribute = Attribute.objects.create(label=label, **attr_data)
                    for v in vals:
                        AttributeValue.objects.create(attribute=attribute, value=v)
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
    label_id = serializers.IntegerField(source='label.id', allow_null=True, required=False)  # label optional
    attributes = AnnotationAttributeValueSerializer(source='attribute_values', many=True, required=False)

    class Meta:
        model = Annotation
        fields = ['id', 'label_id', 'start_time', 'end_time', 'attributes']
