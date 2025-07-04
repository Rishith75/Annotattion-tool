import csv
import numpy as np
import tensorflow as tf
from tensorflow.keras import Model, layers
import features as features_lib


def _batch_norm(name, params):
    def _bn_layer(layer_input):
        return layers.BatchNormalization(
            name=name,
            center=params.batchnorm_center,
            scale=params.batchnorm_scale,
            epsilon=params.batchnorm_epsilon)(layer_input)
    return _bn_layer

def _conv(name, kernel, stride, filters, params):
    def _conv_layer(layer_input):
        output = layers.Conv2D(
            name=f'{name}_conv',
            filters=filters,
            kernel_size=kernel,
            strides=stride,
            padding=params.conv_padding,
            use_bias=False,
            activation=None)(layer_input)
        output = _batch_norm(f'{name}_conv_bn', params)(output)
        output = layers.ReLU(name=f'{name}_relu')(output)
        return output
    return _conv_layer

def _separable_conv(name, kernel, stride, filters, params):
    def _separable_conv_layer(layer_input):
        output = layers.DepthwiseConv2D(
            name=f'{name}_depthwise_conv',
            kernel_size=kernel,
            strides=stride,
            depth_multiplier=1,
            padding=params.conv_padding,
            use_bias=False)(layer_input)
        output = _batch_norm(f'{name}_depthwise_conv_bn', params)(output)
        output = layers.ReLU(name=f'{name}_depthwise_conv_relu')(output)
        output = layers.Conv2D(
            name=f'{name}_pointwise_conv',
            filters=filters,
            kernel_size=(1, 1),
            strides=1,
            padding=params.conv_padding,
            use_bias=False)(output)
        output = _batch_norm(f'{name}_pointwise_conv_bn', params)(output)
        output = layers.ReLU(name=f'{name}_pointwise_conv_relu')(output)
        return output
    return _separable_conv_layer

_YAMNET_LAYER_DEFS = [
    (_conv,           [3, 3], 2,   32),
    (_separable_conv, [3, 3], 1,   64),
    (_separable_conv, [3, 3], 2,  128),
    (_separable_conv, [3, 3], 1,  128),
    (_separable_conv, [3, 3], 2,  256),
    (_separable_conv, [3, 3], 1,  256),
    (_separable_conv, [3, 3], 2,  512),
    (_separable_conv, [3, 3], 1,  512),
    (_separable_conv, [3, 3], 1,  512),
    (_separable_conv, [3, 3], 1,  512),
    (_separable_conv, [3, 3], 1,  512),
    (_separable_conv, [3, 3], 1,  512),
    (_separable_conv, [3, 3], 2, 1024),
    (_separable_conv, [3, 3], 1, 1024),
]

def yamnet(features, params):
    """Core YAMNet model (without waveform input)."""
    net = layers.Reshape(
        target_shape=(params.patch_frames, params.patch_bands, 1),
        name="reshape_input")(features)
    for i, (layer_fun, kernel, stride, filters) in enumerate(_YAMNET_LAYER_DEFS):
        net = layer_fun(f'layer{i + 1}', kernel, stride, filters, params)(net)
    embeddings = layers.GlobalAveragePooling2D(name="embedding_pool")(net)
    logits = layers.Dense(
        units=params.num_classes,
        use_bias=True,
        name="logits")(embeddings)
    predictions = layers.Activation(
        activation=params.classifier_activation,
        name="predictions")(logits)
    return predictions, embeddings

def yamnet_frames_model(params):
    """YAMNet model that processes log mel spectrogram patches."""
    features_input = tf.keras.Input(
        shape=(params.patch_frames, params.patch_bands),
        name='log_mel_input')
    predictions, embeddings = yamnet(features_input, params)
    return Model(inputs=features_input,
                 outputs=[predictions, embeddings],
                 name='yamnet_frames_model')

def class_names(class_map_csv):
    """Loads class display names from a CSV file."""
    if tf.is_tensor(class_map_csv):
        class_map_csv = class_map_csv.numpy()
    with open(class_map_csv, 'r') as csv_file:
        reader = csv.reader(csv_file)
        next(reader)  # Skip header
        return np.array([display_name for (_, _, display_name) in reader])
