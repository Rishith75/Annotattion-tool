from django.urls import path
from . import views
from django.views.decorators.csrf import csrf_exempt

urlpatterns = [
    # ----------- USER ROUTES -----------
    path('users/', views.get_users, name='user-list'),
    path('users/create/', views.create_user, name='user-create'),
    path('users/login/', views.login_user, name='user-login'),
    path('users/update/<int:pk>/', views.update_user, name='user-update'),

    # ----------- PROJECT ROUTES -----------
    path('projects/', views.list_projects, name='project-list'),
    path('projects/create/', views.create_project, name='project-create'),
    path('projects/<int:pk>/', views.get_project, name='project-detail'),
    path('projects/update/<int:pk>/', views.update_project, name='project-update'),
    path('projects/delete/<int:pk>/', views.delete_project, name='project-delete'),

    # ----------- SUPER PROJECT ROUTES -----------
    path('superprojects/', views.list_super_projects, name='superproject-list'),
    path('superprojects/create/', views.create_super_project, name='superproject-create'),
    path('superprojects/<int:pk>/', views.get_super_project, name='superproject-detail'),
    path('superprojects/update/<int:pk>/', views.update_super_project, name='superproject-update'),
    path('superprojects/delete/<int:pk>/', views.delete_super_project, name='superproject-delete'),

    # ----------- TASK ROUTES -----------
    path('tasks/', views.get_tasks, name='task-list'),
    path('tasks/project/<int:project_id>/', views.get_tasks_for_project, name='tasks-for-project'),
    path('task/<int:task_id>/', views.get_task, name='task-detail'),

    # ----------- ANNOTATION ROUTES -----------
    path('tasks/<int:task_id>/annotations/', views.get_annotations, name='get-annotations'),
    path('tasks/<int:task_id>/save_annotations/', views.save_annotations, name='save-annotations'),
    path('annotations/delete/<int:annotation_id>/', views.delete_annotation, name='delete-annotation'),

    # ----------- EXPORT ROUTES -----------
    path('tasks/<int:task_id>/export/', csrf_exempt(views.export_annotations), name='export-annotations'),
    path('projects/<int:project_id>/export/', csrf_exempt(views.export_project_annotations), name='export-project-annotations'),
    path('superprojects/<int:superproject_id>/export/', csrf_exempt(views.export_superproject_annotations), name='export-superproject-annotations'),
    path('inference/', views.inference_view, name='inference-view'),
    path('delete-annotations/', views.delete_annotations_view, name='delete-annotations'),


]
